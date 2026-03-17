from fastapi import APIRouter, UploadFile

from app.services.azure_document_intelligence import test_analyze

router = APIRouter(tags=["test"])


@router.post("/test/document-intelligence")
async def test_document_intelligence(file: UploadFile) -> dict:
    """Test Azure Document Intelligence with an uploaded file."""
    return await test_analyze(file)
