from __future__ import annotations

from fastapi import UploadFile
from langchain_core.messages import HumanMessage, SystemMessage
from loguru import logger

from app.classification import crud
from app.classification.constants import (
    CHAT_SYSTEM_PROMPT,
    CLASSIFICATION_SYSTEM_PROMPT,
)
from app.classification.helpers import extract_text
from app.classification.schemas import (
    ChatResponse,
    ClassifiedDocument,
    DocumentClassification,
    DossierResponse,
    PatientDossier,
    PatientDossierPatch,
)
from app.rubriques.extraction import extract_dossier
from app.services.azure_openai import ainvoke_throttled, get_model


async def classify_document(file: UploadFile) -> ClassifiedDocument:
    """Classify a single file (category + summary + author).

    Extracts text via LiteParse, sends it to GPT with structured output,
    returns the classification.
    """
    filename = file.filename or "unknown"
    file_bytes = await file.read()
    text = extract_text(filename, file_bytes)

    structured = get_model().with_structured_output(DocumentClassification)

    logger.info(f"Classifying '{filename}' ({len(text)} chars)...")
    classification = await ainvoke_throttled(
        structured,
        [
            SystemMessage(content=CLASSIFICATION_SYSTEM_PROMPT),
            HumanMessage(content=f"Document: {filename}\n\n{text}"),
        ],
    )
    logger.info(f"Classified '{filename}' → {classification.category}")

    return ClassifiedDocument(filename=filename, classification=classification)


async def classify_documents(files: list[UploadFile]) -> list[ClassifiedDocument]:
    """Classify multiple uploaded files independently."""
    results: list[ClassifiedDocument] = []

    for file in files:
        try:
            classified = await classify_document(file)
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


async def answer_dossier_question(question: str, raw_content: str) -> ChatResponse:
    """Answer a free-form question about the patient dossier."""
    model = get_model()
    response = await ainvoke_throttled(
        model,
        [
            SystemMessage(content=CHAT_SYSTEM_PROMPT),
            HumanMessage(
                content=f"DOSSIER PATIENT:\n\n{raw_content}\n\n---\n\nQUESTION: {question}"
            ),
        ],
    )
    return ChatResponse(answer=response.content)
