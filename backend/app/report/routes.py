"""Report generation routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.report import services
from app.report.schemas import (
    GenerateReportRequest,
    GenerateReportResponse,
    UpdateReportRequest,
    UpdateReportResponse,
)

router = APIRouter(tags=["report"])


@router.post("/generate-report", response_model=GenerateReportResponse)
async def generate_report(request: GenerateReportRequest) -> GenerateReportResponse:
    """Generate a filled .docx report from a stored dossier.

    Returns field_values (LLM output), field_schema (canton-specific field
    definitions), and the filled docx as base64.
    """
    result = await services.generate_report(
        request.dossier_id, request.canton, request.template_id
    )
    return GenerateReportResponse(**result)


@router.post("/update-report", response_model=UpdateReportResponse)
async def update_report(request: UpdateReportRequest) -> UpdateReportResponse:
    """Re-fill the docx template with user-edited field values.

    Returns the updated docx as base64.
    """
    result = await services.update_report(
        request.dossier_id, request.canton, request.field_values, request.template_id
    )
    return UpdateReportResponse(**result)
