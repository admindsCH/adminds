import logging
import sys
from importlib.metadata import version

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.classification.routes import router as classification_router
from app.config import load_secrets_from_keyvault, settings
from app.report.routes import router as report_router
from app.templates.routes import router as templates_router
from app.webhooks.routes import router as webhooks_router
from app.schemas import HealthResponse


# Route standard library logs (uvicorn, langchain, etc.) through loguru for colored output.
class _InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        level = (
            record.levelname
            if record.levelname in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")
            else record.levelno
        )
        logger.opt(depth=6, exception=record.exc_info).log(level, record.getMessage())


logging.basicConfig(handlers=[_InterceptHandler()], level=logging.INFO, force=True)

# Silence verbose Azure SDK HTTP logs
logging.getLogger("azure").setLevel(logging.WARNING)
logger.remove()
logger.add(sys.stderr, level="INFO", colorize=True)

# Load secrets from Azure Key Vault (if AZURE_KEYVAULT_URL is set).
# Falls back to env vars / .env file when Key Vault is not configured.
load_secrets_from_keyvault()

logger.info(
    f"Azure OpenAI config: endpoint={settings.azure_openai_endpoint}, "
    f"deployment={settings.azure_openai_deployment}, "
    f"api_version={settings.azure_openai_api_version}, "
    f"api_key={'***' + settings.azure_openai_api_key[-4:] if settings.azure_openai_api_key else 'NOT SET'}"
)

_version = version("adminds-api")

app = FastAPI(
    title="Adminds API",
    version=_version,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# Build CORS origins list (include www variants automatically)
app_url = settings.app_url.rstrip("/")

cors_origins = [
    app_url,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
]


# Add www variants if the URL is a production domain
if app_url.startswith("https://") and not app_url.startswith("https://www."):
    cors_origins.append(app_url.replace("https://", "https://www."))
elif app_url.startswith("https://www."):
    cors_origins.append(app_url.replace("https://www.", "https://"))

logger.info(f"CORS allowed origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", version=_version)


# Register routers
app.include_router(classification_router, prefix="/api")
app.include_router(report_router, prefix="/api")
app.include_router(templates_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")
