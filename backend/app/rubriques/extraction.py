"""Parallel per-rubrique extraction from patient dossier text.

Runs 9 concurrent LLM calls (8 rubriques + patient_info), each with a
focused prompt. Returns a fully populated PatientDossier.
"""

from __future__ import annotations

import asyncio

from langchain_core.messages import HumanMessage, SystemMessage
from loguru import logger
from pydantic import BaseModel

from app.classification.schemas import PatientDossier, PatientInfo
from app.rubriques.models import (
    R01Historique,
    R02Clinique,
    R03Traitement,
    R04Professionnel,
    R05CapaciteTravail,
    R06Readaptation,
    R07FreinsCognition,
    R08Activites,
    Rubriques,
)
from app.rubriques.prompts import PATIENT_INFO_PROMPT, RUBRIQUE_PROMPTS
from app.services.azure_openai import get_model

# Maps rubrique key → Pydantic model class for structured output.
RUBRIQUE_MODELS: dict[str, type[BaseModel]] = {
    "r01_historique": R01Historique,
    "r02_clinique": R02Clinique,
    "r03_traitement": R03Traitement,
    "r04_professionnel": R04Professionnel,
    "r05_capacite_travail": R05CapaciteTravail,
    "r06_readaptation": R06Readaptation,
    "r07_freins_cognition": R07FreinsCognition,
    "r08_activites": R08Activites,
}


async def _extract_rubrique(
    key: str, prompt: str, model_cls: type[BaseModel], text: str
) -> tuple[str, BaseModel]:
    """Extract a single rubrique via a focused LLM call."""
    logger.info(f"Extracting {key}...")
    structured = get_model().with_structured_output(model_cls)
    result = await structured.ainvoke(
        [
            SystemMessage(content=prompt),
            HumanMessage(content=text),
        ]
    )
    logger.info(f"Extracted {key}")
    return key, result


async def _extract_patient_info(text: str) -> PatientInfo:
    """Extract patient demographics via a focused LLM call."""
    logger.info("Extracting patient_info...")
    structured = get_model().with_structured_output(PatientInfo)
    result = await structured.ainvoke(
        [
            SystemMessage(content=PATIENT_INFO_PROMPT),
            HumanMessage(content=text),
        ]
    )
    logger.info("Extracted patient_info")
    return result


async def extract_dossier(combined_text: str) -> PatientDossier:
    """Run all 9 extraction calls in parallel and assemble a PatientDossier.

    Args:
        combined_text: Concatenated text from all uploaded documents.

    Returns:
        A fully populated PatientDossier with raw_content set.
    """
    # Build coroutines for all 8 rubriques + patient_info.
    tasks = [
        _extract_rubrique(key, prompt, RUBRIQUE_MODELS[key], combined_text)
        for key, prompt in RUBRIQUE_PROMPTS.items()
    ]
    tasks.append(_extract_patient_info(combined_text))

    # Run all 9 calls concurrently.
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Separate patient_info (last result) from rubriques.
    rubrique_results = results[:-1]
    patient_info_result = results[-1]

    # Assemble rubriques.
    rubrique_data: dict[str, BaseModel] = {}
    for res in rubrique_results:
        if isinstance(res, Exception):
            logger.exception(f"Rubrique extraction failed: {res}")
            continue
        key, model = res
        rubrique_data[key] = model

    rubriques = Rubriques(**rubrique_data)

    # Assemble patient_info.
    if isinstance(patient_info_result, Exception):
        logger.exception(f"Patient info extraction failed: {patient_info_result}")
        patient_info = PatientInfo()
    else:
        patient_info = patient_info_result

    return PatientDossier(
        patient_info=patient_info,
        rubriques=rubriques,
        raw_content=combined_text,
    )
