"""Schemas for report generation."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class GenerateReportRequest(BaseModel):
    """Request body for POST /api/generate-report."""

    dossier_id: str
    canton: Literal["fribourg", "geneve"] = "fribourg"
    template_id: str | None = None  # generic engine — overrides canton


class FieldSchemaEntry(BaseModel):
    """One field descriptor from the canton field map."""

    id: str
    type: str
    label: str
    section: str
    section_number: str = ""
    hint: str = ""
    options: list[str] = []


class GenerateReportResponse(BaseModel):
    """Response from POST /api/generate-report.

    Returns the LLM-generated field values, the field schema (so the
    frontend knows labels/types/sections), and the filled docx as base64.
    """

    field_values: dict[str, Any]
    field_schema: list[FieldSchemaEntry]
    docx_base64: str


class UpdateReportRequest(BaseModel):
    """Request body for POST /api/update-report.

    The frontend sends back edited field values; the backend re-fills the
    template and returns the updated docx.
    """

    dossier_id: str
    canton: Literal["fribourg", "geneve"] = "fribourg"
    template_id: str | None = None  # generic engine — overrides canton
    field_values: dict[str, Any]


class UpdateReportResponse(BaseModel):
    """Response from POST /api/update-report."""

    docx_base64: str


class RegenerateFieldRequest(BaseModel):
    """Request body for POST /api/regenerate-field."""

    dossier_id: str
    template_id: str
    field_id: str
    instruction: str | None = None


class RegenerateFieldResponse(BaseModel):
    """Response from POST /api/regenerate-field."""

    field_id: str
    value: str
