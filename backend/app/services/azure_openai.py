from langchain_openai import AzureChatOpenAI

from app.config import settings


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


async def test_hello() -> dict:
    """Send a simple prompt to Azure OpenAI and return the response."""
    model = get_model()
    response = await model.ainvoke("Hello!")
    return {"response": response.content}
