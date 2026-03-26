from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator

from fastapi import UploadFile
from fastapi.responses import StreamingResponse
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



def get_dossier(dossier_id: str) -> DossierResponse:
    """Retrieve a stored dossier by ID."""
    return crud.get_dossier(dossier_id)


def patch_dossier(dossier_id: str, patch: PatientDossierPatch) -> DossierResponse:
    """Apply a partial update to a stored dossier."""
    return crud.patch_dossier(dossier_id, patch)


def parse_dossier_stream(files: list[UploadFile]) -> StreamingResponse:
    """Return an SSE StreamingResponse that emits progress as each rubrique is extracted."""
    from app.rubriques.prompts import RUBRIQUE_PROMPTS

    def sse(data: dict) -> str:
        return f"data: {json.dumps(data)}\n\n"

    async def generate() -> AsyncGenerator[str, None]:
        # 1. Extract text from files
        text_parts: list[str] = []
        try:
            for file in files:
                file_bytes = await file.read()
                filename = file.filename or "unknown"
                text = extract_text(filename, file_bytes)
                text_parts.append(f"--- Document: {filename} ---\n{text}")
        except Exception as e:
            yield sse({"type": "error", "message": str(e)})
            return

        combined_text = "\n\n".join(text_parts)
        yield sse({"type": "progress", "step": "extraction"})

        # 2. Queue receives a key each time a rubrique finishes
        queue: asyncio.Queue[str] = asyncio.Queue()

        async def on_step_done(key: str) -> None:
            await queue.put(key)

        # 3. Run all extractions concurrently in the background
        extraction_task = asyncio.create_task(
            extract_dossier(combined_text, on_step_done=on_step_done)
        )

        total_steps = len(RUBRIQUE_PROMPTS) + 1  # rubriques + patient_info
        for _ in range(total_steps):
            key = await queue.get()
            yield sse({"type": "progress", "step": key})

        dossier: PatientDossier = await extraction_task

        # 4. Store and emit the final complete event
        response = crud.create_dossier(dossier)
        yield sse({"type": "complete", "dossier_id": response.dossier_id, "dossier": response.dossier.model_dump()})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def transcribe_audio(file_bytes: bytes, filename: str) -> str:
    """Transcribe audio using Azure OpenAI Whisper deployment."""
    from openai import AzureOpenAI

    from app.config import settings

    client = AzureOpenAI(
        api_key=settings.azure_openai_api_key,
        azure_endpoint=settings.azure_openai_endpoint,
        api_version=settings.azure_openai_api_version,
    )
    logger.info(f"Transcribing audio '{filename}' ({len(file_bytes)} bytes)...")
    result = client.audio.transcriptions.create(
        model=settings.azure_openai_whisper_deployment,
        file=(filename, file_bytes),
        language="fr",
    )
    logger.info(f"Transcription done: {len(result.text)} chars")
    return result.text


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
