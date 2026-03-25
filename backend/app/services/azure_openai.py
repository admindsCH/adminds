import asyncio
from typing import Any

from langchain_openai import AzureChatOpenAI
from loguru import logger

from app.config import settings

MAX_CONCURRENT_LLM_CALLS = 7
_semaphore = asyncio.Semaphore(MAX_CONCURRENT_LLM_CALLS)


def get_model(**kwargs) -> AzureChatOpenAI:
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
