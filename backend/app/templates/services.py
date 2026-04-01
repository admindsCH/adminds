"""Template services — orchestrates upload, classification, extraction, and storage.

Supports both .docx and .pdf templates:
- DOCX: stored as-is, XML-based slot extraction
- PDF:  stored as-is, AcroForm field extraction via PyMuPDF
"""

from __future__ import annotations

import asyncio
import re
import unicodedata

from fastapi import HTTPException
from fastapi.responses import Response
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


def list_templates(user_id: str) -> list[TemplateResponse]:
    """List templates owned by *user_id*."""
    return blob_storage.list_templates(user_id)


def delete_template(user_id: str, template_id: str) -> None:
    """Delete a template and its schema."""
    try:
        blob_storage.delete_template(user_id, template_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


def rename_template(user_id: str, template_id: str, new_name: str) -> None:
    """Rename a template by updating its blob metadata."""
    try:
        meta = blob_storage.get_template_metadata(user_id, template_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Template introuvable")
    meta["name"] = new_name
    blob_storage.update_template_metadata(user_id, template_id, meta)


async def extract_schema(user_id: str, template_id: str) -> ExtractSchemaResponse:
    """Run or re-run schema extraction on a template."""
    try:
        meta = blob_storage.get_template_metadata(user_id, template_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Template introuvable")
    template_name = meta.get("name", template_id)
    schema = await extract_and_store_schema(user_id, template_id, template_name)
    return ExtractSchemaResponse(
        template_id=template_id,
        field_count=len(schema.fields),
        sections=sorted({f.section for f in schema.fields}),
    )


def get_schema_dict(user_id: str, template_id: str) -> dict:
    """Return a stored schema as a dict, or raise 404."""
    schema = get_schema(user_id, template_id)
    if schema is None:
        raise HTTPException(
            status_code=404,
            detail="Schema non trouvé. Lancez l'extraction d'abord.",
        )
    return schema.model_dump()


def update_schema(user_id: str, template_id: str, request: UpdateSchemaRequest) -> dict:
    """Validate and persist an updated schema."""
    schema = get_schema(user_id, template_id)
    if schema is None:
        raise HTTPException(status_code=404, detail="Schema non trouvé.")
    ids = [f.id for f in request.fields]
    dupes = [fid for fid in ids if ids.count(fid) > 1]
    if dupes:
        raise HTTPException(status_code=400, detail=f"IDs dupliqués: {set(dupes)}")
    schema.fields = request.fields
    blob_storage.upload_schema(user_id, template_id, schema.model_dump())
    return schema.model_dump()


async def upload_and_extract(
    user_id: str,
    file_bytes: bytes,
    filename: str,
) -> TemplateResponse:
    """Full upload pipeline: classify → store → extract schema.

    1. Detect format (PDF or DOCX)
    2. Classify the template with LLM (auto-name, category, canton, insurance)
    3. Upload original file to blob storage
    4. Extract schema (Pass 1) — XML for DOCX, AcroForm for PDF

    Args:
        user_id: Owner's Clerk user ID.
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

    # ── Step 1: Classify + extract raw slots in parallel ──
    # Classification (LLM) and slot extraction (CPU) are independent,
    # so we run them concurrently to cut ~30-50% of total time.
    classify_bytes = file_bytes

    async def _classify():
        try:
            return await classify_template(classify_bytes, is_pdf=is_pdf)
        except Exception as e:
            logger.error(f"Classification failed for '{filename}': {e}")
            return {
                "name": filename.rsplit(".", 1)[0],
                "description": "Formulaire importe",
                "category": "rapport-medical",
                "canton": "all",
                "insurance_id": "",
                "page_count": "1",
                "estimated_minutes": "3",
                "is_official": "false",
            }

    async def _extract():
        # extract_raw_slots is sync/CPU, run in thread to not block event loop
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, extract_raw_slots, file_bytes)

    metadata, raw_slots = await asyncio.gather(_classify(), _extract())

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
    if blob_storage.template_exists(user_id, template_id):
        import time

        suffix = str(int(time.time()))[-4:]
        template_id = f"{category}/{slug}-{suffix}"
        stored_filename = f"{slug}-{suffix}.{ext}"
        logger.info(f"Duplicate detected, using '{template_id}'")

    blob_storage.upload_template(
        user_id=user_id,
        template_id=template_id,
        file_bytes=file_bytes,
        filename=stored_filename,
        metadata=metadata,
    )

    # ── Step 4: Label slots + store schema ─────────────────
    try:
        await label_and_store_schema(
            user_id, template_id, metadata["name"], template_format, raw_slots
        )
    except Exception as e:
        logger.error(f"Schema extraction failed for '{template_id}': {e}")
        # Roll back: remove the blob so we don't leave a broken template
        try:
            blob_storage.delete_template(user_id, template_id)
            logger.info(f"Rolled back blob upload for '{template_id}'")
        except Exception:
            logger.warning(f"Failed to roll back blob for '{template_id}'")
        raise HTTPException(
            status_code=422,
            detail=f"Impossible d'extraire le schéma du fichier '{filename}'. Vérifiez que le fichier est un .docx ou .pdf valide.",
        )

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
        has_schema=True,
        filename=stored_filename,
        size=len(file_bytes),
    )


def download_template(user_id: str, template_id: str) -> Response:
    """Download a template file as an HTTP response."""
    file_bytes = blob_storage.download_template(user_id, template_id)
    meta = blob_storage.get_template_metadata(user_id, template_id)
    fmt = meta.get("template_format", "docx")
    content_type = (
        "application/pdf"
        if fmt == "pdf"
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    return Response(content=file_bytes, media_type=content_type)


async def label_and_store_schema(
    user_id: str,
    template_id: str,
    template_name: str,
    template_format: str = "docx",
    raw_slots: list | None = None,
) -> TemplateSchema:
    """Label pre-extracted raw slots with LLM and store the schema.

    If raw_slots is None, falls back to downloading + extracting.
    """
    logger.info(
        f"Labeling schema for template '{template_id}' ({template_name}, {template_format})"
    )

    if raw_slots is None:
        file_bytes = blob_storage.download_template(user_id, template_id)
        raw_slots = extract_raw_slots(file_bytes)

    logger.info(f"Found {len(raw_slots)} raw slots")

    schema = await label_slots(raw_slots, template_name)
    schema.template_id = template_id
    schema.template_format = template_format

    blob_storage.upload_schema(user_id, template_id, schema.model_dump())
    logger.info(
        f"Schema stored: {len(schema.fields)} fields, "
        f"{len(set(f.section for f in schema.fields))} sections"
    )

    return schema


async def extract_and_store_schema(
    user_id: str,
    template_id: str,
    template_name: str,
    template_format: str = "docx",
) -> TemplateSchema:
    """Run full extraction: extract raw slots, label with LLM, store schema."""
    return await label_and_store_schema(
        user_id, template_id, template_name, template_format
    )


def get_schema(user_id: str, template_id: str) -> TemplateSchema | None:
    """Load a stored schema from blob storage."""
    data = blob_storage.download_schema(user_id, template_id)
    if data is None:
        return None
    return TemplateSchema(**data)
