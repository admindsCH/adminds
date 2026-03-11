"""Classification + dossier parsing services.

Two endpoints, two levels of analysis:
1. classify_documents() — fast per-file labeling (category + summary) for Step 1 UI.
2. parse_dossier() — deep structured extraction of all files into PatientDossier for Step 2.
"""

from __future__ import annotations

import asyncio

from fastapi import HTTPException, UploadFile
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI
from loguru import logger

from app.config import settings
from app.classification.constants import (
    CLASSIFICATION_SYSTEM_PROMPT,
    DOSSIER_SYSTEM_PROMPT,
)
import fitz  # pymupdf — for raw text extraction from PDFs.

from app.classification.helpers import file_to_content_blocks
from app.classification import store
from app.classification.schemas import (
    ClassifiedDocument,
    DocumentClassification,
    DossierResponse,
    PatientDossier,
    PatientDossierPatch,
)


def _get_model() -> AzureChatOpenAI:
    """Create the Azure OpenAI chat model via private endpoint."""
    return AzureChatOpenAI(
        azure_deployment=settings.azure_openai_deployment,
        api_key=settings.azure_openai_api_key,
        azure_endpoint=settings.azure_openai_endpoint,
        api_version=settings.azure_openai_api_version,
        temperature=0,
    )


# =====================================================================
# Classification — lightweight per-file labeling (Step 1)
# =====================================================================


async def classify_document(filename: str, file_bytes: bytes) -> ClassifiedDocument:
    """Classify a single file (category + summary + author).

    Converts the file to content blocks, calls GPT-4o with structured output,
    returns the classification. Works for any file size — a 1-page letter or
    a 20-page dossier both get a single classification.
    """
    # Only send the first 2 pages — enough to determine category/author/date
    # without burning tokens on a full 20-page document.
    content_blocks = file_to_content_blocks(filename, file_bytes, max_pages=2)
    # Bind structured output to DocumentClassification for this call only.
    structured = _get_model().with_structured_output(DocumentClassification)

    logger.info(f"Classifying '{filename}' ({len(content_blocks)} block(s))...")
    classification = await structured.ainvoke([
        SystemMessage(content=CLASSIFICATION_SYSTEM_PROMPT),
        HumanMessage(content=content_blocks),
    ])
    logger.info(f"Classified '{filename}' → {classification.category}")

    return ClassifiedDocument(filename=filename, classification=classification)


async def classify_documents(files: list[UploadFile]) -> list[ClassifiedDocument]:
    """Classify multiple uploaded files independently.

    Each file gets its own LLM call. If one fails, it gets a fallback
    classification so the rest of the batch is not affected.
    """
    results: list[ClassifiedDocument] = []

    for file in files:
        try:
            file_bytes = await file.read()
            classified = await classify_document(file.filename or "unknown", file_bytes)
            results.append(classified)
        except Exception as e:
            logger.exception(f"Classification failed for {file.filename}")
            results.append(
                ClassifiedDocument(
                    filename=file.filename or "unknown",
                    classification=DocumentClassification(
                        category="autre",
                        date=None,
                        author_type="inconnu",
                        summary=f"Erreur: {e}",
                        rapport_ai_fields=[],
                    ),
                )
            )

    return results


# =====================================================================
# Dossier parsing — deep structured extraction (Step 2)
# =====================================================================


# Max image blocks per chunk before splitting into parallel calls.
# 6 pages keeps each call well under OpenAI's timeout threshold.
_MAX_IMAGES_PER_CHUNK = 6


def _chunk_blocks(blocks: list[dict], max_images: int) -> list[list[dict]]:
    """Split content blocks into chunks of at most `max_images` image blocks.

    Text blocks are attached to the chunk of the images they precede
    (e.g. file separators stay with their images). If total images ≤
    max_images, returns a single chunk (no splitting needed).
    """
    # Count image blocks to decide whether splitting is needed.
    image_count = sum(1 for b in blocks if b.get("type") == "image_url")
    if image_count <= max_images:
        return [blocks]

    chunks: list[list[dict]] = []
    current: list[dict] = []
    current_images = 0

    for block in blocks:
        is_image = block.get("type") == "image_url"
        # Start a new chunk when we'd exceed the limit.
        if is_image and current_images >= max_images:
            chunks.append(current)
            current = []
            current_images = 0
        current.append(block)
        if is_image:
            current_images += 1

    if current:
        chunks.append(current)

    return chunks


def _merge_dossiers(partials: list[PatientDossier]) -> PatientDossier:
    """Merge multiple partial PatientDossier results into one.

    Strategy:
    - patient_info: prefer non-null values; on conflict keep the first one.
    - timeline: concatenate, deduplicate by (date, title).
    - medications: concatenate, deduplicate by lowercase nom.
    - diagnostics: concatenate, deduplicate by (label, code_cim).
    - rapport_ai_fields: for each field, keep the longest non-null value.
    - notes: concatenate non-null values.
    """
    if len(partials) == 1:
        return partials[0]

    # --- patient_info: first non-null value for each field ---
    merged_info = partials[0].patient_info.model_dump()
    for p in partials[1:]:
        for key, val in p.patient_info.model_dump().items():
            if merged_info.get(key) is None and val is not None:
                merged_info[key] = val

    # --- timeline: deduplicate by (date, title) ---
    seen_tl: set[tuple[str | None, str]] = set()
    timeline = []
    for p in partials:
        for entry in p.timeline:
            key = (entry.date, entry.title)
            if key not in seen_tl:
                seen_tl.add(key)
                timeline.append(entry)

    # --- medications: deduplicate by lowercase name ---
    seen_med: set[str] = set()
    medications = []
    for p in partials:
        for med in p.medications:
            key = med.nom.lower().strip()
            if key not in seen_med:
                seen_med.add(key)
                medications.append(med)

    # --- diagnostics: deduplicate by (label, code_cim) ---
    seen_diag: set[tuple[str, str | None]] = set()
    diagnostics = []
    for p in partials:
        for d in p.diagnostics:
            key = (d.label.lower().strip(), d.code_cim)
            if key not in seen_diag:
                seen_diag.add(key)
                diagnostics.append(d)

    # --- rapport_ai_fields: keep the longest non-null value per field ---
    merged_raf: dict[str, str | None] = {}
    for p in partials:
        for key, val in p.rapport_ai_fields.model_dump().items():
            existing = merged_raf.get(key)
            if val is not None and (existing is None or len(val) > len(existing)):
                merged_raf[key] = val

    # --- notes: concatenate ---
    notes_parts = [p.notes for p in partials if p.notes]
    merged_notes = "\n\n".join(notes_parts) if notes_parts else None

    from app.classification.schemas import PatientInfo, RapportAiFields

    return PatientDossier(
        patient_info=PatientInfo(**merged_info),
        timeline=timeline,
        medications=medications,
        diagnostics=diagnostics,
        rapport_ai_fields=RapportAiFields(**merged_raf),
        notes=merged_notes,
    )


async def _parse_chunk(
    chunk: list[dict], chunk_index: int, total_chunks: int,
) -> PatientDossier:
    """Parse a single chunk of content blocks into a PatientDossier."""
    structured_model = _get_model().with_structured_output(PatientDossier)
    logger.info(f"Parsing chunk {chunk_index + 1}/{total_chunks} ({len(chunk)} block(s))")
    return await structured_model.ainvoke([
        SystemMessage(content=DOSSIER_SYSTEM_PROMPT),
        HumanMessage(content=chunk),
    ])


async def parse_dossier(files: list[UploadFile]) -> PatientDossier:
    """Parse uploaded medical documents into a structured PatientDossier.

    Handles both patterns:
    - 1 large PDF (20+ pages) → pymupdf renders each page to PNG → N image blocks
    - N separate files (PDF + DOCX + images) → each converted to its own blocks

    When total image blocks exceed _MAX_IMAGES_PER_CHUNK, the blocks are
    split into chunks and processed in parallel to avoid API timeouts.
    Results are merged into a single dossier.
    """
    # Collect content blocks (for LLM) and raw text (for report generation)
    # from every uploaded file.
    all_blocks: list[dict] = []
    raw_parts: list[str] = []

    for file in files:
        file_bytes = await file.read()
        filename = file.filename or "unknown"
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        # Content blocks for the LLM (images for PDF, text for DOCX).
        blocks = file_to_content_blocks(filename, file_bytes)
        logger.info(f"File '{filename}' → {len(blocks)} content block(s)")

        # Raw text extraction — preserves full uncompressed content.
        # PDF: pymupdf get_text() extracts embedded text from every page.
        # DOCX: text is already in the content block.
        if ext == "pdf":
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            pages = [page.get_text().strip() for page in doc if page.get_text().strip()]
            doc.close()
            if pages:
                raw_parts.append(f"--- {filename} ---\n" + "\n\n".join(pages))
        elif ext in {"docx", "doc"}:
            # The DOCX text block has format "Contenu du document '...':\n\n{text}"
            # Extract the text portion directly from the block.
            for block in blocks:
                if block.get("type") == "text":
                    raw_parts.append(f"--- {filename} ---\n" + block["text"])

        # Separator between files so the LLM can distinguish documents.
        if len(files) > 1:
            all_blocks.append({
                "type": "text",
                "text": f"\n--- Document: {filename} ---\n",
            })

        all_blocks.extend(blocks)

    logger.info(
        f"Parsing dossier: {len(files)} file(s), {len(all_blocks)} total block(s)"
    )

    # Split into chunks if too many images, then parse in parallel.
    chunks = _chunk_blocks(all_blocks, _MAX_IMAGES_PER_CHUNK)

    if len(chunks) == 1:
        # Small enough for a single call.
        structured_model = _get_model().with_structured_output(PatientDossier)
        dossier = await structured_model.ainvoke([
            SystemMessage(content=DOSSIER_SYSTEM_PROMPT),
            HumanMessage(content=all_blocks),
        ])
    else:
        # Parallel calls — one per chunk, then merge.
        logger.info(
            f"Splitting into {len(chunks)} parallel chunks "
            f"(max {_MAX_IMAGES_PER_CHUNK} images each)"
        )
        partials = await asyncio.gather(*[
            _parse_chunk(chunk, i, len(chunks))
            for i, chunk in enumerate(chunks)
        ])
        dossier = _merge_dossiers(list(partials))
        logger.info(
            f"Merged {len(chunks)} partial dossiers into one"
        )

    # Attach the raw extracted text — not from the LLM, extracted server-side.
    # This is used by report generation to have full uncompressed clinical text.
    dossier.raw_content = "\n\n".join(raw_parts) if raw_parts else None

    logger.info(
        f"Dossier parsed: {len(dossier.timeline)} timeline entries, "
        f"{len(dossier.medications)} medications, "
        f"{len(dossier.diagnostics)} diagnostics, "
        f"raw_content: {len(dossier.raw_content or '')} chars"
    )

    return dossier


# =====================================================================
# Dossier CRUD — thin wrappers around the in-memory store
# =====================================================================


async def parse_and_store_dossier(files: list[UploadFile]) -> DossierResponse:
    """Parse files into a PatientDossier, store it, return with ID."""
    dossier = await parse_dossier(files)
    dossier_id = store.create_dossier(dossier)
    return DossierResponse(dossier_id=dossier_id, dossier=dossier)


def get_dossier(dossier_id: str) -> DossierResponse:
    """Retrieve a stored dossier by ID. Raises 404 if not found."""
    dossier = store.get_dossier(dossier_id)
    if dossier is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    return DossierResponse(dossier_id=dossier_id, dossier=dossier)


def patch_dossier(dossier_id: str, patch: PatientDossierPatch) -> DossierResponse:
    """Apply a partial update to a stored dossier. Raises 404 if not found."""
    updated = store.update_dossier(dossier_id, patch.model_dump(exclude_unset=True))
    if updated is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    return DossierResponse(dossier_id=dossier_id, dossier=updated)
