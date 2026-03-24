"""Azure Blob Storage service for template and schema management.

Two containers:
- `templates` — uploaded .docx/.pdf report templates
- `schemas`   — auto-generated JSON field maps (one per template)

Each template blob carries metadata matching the frontend DocumentTemplate
interface so the library can be served directly from blob storage.
"""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote, unquote

from azure.storage.blob import BlobServiceClient, ContainerClient
from loguru import logger

from app.config import settings
from app.templates.schemas import TemplateResponse

# Container names
TEMPLATES_CONTAINER = "templates"
SCHEMAS_CONTAINER = "schemas"


# ── Client helpers ───────────────────────────────────────


def _get_service_client() -> BlobServiceClient:
    """Return a BlobServiceClient from the connection string."""
    return BlobServiceClient.from_connection_string(
        settings.azure_storage_connection_string,
    )


def _get_container(name: str) -> ContainerClient:
    return _get_service_client().get_container_client(name)


def _sanitize_metadata(metadata: dict[str, str]) -> dict[str, str]:
    """Sanitize metadata keys/values for Azure Blob Storage.

    Azure requires: ASCII-only values, C-identifier keys (no hyphens).
    We URL-encode values so unicode chars (é, ü, etc.) survive the round-trip.
    Use _desanitize_metadata to decode back to the original values.
    """
    clean: dict[str, str] = {}
    for key, value in metadata.items():
        # Keys: replace hyphens/spaces with underscores
        clean_key = key.replace("-", "_").replace(" ", "_")
        # Values: URL-encode to keep them ASCII-safe but lossless
        clean_value = quote(str(value), safe="") if value is not None else ""
        clean[clean_key] = clean_value
    return clean


def _desanitize_metadata(metadata: dict[str, str]) -> dict[str, str]:
    """Decode URL-encoded metadata values back to their original unicode form."""
    return {key: unquote(value) for key, value in metadata.items()}


def upload_template(
    template_id: str,
    file_bytes: bytes,
    filename: str,
    *,
    metadata: dict[str, str],
) -> str:
    """Upload a template file to blob storage with metadata.

    Args:
        template_id: Unique ID for this template (used as blob name).
        file_bytes: Raw file content (.docx or .pdf).
        filename: Original filename (stored in metadata).
        metadata: Template metadata — name, description, category,
                  insurance_id, canton, etc.

    Returns:
        The blob URL.
    """
    # Determine content type from extension
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    content_type = {
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pdf": "application/pdf",
    }.get(ext, "application/octet-stream")

    container = _get_container(TEMPLATES_CONTAINER)
    blob = container.get_blob_client(template_id)

    # Merge filename into metadata and sanitize for Azure
    # Azure blob metadata values must be ASCII-safe
    blob_metadata = _sanitize_metadata({**metadata, "original_filename": filename})

    blob.upload_blob(
        file_bytes,
        overwrite=True,
        content_settings=_content_settings(content_type),
        metadata=blob_metadata,
    )

    logger.info(
        f"Uploaded template '{template_id}' ({filename}, {len(file_bytes)} bytes)"
    )
    return blob.url


def template_exists(template_id: str) -> bool:
    """Check if a template blob already exists."""
    container = _get_container(TEMPLATES_CONTAINER)
    blob = container.get_blob_client(template_id)
    return blob.exists()


def download_template(template_id: str) -> bytes:
    """Download a template file from blob storage."""
    container = _get_container(TEMPLATES_CONTAINER)
    blob = container.get_blob_client(template_id)
    return blob.download_blob().readall()


def delete_template(template_id: str) -> None:
    """Delete a template and its associated schema."""
    templates = _get_container(TEMPLATES_CONTAINER)
    schemas = _get_container(SCHEMAS_CONTAINER)

    templates.get_blob_client(template_id).delete_blob()
    logger.info(f"Deleted template '{template_id}'")

    # Also delete the schema if it exists
    schema_blob = schemas.get_blob_client(template_id)
    if schema_blob.exists():
        schema_blob.delete_blob()
        logger.info(f"Deleted schema for '{template_id}'")


def list_templates() -> list[TemplateResponse]:
    """List all templates with their metadata."""
    container = _get_container(TEMPLATES_CONTAINER)
    schemas_container = _get_container(SCHEMAS_CONTAINER)

    # Collect existing schema IDs for the has_schema flag
    schema_ids = set()
    for blob in schemas_container.list_blobs():
        schema_ids.add(blob.name)

    templates: list[TemplateResponse] = []
    for blob in container.list_blobs(include=["metadata"]):
        meta = _desanitize_metadata(blob.metadata or {})
        templates.append(
            TemplateResponse(
                id=blob.name,
                name=meta.get("name", blob.name),
                description=meta.get("description", ""),
                category=meta.get("category", "rapport-ai"),
                insurance_id=meta.get("insurance_id", ""),
                insurance_name=meta.get("insurance_name", ""),
                canton=meta.get("canton", "all"),
                estimated_minutes=int(meta.get("estimated_minutes", "5")),
                page_count=int(meta.get("page_count", "1")),
                is_official=meta.get("is_official", "false").lower() == "true",
                has_schema=blob.name in schema_ids,
                filename=meta.get("original_filename", ""),
                size=blob.size,
            )
        )

    return templates


def get_template_metadata(template_id: str) -> dict[str, str]:
    """Get metadata for a single template."""
    container = _get_container(TEMPLATES_CONTAINER)
    blob = container.get_blob_client(template_id)
    props = blob.get_blob_properties()
    return _desanitize_metadata(props.metadata or {})


def upload_schema(template_id: str, schema: dict[str, Any]) -> str:
    """Upload a JSON field-map schema for a template.

    Args:
        template_id: Must match the template blob name.
        schema: The extracted field schema dict.

    Returns:
        The blob URL.
    """
    container = _get_container(SCHEMAS_CONTAINER)
    blob = container.get_blob_client(template_id)

    blob.upload_blob(
        json.dumps(schema, ensure_ascii=False, indent=2).encode("utf-8"),
        overwrite=True,
        content_settings=_content_settings("application/json"),
    )

    logger.info(f"Uploaded schema for template '{template_id}'")
    return blob.url


def download_schema(template_id: str) -> dict[str, Any] | None:
    """Download the JSON schema for a template, or None if not yet generated."""
    container = _get_container(SCHEMAS_CONTAINER)
    blob = container.get_blob_client(template_id)

    if not blob.exists():
        return None

    data = blob.download_blob().readall()
    return json.loads(data)


def has_schema(template_id: str) -> bool:
    """Check if a schema exists for a given template."""
    container = _get_container(SCHEMAS_CONTAINER)
    return container.get_blob_client(template_id).exists()


def _content_settings(content_type: str):
    """Build ContentSettings for blob upload."""
    from azure.storage.blob import ContentSettings

    return ContentSettings(content_type=content_type)
