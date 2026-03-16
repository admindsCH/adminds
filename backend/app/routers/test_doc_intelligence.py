from fastapi import APIRouter, UploadFile

from app.services.azure_document_intelligence import get_client

router = APIRouter(tags=["test"])


@router.post("/test/document-intelligence")
async def test_document_intelligence(file: UploadFile) -> dict:
    """Upload a document and run Azure Document Intelligence layout analysis on it."""
    file_bytes = await file.read()

    client = get_client()
    poller = client.begin_analyze_document(
        "prebuilt-layout",
        file_bytes,
        content_type="application/octet-stream",
    )
    result = poller.result()

    return result.as_dict()
