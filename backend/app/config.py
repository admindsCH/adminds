from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_url: str = "http://localhost:8000"
    app_url: str = "http://localhost:3000"

    # Azure OpenAI
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_api_version: str = "2024-12-01-preview"
    azure_openai_deployment: str = "gpt-5.2"

    # Azure Document Intelligence
    azure_document_intelligence_endpoint: str = ""
    azure_document_intelligence_key: str = ""

    azure_keyvault_url: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()


def load_secrets_from_keyvault() -> None:
    """Load secrets from Azure Key Vault into settings, if configured.

    Uses DefaultAzureCredential (works with managed identity on the VM,
    or az login locally). Only overrides settings that are empty.
    """
    if not settings.azure_keyvault_url:
        return

    from azure.identity import DefaultAzureCredential
    from azure.keyvault.secrets import SecretClient
    from loguru import logger

    logger.info(f"Loading secrets from Key Vault: {settings.azure_keyvault_url}")
    client = SecretClient(
        vault_url=settings.azure_keyvault_url,
        credential=DefaultAzureCredential(),
    )

    # Map: Key Vault secret name → settings attribute
    secret_map = {
        "azure-openai-api-key": "azure_openai_api_key",
        "azure-document-intelligence-key": "azure_document_intelligence_key",
    }

    for secret_name, attr in secret_map.items():
        if not getattr(settings, attr):
            try:
                value = client.get_secret(secret_name).value
                if value:
                    object.__setattr__(settings, attr, value)
                    logger.info(f"Loaded secret '{secret_name}' from Key Vault")
            except Exception as e:
                logger.warning(f"Could not load secret '{secret_name}': {e}")
