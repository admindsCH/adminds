from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential
from fastapi import UploadFile

from app.config import settings


def get_client() -> DocumentIntelligenceClient:
    """Return an Azure Document Intelligence client configured from settings."""
    return DocumentIntelligenceClient(
        endpoint=settings.azure_document_intelligence_endpoint,
        credential=AzureKeyCredential(settings.azure_document_intelligence_key),
    )


async def test_analyze(file: UploadFile) -> dict:
    """Run layout analysis on an uploaded file and return the result dict."""
    file_bytes = await file.read()
    client = get_client()
    poller = client.begin_analyze_document(
        "prebuilt-layout",
        file_bytes,
        content_type="application/octet-stream",
    )
    return poller.result().as_dict()
