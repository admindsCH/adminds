"""Template management API routes."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services import blob_storage
from app.templates import services
from app.templates.schemas import ExtractSchemaResponse, TemplateResponse  # noqa: F401 — used in response_model

router = APIRouter(prefix="/templates", tags=["templates"])


@router.post("", response_model=TemplateResponse)
async def upload_template(
    file: UploadFile = File(...),
) -> TemplateResponse:
    """Upload a template (.docx or .pdf).

    The backend automatically:
    1. Converts PDF to DOCX if needed (via Document Intelligence)
    2. Classifies the template (name, category, canton, insurance)
    3. Extracts the field schema (Pass 1)

    No manual metadata needed — everything is auto-detected.
    """
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Fichier vide")

    filename = file.filename or "template.docx"

    # Validate file type
    is_pdf = file_bytes[:4] == b"%PDF"
    is_docx = file_bytes[:2] == b"PK"
    if not is_pdf and not is_docx:
        raise HTTPException(
            status_code=400,
            detail="Format non supporté. Veuillez importer un fichier .docx ou .pdf.",
        )

    return await services.upload_and_extract(file_bytes, filename)


@router.get("", response_model=list[TemplateResponse])
async def list_templates() -> list[TemplateResponse]:
    """List all available templates."""
    return blob_storage.list_templates()


@router.delete("/{template_id:path}", status_code=204)
async def delete_template(template_id: str) -> None:
    """Delete a template and its schema."""
    try:
        blob_storage.delete_template(template_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{template_id:path}/extract-schema", response_model=ExtractSchemaResponse)
async def extract_schema(template_id: str) -> ExtractSchemaResponse:
    """Run or re-run schema extraction (Pass 1) on a template."""
    try:
        meta = blob_storage.get_template_metadata(template_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Template introuvable")

    template_name = meta.get("name", template_id)
    schema = await services.extract_and_store_schema(template_id, template_name)

    return ExtractSchemaResponse(
        template_id=template_id,
        field_count=len(schema.fields),
        sections=sorted(set(f.section for f in schema.fields)),
    )


@router.get("/{template_id:path}/schema")
async def get_schema(template_id: str) -> dict:
    """Get the extracted schema for a template."""
    schema = services.get_schema(template_id)
    if schema is None:
        raise HTTPException(
            status_code=404,
            detail="Schema non trouvé. Lancez l'extraction d'abord.",
        )
    return schema.model_dump()
