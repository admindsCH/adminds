from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from loguru import logger

from app.classification import store
from app.classification.schemas import PatientDossier
from app.report.constants import build_system_prompt
from app.services.azure_openai import get_model
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


def _build_patient_context(dossier: PatientDossier) -> str:
    """Serialize the dossier data into a readable text block for the LLM.

    The LLM uses this context to fill each form field.
    """
    parts: list[str] = []

    # 1. Raw content — source of truth
    if dossier.raw_content:
        parts.append(
            "RAW_CONTENT (dossier patient brut — source de vérité):\n\n"
            + dossier.raw_content
        )

    # 2. Patient info
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

    # 3. Rubriques — structured clinical data (prose + structured lists)
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

    # 5. Notes
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


def _fill_template(
    canton: str, template_path: str, field_values: dict[str, Any]
) -> bytes:
    """Fill the docx template for the given canton. Returns docx bytes."""
    if canton == "fribourg":
        return fill_fribourg_template(template_path, field_values)
    else:
        return fill_geneve_template(template_path, field_values)


async def generate_report(
    dossier_id: str,
    canton: str,
    template_id: str | None = None,
) -> dict[str, Any]:
    """Generate a filled .docx report from a stored dossier.

    If template_id is provided, uses the generic template engine.
    Otherwise, falls back to the legacy canton-specific path.
    """
    # 1. Fetch dossier
    dossier = store.get_dossier(dossier_id)
    if dossier is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    # 2. Build patient context
    patient_context = _build_patient_context(dossier)

    # ── Generic template path ────────────────────────────
    if template_id:
        return await _generate_with_template(dossier_id, template_id, patient_context)

    # ── Legacy canton path ───────────────────────────────
    return await _generate_with_canton(dossier_id, canton, patient_context)


async def _generate_with_template(
    dossier_id: str,
    template_id: str,
    patient_context: str,
) -> dict[str, Any]:
    """Generate report using the generic template engine."""
    from app.services import blob_storage
    from app.templates.generic_filler import fill_template
    from app.templates.services import get_schema

    # Load schema
    schema = get_schema(template_id)
    if schema is None:
        raise HTTPException(
            status_code=400,
            detail="Schema non trouvé pour ce template. Lancez l'extraction d'abord.",
        )

    # Load template bytes
    template_bytes = blob_storage.download_template(template_id)

    # Build prompt schema (strip positions)
    prompt_schema = schema.to_prompt_schema()

    # Build system prompt with dynamic addendum
    system_prompt = build_system_prompt(
        canton_name=schema.template_name,
        field_schema=json.dumps(prompt_schema, ensure_ascii=False, indent=2),
        canton_addendum=schema.canton_addendum,
    )

    logger.info(
        f"Generating report: template_id={template_id}, "
        f"dossier_id={dossier_id}, {len(prompt_schema)} fields"
    )

    # Call LLM
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

    # Fill template
    docx_bytes = fill_template(template_bytes, schema, field_values)

    # Persist
    store.save_field_values(dossier_id, field_values)
    report_path = store.save_report(dossier_id, docx_bytes)
    logger.info(f"Report generated: {len(docx_bytes)} bytes, saved to {report_path}")

    return {
        "field_values": field_values,
        "field_schema": prompt_schema,
        "docx_base64": base64.b64encode(docx_bytes).decode("ascii"),
    }


async def _generate_with_canton(
    dossier_id: str,
    canton: str,
    patient_context: str,
) -> dict[str, Any]:
    """Generate report using the legacy canton-specific path."""
    field_schema, template_path, canton_name = _get_canton_config(canton)

    system_prompt = build_system_prompt(
        canton_name=canton_name,
        field_schema=json.dumps(field_schema, ensure_ascii=False, indent=2),
        canton_key=canton,
    )

    logger.info(
        f"Generating report: canton={canton}, dossier_id={dossier_id}, "
        f"{len(field_schema)} fields in schema"
    )

    model = get_model(model_kwargs={"response_format": {"type": "json_object"}})
    response = await model.ainvoke(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=patient_context),
        ]
    )

    field_values: dict[str, Any] = json.loads(response.content)
    field_values = {k: v for k, v in field_values.items() if v is not None}

    logger.info(f"LLM returned {len(field_values)} field values for {canton} report")

    docx_bytes = _fill_template(canton, template_path, field_values)

    store.save_field_values(dossier_id, field_values)
    report_path = store.save_report(dossier_id, docx_bytes)
    logger.info(f"Report generated: {len(docx_bytes)} bytes, saved to {report_path}")

    return {
        "field_values": field_values,
        "field_schema": field_schema,
        "docx_base64": base64.b64encode(docx_bytes).decode("ascii"),
    }


async def update_report(
    dossier_id: str,
    canton: str,
    field_values: dict[str, Any],
    template_id: str | None = None,
) -> dict[str, Any]:
    """Re-fill the docx template with user-edited field values.

    Saves the updated field values and docx to disk, then returns
    the new docx as base64.
    """
    if store.get_dossier(dossier_id) is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    field_values = {k: v for k, v in field_values.items() if v is not None}

    if template_id:
        from app.services import blob_storage
        from app.templates.generic_filler import fill_template
        from app.templates.services import get_schema

        schema = get_schema(template_id)
        if schema is None:
            raise HTTPException(status_code=400, detail="Schema non trouvé")

        template_bytes = blob_storage.download_template(template_id)
        docx_bytes = fill_template(template_bytes, schema, field_values)
    else:
        _, template_path, _ = _get_canton_config(canton)
        docx_bytes = _fill_template(canton, template_path, field_values)

    store.save_field_values(dossier_id, field_values)
    report_path = store.save_report(dossier_id, docx_bytes)
    logger.info(f"Report updated: {len(docx_bytes)} bytes, saved to {report_path}")

    return {
        "docx_base64": base64.b64encode(docx_bytes).decode("ascii"),
    }
