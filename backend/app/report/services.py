"""Report generation services.

All report generation goes through the generic template engine:
1. Load template schema from blob storage
2. Build system prompt with field schema
3. LLM fills field values from patient dossier
4. Generic filler writes values into the template (.docx or .pdf)
"""

from __future__ import annotations

import base64
import json
from typing import Any

from fastapi import HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from loguru import logger

from app.classification import store
from app.classification.schemas import PatientDossier
from app.report.constants import build_system_prompt
from app.services import blob_storage
from app.services.azure_openai import get_model
from app.templates.generic_filler import fill_template
from app.templates.pdf_filler import fill_pdf_template
from app.templates.services import get_schema


def _build_patient_context(dossier: PatientDossier) -> str:
    """Serialize the dossier data into a readable text block for the LLM."""
    parts: list[str] = []

    if dossier.raw_content:
        parts.append(
            "RAW_CONTENT (dossier patient brut — source de vérité):\n\n"
            + dossier.raw_content
        )

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

    rub = dossier.rubriques
    rubrique_names = {
        "r01_historique": "R01 HISTORIQUE",
        "r02_clinique": "R02 CLINIQUE",
        "r03_traitement": "R03 TRAITEMENT",
        "r04_professionnel": "R04 PROFESSIONNEL",
        "r05_capacite_travail": "R05 CAPACITÉ TRAVAIL",
        "r06_readaptation": "R06 RÉADAPTATION",
        "r07_freins_cognition": "R07 FREINS & COGNITION",
        "r08_activites": "R08 ACTIVITÉS",
    }
    for field_name, display_name in rubrique_names.items():
        rubrique = getattr(rub, field_name)
        lines = []
        for sub_field, value in rubrique.model_dump().items():
            if not value:
                continue
            label = sub_field.replace("_", " ").capitalize()
            if isinstance(value, str):
                lines.append(f"  {label}: {value}")
            elif isinstance(value, list) and value:
                lines.append(f"  {label}:")
                for item in value:
                    if isinstance(item, dict):
                        summary = ", ".join(
                            f"{k}: {v}" for k, v in item.items() if v is not None
                        )
                        lines.append(f"    - {summary}")
        if lines:
            parts.append(f"{display_name}:\n" + "\n".join(lines))

    if dossier.notes:
        parts.append(f"NOTES DU MÉDECIN TRAITANT:\n{dossier.notes}")

    return "\n\n".join(parts)


async def generate_report(
    dossier_id: str,
    canton: str,
    template_id: str | None = None,
) -> dict[str, Any]:
    """Generate a filled report from a stored dossier.

    Args:
        dossier_id: Server-side dossier ID.
        canton: Canton key (used for legacy compat, ignored if template_id given).
        template_id: Blob storage template ID (e.g. "rapport-ai/rapport-ai-fribourg").
    """
    if not template_id:
        raise HTTPException(
            status_code=400,
            detail="template_id est requis. Sélectionnez un template.",
        )

    # 1. Fetch dossier
    dossier = store.get_dossier(dossier_id)
    if dossier is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    # 2. Load schema
    schema = get_schema(template_id)
    if schema is None:
        raise HTTPException(
            status_code=400,
            detail="Schema non trouvé pour ce template. Lancez l'extraction d'abord.",
        )

    # 3. Build patient context
    patient_context = _build_patient_context(dossier)

    # 4. Build prompt schema (strip positions)
    prompt_schema = schema.to_prompt_schema()

    system_prompt = build_system_prompt(
        canton_name=schema.template_name,
        field_schema=json.dumps(prompt_schema, ensure_ascii=False, indent=2),
    )

    logger.info(
        f"Generating report: template_id={template_id}, "
        f"dossier_id={dossier_id}, {len(prompt_schema)} fields"
    )

    # 5. Call LLM
    model = get_model(model_kwargs={"response_format": {"type": "json_object"}})
    response = await model.ainvoke(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=patient_context),
        ]
    )

    field_values: dict[str, Any] = json.loads(response.content)
    field_values = {k: v for k, v in field_values.items() if v is not None}

    logger.info(f"LLM returned {len(field_values)} field values")

    # 6. Fill template
    template_bytes = blob_storage.download_template(template_id)
    filled_bytes = _fill(schema, template_bytes, field_values)

    # 7. Persist
    store.save_field_values(dossier_id, field_values)
    report_path = store.save_report(dossier_id, filled_bytes)
    logger.info(f"Report generated: {len(filled_bytes)} bytes, saved to {report_path}")

    return {
        "field_values": field_values,
        "field_schema": prompt_schema,
        "docx_base64": base64.b64encode(filled_bytes).decode("ascii"),
    }


async def update_report(
    dossier_id: str,
    canton: str,
    field_values: dict[str, Any],
    template_id: str | None = None,
) -> dict[str, Any]:
    """Re-fill the template with user-edited field values."""
    if store.get_dossier(dossier_id) is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    if not template_id:
        raise HTTPException(status_code=400, detail="template_id est requis.")

    field_values = {k: v for k, v in field_values.items() if v is not None}

    schema = get_schema(template_id)
    if schema is None:
        raise HTTPException(status_code=400, detail="Schema non trouvé")

    template_bytes = blob_storage.download_template(template_id)
    filled_bytes = _fill(schema, template_bytes, field_values)

    store.save_field_values(dossier_id, field_values)
    report_path = store.save_report(dossier_id, filled_bytes)
    logger.info(f"Report updated: {len(filled_bytes)} bytes, saved to {report_path}")

    return {
        "docx_base64": base64.b64encode(filled_bytes).decode("ascii"),
    }


def _fill(schema, template_bytes: bytes, field_values: dict[str, Any]) -> bytes:
    """Fill a template based on its format (docx or pdf)."""
    if schema.template_format == "pdf":
        return fill_pdf_template(template_bytes, field_values)
    return fill_template(template_bytes, schema, field_values)
