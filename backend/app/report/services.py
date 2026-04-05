from __future__ import annotations

import asyncio
import base64
import json
from collections import defaultdict
from typing import Any

from fastapi import HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from loguru import logger

from app.classification import store
from app.classification.schemas import PatientDossier
from app.report.constants import build_system_prompt
from app.report.schemas import (
    DoctorProfile,
    GenerateReportResponse,
    RegenerateFieldResponse,
    UpdateReportResponse,
)
from app.services import blob_storage
from app.services.azure_openai import ainvoke_throttled, get_model
from app.templates.generic_filler import fill_template
from app.templates.pdf_filler import fill_pdf_template
from app.templates.services import get_schema


def _build_patient_context(
    dossier: PatientDossier,
    doctor_name: str | None = None,
    doctor_profile: DoctorProfile | None = None,
    relevant_rubriques: set[str] | None = None,
) -> str:
    """Serialize the dossier data into a readable text block for the LLM."""
    parts: list[str] = []

    # Doctor info block
    if doctor_profile and doctor_profile.name:
        lines = [f"MÉDECIN RÉDACTEUR (signataire du rapport): {doctor_profile.name}"]
        if doctor_profile.specialty:
            lines.append(f"  Spécialité: {doctor_profile.specialty}")
        if doctor_profile.cabinet_name:
            lines.append(f"  Cabinet: {doctor_profile.cabinet_name}")
        addr_parts = []
        if doctor_profile.cabinet_address:
            addr_parts.append(doctor_profile.cabinet_address)
        if doctor_profile.cabinet_npa or doctor_profile.cabinet_city:
            addr_parts.append(
                f"{doctor_profile.cabinet_npa or ''} {doctor_profile.cabinet_city or ''}".strip()
            )
        if addr_parts:
            lines.append(f"  Adresse: {', '.join(addr_parts)}")
        parts.append("\n".join(lines))
    elif doctor_name:
        parts.append(
            f"MÉDECIN RÉDACTEUR (signataire du rapport, psychiatre traitant): {doctor_name}"
        )

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
        if relevant_rubriques is not None and field_name not in relevant_rubriques:
            continue
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


async def _generate_section(
    section_name: str,
    section_fields: list[dict[str, Any]],
    canton_name: str,
    patient_context: str,
) -> dict[str, Any]:
    """Call the LLM for a single section's fields.

    Returns a dict mapping field IDs to generated values.
    """
    field_ids = [f["id"] for f in section_fields]
    logger.info(
        f"Section '{section_name}': sending {len(section_fields)} fields to LLM: {field_ids}"
    )

    system_prompt = build_system_prompt(
        canton_name=canton_name,
        field_schema=json.dumps(section_fields, ensure_ascii=False, indent=2),
    )

    model = get_model(model_kwargs={"response_format": {"type": "json_object"}})
    response = await ainvoke_throttled(
        model,
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=patient_context),
        ],
    )

    try:
        values = json.loads(response.content)
    except json.JSONDecodeError as e:
        logger.error(f"Section '{section_name}': LLM returned invalid JSON: {e}")
        return {}
    values = {k: v for k, v in values.items() if v is not None}

    logger.info(f"Section '{section_name}': {len(values)} fields filled")
    logger.info(
        f"Section '{section_name}' field_values: {json.dumps(values, ensure_ascii=False)}"
    )
    return values


async def generate_report(
    user_id: str,
    dossier_id: str,
    template_id: str,
    doctor_name: str | None = None,
    doctor_profile: DoctorProfile | None = None,
) -> GenerateReportResponse:
    """Generate a filled report from a stored dossier."""
    # 1. Fetch dossier
    dossier = store.get_dossier(dossier_id)
    if dossier is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    # 2. Load schema
    schema = get_schema(user_id, template_id)
    if schema is None:
        raise HTTPException(
            status_code=400,
            detail="Schema non trouvé pour ce template. Lancez l'extraction d'abord.",
        )

    # 3. Build prompt schema (strip positions)
    prompt_schema = schema.to_prompt_schema()

    # 4. Group fields by section and generate in parallel
    section_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in prompt_schema:
        section_groups[entry["section"]].append(entry)

    # Build a lookup: field_id → mapped_rubrique
    rubrique_by_field = {
        f.id: f.mapped_rubrique for f in schema.fields if f.mapped_rubrique
    }

    logger.info(
        f"Generating report: template_id={template_id}, "
        f"dossier_id={dossier_id}, {len(prompt_schema)} fields "
        f"across {len(section_groups)} sections"
    )

    # Debug: save generation inputs
    safe_template_id = template_id.replace("/", "_")
    store.save_debug(
        dossier_id, f"gen_{safe_template_id}_prompt_schema.json", prompt_schema
    )
    store.save_debug(
        dossier_id,
        f"gen_{safe_template_id}_sections.json",
        {name: fields for name, fields in section_groups.items()},
    )

    # 5. Build per-section patient context (only relevant rubriques)
    section_tasks = []
    for section_name, section_fields in section_groups.items():
        relevant_rubriques = {
            rubrique_by_field[f["id"]]
            for f in section_fields
            if f["id"] in rubrique_by_field
        }
        section_context = _build_patient_context(
            dossier,
            doctor_name=doctor_name,
            doctor_profile=doctor_profile,
            relevant_rubriques=relevant_rubriques or None,
        )
        logger.info(
            f"Section '{section_name}': {len(section_fields)} fields, "
            f"rubriques={relevant_rubriques or 'all'}"
        )
        section_tasks.append(
            _generate_section(
                section_name=section_name,
                section_fields=section_fields,
                canton_name=schema.template_name,
                patient_context=section_context,
            )
        )

    section_results = await asyncio.gather(*section_tasks)

    field_values: dict[str, Any] = {}
    for section_vals in section_results:
        field_values.update(section_vals)

    logger.info(f"LLM returned {len(field_values)} field values")

    # Post-generation: enforce mutual exclusion on oui/non checkbox pairs
    oui_keys = [k for k in field_values if k.endswith("_oui")]
    fixed_pairs = 0
    for oui_key in oui_keys:
        non_key = oui_key[:-4] + "_non"
        if non_key not in field_values:
            continue
        oui_val = bool(field_values[oui_key])
        non_val = bool(field_values[non_key])
        if oui_val and non_val:
            field_values[non_key] = False
            fixed_pairs += 1
        elif not oui_val and not non_val:
            pass  # LLM chose neither — leave as-is
    if fixed_pairs:
        logger.info(f"Fixed {fixed_pairs} contradictory oui/non checkbox pair(s)")

    # Debug: save per-section results and merged field values
    for (section_name, _), section_vals in zip(section_groups.items(), section_results):
        safe_section = section_name.replace("/", "_").replace(" ", "_")[:50]
        store.save_debug(
            dossier_id,
            f"gen_{safe_template_id}_section_{safe_section}.json",
            section_vals,
        )
    store.save_debug(
        dossier_id, f"gen_{safe_template_id}_merged_field_values.json", field_values
    )

    # 6. Fill template
    template_bytes = blob_storage.download_template(user_id, template_id)
    filled_bytes = _fill(schema, template_bytes, field_values)

    # 7. Persist
    store.save_field_values(dossier_id, field_values)
    report_path = store.save_report(dossier_id, filled_bytes)
    logger.info(f"Report generated: {len(filled_bytes)} bytes, saved to {report_path}")

    return GenerateReportResponse(
        field_values=field_values,
        field_schema=prompt_schema,
        docx_base64=base64.b64encode(filled_bytes).decode("ascii"),
    )


async def update_report(
    user_id: str,
    dossier_id: str,
    field_values: dict[str, Any],
    template_id: str,
) -> UpdateReportResponse:
    """Re-fill the template with user-edited field values."""
    if store.get_dossier(dossier_id) is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    field_values = {k: v for k, v in field_values.items() if v is not None}

    schema = get_schema(user_id, template_id)
    if schema is None:
        raise HTTPException(status_code=400, detail="Schema non trouvé")

    template_bytes = blob_storage.download_template(user_id, template_id)
    filled_bytes = _fill(schema, template_bytes, field_values)

    store.save_field_values(dossier_id, field_values)
    report_path = store.save_report(dossier_id, filled_bytes)
    logger.info(f"Report updated: {len(filled_bytes)} bytes, saved to {report_path}")

    return UpdateReportResponse(
        docx_base64=base64.b64encode(filled_bytes).decode("ascii"),
    )


async def regenerate_field(
    user_id: str,
    dossier_id: str,
    template_id: str,
    field_id: str,
    instruction: str | None = None,
    doctor_name: str | None = None,
    doctor_profile: DoctorProfile | None = None,
) -> dict[str, str]:
    """Regenerate a single field using the patient dossier and optional instructions."""
    dossier = store.get_dossier(dossier_id)
    if dossier is None:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    schema = get_schema(user_id, template_id)
    if schema is None:
        raise HTTPException(status_code=400, detail="Schema non trouvé")

    # Find the target field
    field = next((f for f in schema.fields if f.id == field_id), None)
    if field is None:
        raise HTTPException(status_code=400, detail=f"Champ '{field_id}' introuvable")

    # Build single-field prompt entry
    entry: dict[str, Any] = {
        "id": field.id,
        "type": field.field_type,
        "label": field.label,
        "section": field.section,
    }
    if field.section_number:
        entry["section_number"] = field.section_number
    hint = field.hint or ""
    if instruction:
        hint = (
            f"{hint}. INSTRUCTION DU MÉDECIN: {instruction}"
            if hint
            else f"INSTRUCTION DU MÉDECIN: {instruction}"
        )
    if hint:
        entry["hint"] = hint
    if field.options:
        entry["options"] = field.options

    relevant_rubriques = {field.mapped_rubrique} if field.mapped_rubrique else None
    patient_context = _build_patient_context(
        dossier,
        doctor_name=doctor_name,
        doctor_profile=doctor_profile,
        relevant_rubriques=relevant_rubriques,
    )

    result = await _generate_section(
        section_name=field.section,
        section_fields=[entry],
        canton_name=schema.template_name,
        patient_context=patient_context,
    )

    value = result.get(field_id, "")
    logger.info(f"Regenerated field '{field_id}': {len(str(value))} chars")
    return RegenerateFieldResponse(field_id=field_id, value=str(value))


def _fill(schema, template_bytes: bytes, field_values: dict[str, Any]) -> bytes:
    """Fill a template based on its format (docx or pdf)."""
    if schema.template_format == "pdf":
        return fill_pdf_template(template_bytes, field_values, schema)
    return fill_template(template_bytes, schema, field_values)
