from __future__ import annotations

from fastapi import UploadFile
from langchain_core.messages import HumanMessage, SystemMessage
from loguru import logger

from app.classification import crud
from app.classification.constants import CLASSIFICATION_SYSTEM_PROMPT
from app.classification.helpers import extract_text
from app.classification.schemas import (
    ClassifiedDocument,
    DocumentClassification,
    DossierResponse,
    PatientDossier,
    PatientDossierPatch,
)
from app.rubriques.extraction import extract_dossier
from app.services.azure_openai import get_model


# ---------------------------------------------------------------------------
# Step 1 — Classification
# ---------------------------------------------------------------------------


async def classify_document(filename: str, file_bytes: bytes) -> ClassifiedDocument:
    """Classify a single file (category + summary + author).

    Extracts text via LiteParse, sends it to GPT with structured output,
    returns the classification.
    """
    text = extract_text(filename, file_bytes)

    structured = get_model().with_structured_output(DocumentClassification)

    logger.info(f"Classifying '{filename}' ({len(text)} chars)...")
    classification = await structured.ainvoke(
        [
            SystemMessage(content=CLASSIFICATION_SYSTEM_PROMPT),
            HumanMessage(content=f"Document: {filename}\n\n{text}"),
        ]
    )
    logger.info(f"Classified '{filename}' → {classification.category}")

    return ClassifiedDocument(filename=filename, classification=classification)


async def classify_documents(files: list[UploadFile]) -> list[ClassifiedDocument]:
    """Classify multiple uploaded files independently."""
    results: list[ClassifiedDocument] = []

    for file in files:
        try:
            file_bytes = await file.read()
            classified = await classify_document(file.filename or "unknown", file_bytes)
            results.append(classified)
        except Exception as e:
            logger.exception(f"Classification failed for {file.filename}")
            results.append(
                ClassifiedDocument(
                    filename=file.filename or "unknown",
                    classification=DocumentClassification(
                        category="autre",
                        date=None,
                        author_type="inconnu",
                        summary=f"Erreur: {e}",
                        rubriques=[],
                    ),
                )
            )

    return results


# ---------------------------------------------------------------------------
# Step 2 — Dossier parsing
# ---------------------------------------------------------------------------


async def parse_dossier(files: list[UploadFile]) -> PatientDossier:
    """Parse uploaded medical documents into a structured PatientDossier.

    Extracts text from each file via LiteParse, concatenates with separators,
    then runs 9 parallel LLM calls (8 rubriques + patient_info) for deep extraction.
    """
    text_parts: list[str] = []

    for file in files:
        file_bytes = await file.read()
        filename = file.filename or "unknown"
        text = extract_text(filename, file_bytes)
        logger.info(f"File '{filename}' → {len(text)} chars extracted")
        text_parts.append(f"--- Document: {filename} ---\n{text}")

    combined_text = "\n\n".join(text_parts)

    logger.info(
        f"Parsing dossier: {len(files)} file(s), {len(combined_text)} total chars"
    )

    dossier = await extract_dossier(combined_text)

    logger.info(f"Dossier parsed: {len(dossier.raw_content or '')} chars extracted")

    return dossier


# ---------------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------------


async def parse_and_store_dossier(files: list[UploadFile]) -> DossierResponse:
    """Parse files into a PatientDossier, store it, return with ID."""
    dossier = await parse_dossier(files)
    return crud.create_dossier(dossier)


def get_dossier(dossier_id: str) -> DossierResponse:
    """Retrieve a stored dossier by ID."""
    return crud.get_dossier(dossier_id)


def patch_dossier(dossier_id: str, patch: PatientDossierPatch) -> DossierResponse:
    """Apply a partial update to a stored dossier."""
    return crud.patch_dossier(dossier_id, patch)


# ---------------------------------------------------------------------------
# Dossier chat — answer questions about patient data
# ---------------------------------------------------------------------------

_CHAT_SYSTEM_PROMPT = """\
Tu es un psychiatre expert suisse. Tu reçois le texte intégral extrait \
d'un dossier médical patient et une question du médecin rédacteur.

Réponds de manière précise, factuelle et concise en français. \
Base ta réponse UNIQUEMENT sur le contenu du dossier fourni. \
Cite les dates, auteurs et sources quand c'est pertinent. \
Si l'information n'est pas dans le dossier, dis-le clairement. \
Ne fabrique JAMAIS d'information."""


async def answer_dossier_question(question: str, raw_content: str) -> str:
    """Answer a free-form question about the patient dossier."""
    model = get_model()
    response = await model.ainvoke(
        [
            SystemMessage(content=_CHAT_SYSTEM_PROMPT),
            HumanMessage(
                content=f"DOSSIER PATIENT:\n\n{raw_content}\n\n---\n\nQUESTION: {question}"
            ),
        ]
    )
    return response.content
