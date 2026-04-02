from __future__ import annotations

from fastapi import APIRouter, Depends

from app.analytics.db import track
from app.auth import CurrentUser, get_current_user
from app.classification.store import get_field_values
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
async def generate_report(
    request: GenerateReportRequest,
    user: CurrentUser = Depends(get_current_user),
) -> GenerateReportResponse:
    """Generate a filled report from a stored dossier."""
    track(user.user_id, "report_generated", {"dossier_id": request.dossier_id, "template_id": request.template_id})
    return await services.generate_report(
        user.user_id, request.dossier_id, request.template_id,
        request.doctor_name, request.doctor_profile,
    )


@router.post("/update-report", response_model=UpdateReportResponse)
async def update_report(
    request: UpdateReportRequest,
    user: CurrentUser = Depends(get_current_user),
) -> UpdateReportResponse:
    """Re-fill the template with user-edited field values."""
    # Capture field diffs: compare previous values with submitted ones
    previous = get_field_values(request.dossier_id) or {}
    changes = []
    for field_id, new_val in request.field_values.items():
        old_val = previous.get(field_id)
        if old_val is not None and str(old_val) != str(new_val):
            changes.append({"field_id": field_id, "old": str(old_val), "new": str(new_val)})
    track(user.user_id, "field_values_edited", {
        "dossier_id": request.dossier_id,
        "template_id": request.template_id,
        "changes": changes,
    })
    return await services.update_report(
        user.user_id, request.dossier_id, request.field_values, request.template_id,
    )


@router.post("/regenerate-field", response_model=RegenerateFieldResponse)
async def regenerate_field(
    request: RegenerateFieldRequest,
    user: CurrentUser = Depends(get_current_user),
) -> RegenerateFieldResponse:
    """Regenerate a single field with optional doctor instructions."""
    # Capture old value before regeneration
    previous = get_field_values(request.dossier_id) or {}
    old_val = previous.get(request.field_id, "")
    result = await services.regenerate_field(
        user.user_id, request.dossier_id, request.template_id, request.field_id,
        request.instruction, request.doctor_name, request.doctor_profile,
    )
    track(user.user_id, "field_regenerated", {
        "dossier_id": request.dossier_id,
        "field_id": request.field_id,
        "old": str(old_val),
        "new": result.value,
        "instruction": request.instruction or "",
    })
    return result
