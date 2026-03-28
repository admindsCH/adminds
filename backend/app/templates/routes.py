from __future__ import annotations

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import Response

from app.templates import services
from app.templates.schemas import (
    ExtractSchemaResponse,
    RenameTemplateRequest,
    TemplateResponse,
    UpdateSchemaRequest,
)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.post("", response_model=TemplateResponse)
async def upload_template(file: UploadFile = File(...)) -> TemplateResponse:
    """Upload a template (.docx or .pdf). Auto-detects format, classifies, extracts schema."""
    return await services.upload_and_extract(
        await file.read(), file.filename or "template.docx"
    )


@router.get("", response_model=list[TemplateResponse])
async def list_templates() -> list[TemplateResponse]:
    """List all available templates."""
    return services.list_templates()


@router.patch("/{template_id:path}/rename", status_code=204)
async def rename_template(template_id: str, request: RenameTemplateRequest) -> None:
    """Rename a template."""
    services.rename_template(template_id, request.name)


@router.delete("/{template_id:path}", status_code=204)
async def delete_template(template_id: str) -> None:
    """Delete a template and its schema."""
    services.delete_template(template_id)


@router.get("/{template_id:path}/download")
async def download_template(template_id: str):
    """Download the raw template file (PDF or DOCX)."""
    return services.download_template(template_id)


@router.post("/{template_id:path}/extract-schema", response_model=ExtractSchemaResponse)
async def extract_schema(template_id: str) -> ExtractSchemaResponse:
    """Run or re-run schema extraction on a template."""
    return await services.extract_schema(template_id)


@router.get("/{template_id:path}/schema")
async def get_schema(template_id: str) -> dict:
    """Get the extracted schema for a template."""
    return services.get_schema_dict(template_id)


@router.put("/{template_id:path}/schema")
async def update_schema(template_id: str, request: UpdateSchemaRequest) -> dict:
    """Update the schema for a template (edit labels, hints, delete fields)."""
    return services.update_schema(template_id, request)
