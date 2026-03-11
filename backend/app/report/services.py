"""Report generation service.

Takes a stored PatientDossier, uses GPT-4o to map semantic fields to
canton-specific form values, then fills the .docx template.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI
from loguru import logger

from app.classification import store
from app.classification.schemas import PatientDossier
from app.config import settings
from app.report.constants import REPORT_SYSTEM_PROMPT
from app.services.docx_filler import fill_fribourg_template
from app.services.docx_filler_geneve import fill_geneve_template
from app.services.fribourg_field_map import (
    get_ai_prompt_schema as fribourg_schema,
)
from app.services.geneve_field_map import (
    get_ai_prompt_schema as geneve_schema,
)

# Templates directory — sibling to the app/ package.
TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates"


def _get_model() -> AzureChatOpenAI:
    """Create the Azure OpenAI chat model with JSON response format.

    Same factory as classification/services.py but with JSON mode enabled
    so the model returns a parseable JSON object (not Pydantic structured output).
    """
    return AzureChatOpenAI(
        azure_deployment=settings.azure_openai_deployment,
        api_key=settings.azure_openai_api_key,
        azure_endpoint=settings.azure_openai_endpoint,
        api_version=settings.azure_openai_api_version,
        temperature=0,
        model_kwargs={"response_format": {"type": "json_object"}},
    )


def _build_patient_context(dossier: PatientDossier) -> str:
    """Serialize the dossier data into a readable text block for the LLM.

    The LLM uses this context to fill each form field.
    """
    parts: list[str] = []

    # --- Raw content first (source of truth, matches prompt "raw_content") ---
    if dossier.raw_content:
        parts.append(
            "RAW_CONTENT (dossier patient brut — source de vérité):\n\n"
            + dossier.raw_content
        )

    # --- Patient info ---
    pi = dossier.patient_info
    info_lines = []
    if pi.age is not None:
        info_lines.append(f"Âge: {pi.age} ans")
    if pi.sexe and pi.sexe != "inconnu":
        info_lines.append(f"Sexe: {pi.sexe}")
    if pi.situation_sociale:
        info_lines.append(f"Situation sociale: {pi.situation_sociale}")
    if pi.antecedents:
        info_lines.append(f"Antécédents: {pi.antecedents}")
    if info_lines:
        parts.append("INFORMATIONS PATIENT:\n" + "\n".join(info_lines))

    # --- rapport_ai_fields deliberately excluded ---
    # These are Step 2 summaries that may be frozen at an intermediate
    # point in the timeline.  raw_content + timeline + diagnostics +
    # medications already carry all the information the LLM needs, so
    # injecting a lossy pre-summary only risks contaminating the output.

    # --- Diagnostics ---
    if dossier.diagnostics:
        diag_lines = []
        for d in dossier.diagnostics:
            code = f" ({d.code_cim})" if d.code_cim else ""
            diag_lines.append(f"- {d.label}{code} [{d.type}]")
        parts.append("DIAGNOSTICS:\n" + "\n".join(diag_lines))

    # --- Medications ---
    if dossier.medications:
        med_lines = []
        for m in dossier.medications:
            dosage = f" {m.dosage}" if m.dosage else ""
            date = f" (depuis {m.date})" if m.date else ""
            med_lines.append(f"- {m.nom}{dosage}{date}")
        parts.append("MÉDICATION:\n" + "\n".join(med_lines))

    # --- Timeline (chronological events) ---
    if dossier.timeline:
        tl_lines = []
        for entry in dossier.timeline:
            date = entry.date or "date inconnue"
            source = f" — {entry.source}" if entry.source else ""
            tl_lines.append(f"[{date}] {entry.title}{source}: {entry.summary}")
        parts.append("CHRONOLOGIE:\n" + "\n".join(tl_lines))

    # --- Notes from the psychiatrist ---
    if dossier.notes:
        parts.append(f"NOTES DU MÉDECIN TRAITANT:\n{dossier.notes}")

    return "\n\n".join(parts)


def _get_canton_config(canton: str) -> tuple[list[dict], str, str]:
    """Return (field_schema, template_path, canton_name) for a canton.

    Raises HTTPException 400 for unknown cantons.
    """
    if canton == "fribourg":
        return fribourg_schema(), str(TEMPLATES_DIR / "fribourg.docx"), "Fribourg"
    elif canton == "geneve":
        return geneve_schema(), str(TEMPLATES_DIR / "geneve.docx"), "Genève"
    else:
        raise HTTPException(status_code=400, detail=f"Canton inconnu: {canton}")


def _fill_template(canton: str, template_path: str, field_values: dict[str, Any]) -> bytes:
    """Fill the docx template for the given canton. Returns docx bytes."""
    if canton == "fribourg":
        return fill_fribourg_template(template_path, field_values)
    else:
        return fill_geneve_template(template_path, field_values)


async def generate_report(dossier_id: str, canton: str) -> dict[str, Any]:
    """Generate a filled .docx report from a stored dossier.

    Returns a dict with field_values, field_schema, and docx_base64
    so the frontend can populate the editor and render the preview.
    """
    # 1. Fetch dossier
    dossier = store.get_dossier(dossier_id)
    if dossier is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    # 2. Build patient context
    patient_context = _build_patient_context(dossier)

    # 3. Get canton-specific field schema and template path
    field_schema, template_path, canton_name = _get_canton_config(canton)

    # 4. Format the system prompt with the field schema
    system_prompt = REPORT_SYSTEM_PROMPT.format(
        canton_name=canton_name,
        field_schema=json.dumps(field_schema, ensure_ascii=False, indent=2),
    )

    logger.info(
        f"Generating report: canton={canton}, dossier_id={dossier_id}, "
        f"{len(field_schema)} fields in schema"
    )

    # 5. Call GPT-4o in JSON mode
    model = _get_model()
    response = await model.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=patient_context),
    ])

    # Parse the JSON response into a flat dict
    field_values: dict[str, Any] = json.loads(response.content)

    # Remove null values — the fillers skip missing keys
    field_values = {k: v for k, v in field_values.items() if v is not None}

    logger.info(
        f"LLM returned {len(field_values)} field values for {canton} report"
    )

    # 6. Fill the template
    docx_bytes = _fill_template(canton, template_path, field_values)

    # 7. Persist field values and docx to disk
    store.save_field_values(dossier_id, field_values)
    report_path = store.save_report(dossier_id, docx_bytes)
    logger.info(f"Report generated: {len(docx_bytes)} bytes, saved to {report_path}")

    # 8. Return JSON with field_values, schema, and base64-encoded docx
    return {
        "field_values": field_values,
        "field_schema": field_schema,
        "docx_base64": base64.b64encode(docx_bytes).decode("ascii"),
    }


async def update_report(
    dossier_id: str, canton: str, field_values: dict[str, Any]
) -> dict[str, Any]:
    """Re-fill the docx template with user-edited field values.

    Saves the updated field values and docx to disk, then returns
    the new docx as base64.
    """
    # Validate the dossier exists
    if store.get_dossier(dossier_id) is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    # Get canton template path (we don't need field_schema here)
    _, template_path, _ = _get_canton_config(canton)

    # Remove null values
    field_values = {k: v for k, v in field_values.items() if v is not None}

    # Fill the template with edited values
    docx_bytes = _fill_template(canton, template_path, field_values)

    # Persist
    store.save_field_values(dossier_id, field_values)
    report_path = store.save_report(dossier_id, docx_bytes)
    logger.info(f"Report updated: {len(docx_bytes)} bytes, saved to {report_path}")

    return {
        "docx_base64": base64.b64encode(docx_bytes).decode("ascii"),
    }
