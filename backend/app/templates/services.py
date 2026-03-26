"""Template services — orchestrates upload, classification, extraction, and storage.

Supports both .docx and .pdf templates:
- DOCX: stored as-is, XML-based slot extraction
- PDF:  stored as-is, AcroForm field extraction via PyMuPDF
"""

from __future__ import annotations

import re
import unicodedata

from fastapi import HTTPException
from loguru import logger

from app.services import blob_storage
from app.templates.schema_extractor import extract_raw_slots
from app.templates.schema_labeler import label_slots
from app.templates.schemas import (
    ExtractSchemaResponse,
    TemplateResponse,
    TemplateSchema,
    UpdateSchemaRequest,
)
from app.templates.template_classifier import classify_template


def _slugify(text: str) -> str:
    """Convert text to a URL/blob-safe slug.

    "Rapport AI Fribourg" → "rapport-ai-fribourg"
    """
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def list_templates() -> list[TemplateResponse]:
    """List all available templates."""
    return blob_storage.list_templates()


def delete_template(template_id: str) -> None:
    """Delete a template and its schema."""
    try:
        blob_storage.delete_template(template_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


def rename_template(template_id: str, new_name: str) -> None:
    """Rename a template by updating its blob metadata."""
    try:
        meta = blob_storage.get_template_metadata(template_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Template introuvable")
    meta["name"] = new_name
    blob_storage.update_template_metadata(template_id, meta)


async def extract_schema(template_id: str) -> ExtractSchemaResponse:
    """Run or re-run schema extraction on a template."""
    try:
        meta = blob_storage.get_template_metadata(template_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Template introuvable")
    template_name = meta.get("name", template_id)
    schema = await extract_and_store_schema(template_id, template_name)
    return ExtractSchemaResponse(
        template_id=template_id,
        field_count=len(schema.fields),
        sections=sorted({f.section for f in schema.fields}),
    )


def get_schema_dict(template_id: str) -> dict:
    """Return a stored schema as a dict, or raise 404."""
    schema = get_schema(template_id)
    if schema is None:
        raise HTTPException(
            status_code=404,
            detail="Schema non trouvé. Lancez l'extraction d'abord.",
        )
    return schema.model_dump()


def update_schema(template_id: str, request: UpdateSchemaRequest) -> dict:
    """Validate and persist an updated schema."""
    schema = get_schema(template_id)
    if schema is None:
        raise HTTPException(status_code=404, detail="Schema non trouvé.")
    ids = [f.id for f in request.fields]
    dupes = [fid for fid in ids if ids.count(fid) > 1]
    if dupes:
        raise HTTPException(status_code=400, detail=f"IDs dupliqués: {set(dupes)}")
    schema.fields = request.fields
    blob_storage.upload_schema(template_id, schema.model_dump())
    return schema.model_dump()


async def upload_and_extract(
    file_bytes: bytes,
    filename: str,
) -> TemplateResponse:
    """Full upload pipeline: classify → store → extract schema.

    1. Detect format (PDF or DOCX)
    2. Classify the template with LLM (auto-name, category, canton, insurance)
    3. Upload original file to blob storage
    4. Extract schema (Pass 1) — XML for DOCX, AcroForm for PDF

    Args:
        file_bytes: Raw uploaded file bytes (.docx or .pdf).
        filename: Original filename.

    Returns:
        TemplateResponse with auto-detected metadata.
    """
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Fichier vide")
    is_pdf = file_bytes[:4] == b"%PDF"
    if not is_pdf and file_bytes[:2] != b"PK":
        raise HTTPException(
            status_code=400,
            detail="Format non supporté. Veuillez importer un fichier .docx ou .pdf.",
        )
    template_format = "pdf" if is_pdf else "docx"
    ext = "pdf" if is_pdf else "docx"

    # ── Step 1: Classify with LLM ────────────────────────
    # For PDFs, extract text via PyMuPDF for classification
    if is_pdf:
        classify_bytes = _extract_pdf_text_for_classification(file_bytes)
    else:
        classify_bytes = file_bytes

    try:
        metadata = await classify_template(classify_bytes, is_pdf=is_pdf)
    except Exception as e:
        logger.error(f"Classification failed for '{filename}': {e}")
        metadata = {
            "name": filename.rsplit(".", 1)[0],
            "description": "Formulaire importe",
            "category": "rapport-medical",
            "canton": "all",
            "insurance_id": "",
            "page_count": "1",
            "estimated_minutes": "3",
            "is_official": "false",
        }

    metadata["template_format"] = template_format

    # ── Step 2: Build blob name as category/slug-name.ext ──
    slug = _slugify(metadata["name"])
    category = metadata.get("category", "rapport-ai")
    stored_filename = f"{slug}.{ext}"
    template_id = f"{category}/{slug}"

    logger.info(
        f"Template '{metadata['name']}' → blob '{template_id}.{ext}', "
        f"format={template_format}, category={category}, canton={metadata['canton']}"
    )

    # ── Step 3: Upload to blob storage ───────────────────
    if blob_storage.template_exists(template_id):
        import time

        suffix = str(int(time.time()))[-4:]
        template_id = f"{category}/{slug}-{suffix}"
        stored_filename = f"{slug}-{suffix}.{ext}"
        logger.info(f"Duplicate detected, using '{template_id}'")

    blob_storage.upload_template(
        template_id=template_id,
        file_bytes=file_bytes,
        filename=stored_filename,
        metadata=metadata,
    )

    # ── Step 4: Extract schema ───────────────────────────
    has_schema = False
    try:
        await extract_and_store_schema(template_id, metadata["name"], template_format)
        has_schema = True
    except Exception as e:
        logger.error(f"Schema extraction failed for '{template_id}': {e}")

    return TemplateResponse(
        id=template_id,
        name=metadata["name"],
        description=metadata.get("description", ""),
        category=metadata.get("category", "rapport-ai"),
        insurance_id=metadata.get("insurance_id", ""),
        insurance_name=metadata.get("insurance_name", ""),
        canton=metadata.get("canton", "all"),
        estimated_minutes=int(metadata.get("estimated_minutes", "5")),
        page_count=int(metadata.get("page_count", "1")),
        is_official=metadata.get("is_official", "false").lower() == "true",
        has_schema=has_schema,
        filename=stored_filename,
        size=len(file_bytes),
    )


def _extract_pdf_text_for_classification(pdf_bytes: bytes) -> bytes:
    """Extract text from PDF for the classifier (returns fake docx bytes marker).

    We pass the raw PDF bytes — the classifier will handle it.
    """
    return pdf_bytes


async def extract_and_store_schema(
    template_id: str,
    template_name: str,
    template_format: str = "docx",
) -> TemplateSchema:
    """Run Pass 1: extract raw slots, label them with LLM, store schema."""
    logger.info(
        f"Extracting schema for template '{template_id}' ({template_name}, {template_format})"
    )

    file_bytes = blob_storage.download_template(template_id)
    raw_slots = extract_raw_slots(file_bytes)
    logger.info(f"Found {len(raw_slots)} raw slots")

    schema = await label_slots(raw_slots, template_name)
    schema.template_id = template_id
    schema.template_format = template_format

    blob_storage.upload_schema(template_id, schema.model_dump())
    logger.info(
        f"Schema stored: {len(schema.fields)} fields, "
        f"{len(set(f.section for f in schema.fields))} sections"
    )

    return schema


def get_schema(template_id: str) -> TemplateSchema | None:
    """Load a stored schema from blob storage."""
    data = blob_storage.download_schema(template_id)
    if data is None:
        return None
    return TemplateSchema(**data)
