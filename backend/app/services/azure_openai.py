import asyncio
from typing import Any

from langchain_openai import AzureChatOpenAI
from loguru import logger

from app.config import settings

# Global semaphore: limits concurrent OpenAI calls across the entire app.
# Azure OpenAI deployments have RPM (requests per minute) and TPM (tokens per
# minute) limits.  Bursting 9-15 parallel calls from a single user easily
# exceeds those limits; with multiple concurrent users it gets worse.
# 3 keeps us well within typical Azure OpenAI rate limits while still
# allowing meaningful parallelism.
MAX_CONCURRENT_LLM_CALLS = 3
_semaphore = asyncio.Semaphore(MAX_CONCURRENT_LLM_CALLS)


def get_model(**kwargs) -> AzureChatOpenAI:
    """Return an Azure OpenAI chat model configured from settings.

    Pass any extra kwargs (e.g. model_kwargs={"response_format": ...})
    to override defaults.
    """
    return AzureChatOpenAI(
        azure_deployment=settings.azure_openai_deployment,
        api_key=settings.azure_openai_api_key,
        azure_endpoint=settings.azure_openai_endpoint,
        api_version=settings.azure_openai_api_version,
        temperature=0,
        max_retries=5,
        **kwargs,
    )


async def ainvoke_throttled(model: Any, messages: Any) -> Any:
    """Invoke a LangChain model while respecting the global concurrency limit.

    Use this instead of calling model.ainvoke() directly so that
    concurrent requests don't burst past Azure OpenAI rate limits.
    """
    async with _semaphore:
        logger.debug(
            f"LLM call acquired semaphore "
            f"({MAX_CONCURRENT_LLM_CALLS - _semaphore._value}/{MAX_CONCURRENT_LLM_CALLS} slots in use)"
        )
        return await model.ainvoke(messages)


async def test_hello() -> dict:
    """Send a simple prompt to Azure OpenAI and return the response."""
    model = get_model()
    response = await ainvoke_throttled(model, "Hello!")
    return {"response": response.content}
