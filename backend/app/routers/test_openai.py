from fastapi import APIRouter

from app.services.azure_openai import test_hello

router = APIRouter(tags=["test"])


@router.get("/test/openai")
async def test_openai() -> dict:
    """Test the Azure OpenAI connection."""
    return await test_hello()
