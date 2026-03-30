from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response

from app.auth import CurrentUser, get_current_user
from app.templates import services
from app.templates.schemas import (
    ExtractSchemaResponse,
    RenameTemplateRequest,
    TemplateResponse,
    UpdateSchemaRequest,
)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.post("", response_model=TemplateResponse)
async def upload_template(
    user: CurrentUser = Depends(get_current_user),
    file: UploadFile = File(...),
) -> TemplateResponse:
    """Upload a template (.docx or .pdf). Auto-detects format, classifies, extracts schema."""
    return await services.upload_and_extract(
        user.user_id, await file.read(), file.filename or "template.docx"
    )


@router.get("", response_model=list[TemplateResponse])
async def list_templates(
    user: CurrentUser = Depends(get_current_user),
) -> list[TemplateResponse]:
    """List templates owned by the current user."""
    return services.list_templates(user.user_id)


@router.patch("/{template_id:path}/rename", status_code=204)
async def rename_template(
    template_id: str,
    request: RenameTemplateRequest,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Rename a template."""
    services.rename_template(user.user_id, template_id, request.name)


@router.delete("/{template_id:path}", status_code=204)
async def delete_template(
    template_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Delete a template and its schema."""
    services.delete_template(user.user_id, template_id)


@router.get("/{template_id:path}/download")
async def download_template(
    template_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Download the raw template file (PDF or DOCX)."""
    return services.download_template(user.user_id, template_id)


@router.post("/{template_id:path}/extract-schema", response_model=ExtractSchemaResponse)
async def extract_schema(
    template_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> ExtractSchemaResponse:
    """Run or re-run schema extraction on a template."""
    return await services.extract_schema(user.user_id, template_id)


@router.get("/{template_id:path}/schema")
async def get_schema(
    template_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Get the extracted schema for a template."""
    return services.get_schema_dict(user.user_id, template_id)


@router.put("/{template_id:path}/schema")
async def update_schema(
    template_id: str,
    request: UpdateSchemaRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Update the schema for a template (edit labels, hints, delete fields)."""
    return services.update_schema(user.user_id, template_id, request)
