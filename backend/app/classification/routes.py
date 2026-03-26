from __future__ import annotations

from fastapi import APIRouter, File, UploadFile

from app.classification import services
from app.classification.schemas import (
    ChatRequest,
    ChatResponse,
    ClassifiedDocument,
    DossierResponse,
    PatientDossierPatch,
    TranscriptionResponse,
)

router = APIRouter(tags=["classification"])


@router.post("/classify", response_model=list[ClassifiedDocument])
async def classify(files: list[UploadFile] = File(...)) -> list[ClassifiedDocument]:
    """Classify uploaded files — fast per-file labeling for Step 1 UI badges."""
    return await services.classify_documents(files)


@router.post("/classify-one", response_model=ClassifiedDocument)
async def classify_one(file: UploadFile = File(...)) -> ClassifiedDocument:
    """Classify a single file — test route for Swagger."""
    return await services.classify_document(file)


@router.post("/parse-dossier-stream")
async def parse_dossier_stream(files: list[UploadFile] = File(...)):
    """Parse documents and stream SSE progress events as each rubrique is extracted."""
    return services.parse_dossier_stream(files)


@router.get("/dossiers/{dossier_id}", response_model=DossierResponse)
async def get_dossier(dossier_id: str) -> DossierResponse:
    """Read the current state of a stored dossier."""
    return services.get_dossier(dossier_id)


@router.patch("/dossiers/{dossier_id}", response_model=DossierResponse)
async def patch_dossier(dossier_id: str, patch: PatientDossierPatch) -> DossierResponse:
    """Partially update a stored dossier (inline edits from the frontend)."""
    return services.patch_dossier(dossier_id, patch)


@router.post("/dossier-chat", response_model=ChatResponse)
async def dossier_chat(req: ChatRequest) -> ChatResponse:
    """Answer a question about the patient dossier using the raw extracted text."""
    return await services.answer_dossier_question(req.question, req.raw_content)


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(file: UploadFile = File(...)) -> TranscriptionResponse:
    """Transcribe an audio file using Azure OpenAI Whisper."""
    file_bytes = await file.read()
    text = await services.transcribe_audio(file_bytes, file.filename or "audio.webm")
    return TranscriptionResponse(text=text)
