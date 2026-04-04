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
    get_classification_prompt,
    get_vision_classification_prompt,
)
from app.classification.helpers import (
    _prepare_image_for_vision,
    extract_text,
    extract_text_vision,
    is_image_file,
)
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


async def _classify_image_vision(
    filename: str,
    file_bytes: bytes,
    doctor_name: str | None = None,
) -> ClassifiedDocument:
    """Classify an image file using GPT vision.

    Sends the image directly to GPT vision for classification + handwriting
    detection in a single call. If manuscrit, also extracts text via vision.
    """
    mime_type, b64 = _prepare_image_for_vision(filename, file_bytes)

    structured = get_model().with_structured_output(DocumentClassification)

    logger.info(f"Classifying image '{filename}' via vision...")
    classification = await ainvoke_throttled(
        structured,
        [
            SystemMessage(content=get_vision_classification_prompt(doctor_name)),
            HumanMessage(
                content=[
                    {"type": "text", "text": f"Document: {filename}"},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{b64}",
                        },
                    },
                ]
            ),
        ],
    )
    logger.info(f"Classified image '{filename}' → {classification.category}")

    # If manuscrit, extract text via vision (LiteParse OCR won't work well)
    extracted_text: str | None = None
    if classification.category == "manuscrit":
        extracted_text = await extract_text_vision(filename, file_bytes)

    return ClassifiedDocument(
        filename=filename,
        classification=classification,
        extracted_text=extracted_text,
    )


async def classify_document(
    file: UploadFile,
    doctor_name: str | None = None,
) -> ClassifiedDocument:
    """Classify a single file (category + summary + author).

    For image files: uses GPT vision (handles handwriting detection).
    For other files: extracts text via LiteParse, classifies via GPT text.
    """
    filename = file.filename or "unknown"
    file_bytes = await file.read()

    # Image files → vision pipeline
    if is_image_file(filename):
        return await _classify_image_vision(filename, file_bytes, doctor_name)

    # Non-image files → LiteParse + text classification
    text = extract_text(filename, file_bytes)

    structured = get_model().with_structured_output(DocumentClassification)

    logger.info(f"Classifying '{filename}' ({len(text)} chars)...")
    classification = await ainvoke_throttled(
        structured,
        [
            SystemMessage(content=get_classification_prompt(doctor_name)),
            HumanMessage(content=f"Document: {filename}\n\n{text}"),
        ],
    )
    logger.info(f"Classified '{filename}' → {classification.category}")

    return ClassifiedDocument(filename=filename, classification=classification)


async def classify_documents(
    files: list[UploadFile],
    doctor_name: str | None = None,
) -> list[ClassifiedDocument]:
    """Classify multiple uploaded files independently."""
    results: list[ClassifiedDocument] = []

    for file in files:
        try:
            classified = await classify_document(file, doctor_name)
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
        # 1. Extract text from files (vision for images, LiteParse for the rest)
        text_parts: list[str] = []
        try:
            for file in files:
                file_bytes = await file.read()
                filename = file.filename or "unknown"
                if is_image_file(filename):
                    # Use vision for images — handles handwritten notes
                    text = await extract_text_vision(filename, file_bytes)
                else:
                    text = extract_text(filename, file_bytes)
                text_parts.append(f"--- Document: {filename} ---\n{text}")
        except Exception as e:
            yield sse({"type": "error", "message": str(e)})
            return

        combined_text = "\n\n".join(text_parts)
        yield sse({"type": "progress", "step": "extraction"})

        # Debug: save extracted text per file and combined
        # (dossier_id not yet known, use a temp ref; will be moved after creation)
        _debug_texts = text_parts  # keep reference for later

        # 2. Queue receives a key each time a rubrique finishes
        queue: asyncio.Queue[str] = asyncio.Queue()

        async def on_step_done(key: str) -> None:
            await queue.put(key)

        # 3. Run all extractions concurrently in the background
        extraction_task = asyncio.create_task(
            extract_dossier(combined_text, on_step_done=on_step_done)
        )

        # Wait for progress events with periodic heartbeats to keep connection alive
        total_steps = len(RUBRIQUE_PROMPTS) + 1  # rubriques + patient_info
        received = 0
        while received < total_steps:
            try:
                key = await asyncio.wait_for(queue.get(), timeout=15)
                received += 1
                yield sse({"type": "progress", "step": key})
            except asyncio.TimeoutError:
                # Send heartbeat to keep mobile connections alive
                yield ": keepalive\n\n"
                # If extraction already finished (e.g. a step failed without
                # calling on_step_done), stop waiting for more progress events.
                if extraction_task.done():
                    break

        try:
            dossier: PatientDossier = await extraction_task
        except Exception as e:
            logger.exception("Dossier extraction failed")
            yield sse({"type": "error", "message": str(e)})
            return

        # 4. Store and emit the final complete event
        try:
            response = crud.create_dossier(dossier)
            did = response.dossier_id

            # Save debug artifacts
            from app.classification.store import save_debug

            # a) Individual extracted texts per file
            for i, part in enumerate(_debug_texts):
                save_debug(did, f"extracted_{i:02d}.txt", part)
            # b) Combined text
            save_debug(did, "combined_text.txt", combined_text)
            # c) Each rubrique as individual JSON
            for rub_key in [
                "r01_historique",
                "r02_clinique",
                "r03_traitement",
                "r04_professionnel",
                "r05_capacite_travail",
                "r06_readaptation",
                "r07_freins_cognition",
                "r08_activites",
            ]:
                rub = getattr(dossier.rubriques, rub_key)
                save_debug(did, f"rubrique_{rub_key}.json", rub.model_dump())
            # d) Patient info
            save_debug(did, "patient_info.json", dossier.patient_info.model_dump())
            logger.info(f"Debug artifacts saved for dossier {did}")

            yield sse(
                {
                    "type": "complete",
                    "dossier_id": did,
                    "dossier": response.dossier.model_dump(),
                }
            )
        except Exception as e:
            logger.exception("Failed to store dossier")
            yield sse({"type": "error", "message": str(e)})
            return

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
