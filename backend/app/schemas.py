from pydantic import BaseModel


# --- Health ---


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"


# --- Errors ---


class ErrorResponse(BaseModel):
    detail: str
    code: str | None = None
