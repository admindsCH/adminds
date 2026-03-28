from __future__ import annotations

from fastapi import APIRouter

from app.report import services
from app.report.schemas import (
    GenerateReportRequest,
    GenerateReportResponse,
    RegenerateFieldRequest,
    RegenerateFieldResponse,
    UpdateReportRequest,
    UpdateReportResponse,
)

router = APIRouter(tags=["report"])


@router.post("/generate-report", response_model=GenerateReportResponse)
async def generate_report(request: GenerateReportRequest) -> GenerateReportResponse:
    """Generate a filled report from a stored dossier."""
    return await services.generate_report(
        request.dossier_id, request.template_id, request.doctor_name, request.doctor_profile
    )


@router.post("/update-report", response_model=UpdateReportResponse)
async def update_report(request: UpdateReportRequest) -> UpdateReportResponse:
    """Re-fill the template with user-edited field values."""
    return await services.update_report(
        request.dossier_id, request.field_values, request.template_id
    )


@router.post("/regenerate-field", response_model=RegenerateFieldResponse)
async def regenerate_field(request: RegenerateFieldRequest) -> RegenerateFieldResponse:
    """Regenerate a single field with optional doctor instructions."""
    return await services.regenerate_field(
        request.dossier_id, request.template_id, request.field_id,
        request.instruction, request.doctor_name, request.doctor_profile,
    )
