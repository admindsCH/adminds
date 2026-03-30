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
    return {
        key: unquote(value) if value is not None else ""
        for key, value in metadata.items()
    }


def _blob_key(user_id: str, template_id: str) -> str:
    """Build the blob name: ``{user_id}/{template_id}``."""
    return f"{user_id}/{template_id}"


def _safe_int(value: str | None, default: int) -> int:
    """Parse an int from metadata, returning default on any failure."""
    try:
        return int(value) if value else default
    except (ValueError, TypeError):
        return default


def upload_template(
    user_id: str,
    template_id: str,
    file_bytes: bytes,
    filename: str,
    *,
    metadata: dict[str, str],
) -> str:
    """Upload a template file to blob storage with metadata.

    Args:
        user_id: Owner's Clerk user ID (scopes the blob key).
        template_id: Unique ID for this template (category/slug).
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
    blob = container.get_blob_client(_blob_key(user_id, template_id))

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


def template_exists(user_id: str, template_id: str) -> bool:
    """Check if a template blob already exists."""
    container = _get_container(TEMPLATES_CONTAINER)
    blob = container.get_blob_client(_blob_key(user_id, template_id))
    return blob.exists()


def download_template(user_id: str, template_id: str) -> bytes:
    """Download a template file from blob storage."""
    container = _get_container(TEMPLATES_CONTAINER)
    blob = container.get_blob_client(_blob_key(user_id, template_id))
    return blob.download_blob().readall()


def delete_template(user_id: str, template_id: str) -> None:
    """Delete a template and its associated schema."""
    templates = _get_container(TEMPLATES_CONTAINER)
    schemas = _get_container(SCHEMAS_CONTAINER)
    key = _blob_key(user_id, template_id)

    templates.get_blob_client(key).delete_blob()
    logger.info(f"Deleted template '{key}'")

    # Also delete the schema if it exists
    schema_blob = schemas.get_blob_client(key)
    if schema_blob.exists():
        schema_blob.delete_blob()
        logger.info(f"Deleted schema for '{key}'")


def list_templates(user_id: str) -> list[TemplateResponse]:
    """List templates owned by *user_id*."""
    container = _get_container(TEMPLATES_CONTAINER)
    schemas_container = _get_container(SCHEMAS_CONTAINER)
    prefix = f"{user_id}/"

    # Collect existing schema IDs for the has_schema flag
    schema_ids = set()
    for blob in schemas_container.list_blobs(name_starts_with=prefix):
        schema_ids.add(blob.name)

    templates: list[TemplateResponse] = []
    for blob in container.list_blobs(name_starts_with=prefix, include=["metadata"]):
        # Strip user prefix to get the external template_id
        external_id = blob.name[len(prefix):]
        meta = _desanitize_metadata(blob.metadata or {})
        created_at = ""
        if blob.last_modified:
            created_at = blob.last_modified.isoformat()
        templates.append(
            TemplateResponse(
                id=external_id,
                name=meta.get("name", external_id),
                description=meta.get("description", ""),
                category=meta.get("category", "rapport-ai"),
                insurance_id=meta.get("insurance_id", ""),
                insurance_name=meta.get("insurance_name", ""),
                canton=meta.get("canton", "all"),
                estimated_minutes=_safe_int(meta.get("estimated_minutes"), 5),
                page_count=_safe_int(meta.get("page_count"), 1),
                is_official=meta.get("is_official", "false").lower() == "true",
                has_schema=blob.name in schema_ids,
                filename=meta.get("original_filename", ""),
                size=blob.size,
                created_at=created_at,
            )
        )

    return templates


def get_template_metadata(user_id: str, template_id: str) -> dict[str, str]:
    """Get metadata for a single template."""
    container = _get_container(TEMPLATES_CONTAINER)
    blob = container.get_blob_client(_blob_key(user_id, template_id))
    props = blob.get_blob_properties()
    return _desanitize_metadata(props.metadata or {})


def update_template_metadata(user_id: str, template_id: str, metadata: dict[str, str]) -> None:
    """Update metadata on an existing template blob."""
    container = _get_container(TEMPLATES_CONTAINER)
    blob = container.get_blob_client(_blob_key(user_id, template_id))
    blob.set_blob_metadata(_sanitize_metadata(metadata))
    logger.info(f"Updated metadata for template '{template_id}'")


def upload_schema(user_id: str, template_id: str, schema: dict[str, Any]) -> str:
    """Upload a JSON field-map schema for a template.

    Args:
        user_id: Owner's Clerk user ID.
        template_id: Must match the template's external ID (category/slug).
        schema: The extracted field schema dict.

    Returns:
        The blob URL.
    """
    container = _get_container(SCHEMAS_CONTAINER)
    blob = container.get_blob_client(_blob_key(user_id, template_id))

    blob.upload_blob(
        json.dumps(schema, ensure_ascii=False, indent=2).encode("utf-8"),
        overwrite=True,
        content_settings=_content_settings("application/json"),
    )

    logger.info(f"Uploaded schema for template '{template_id}'")
    return blob.url


def download_schema(user_id: str, template_id: str) -> dict[str, Any] | None:
    """Download the JSON schema for a template, or None if not yet generated."""
    container = _get_container(SCHEMAS_CONTAINER)
    blob = container.get_blob_client(_blob_key(user_id, template_id))

    if not blob.exists():
        return None

    data = blob.download_blob().readall()
    return json.loads(data)


def has_schema(user_id: str, template_id: str) -> bool:
    """Check if a schema exists for a given template."""
    container = _get_container(SCHEMAS_CONTAINER)
    return container.get_blob_client(_blob_key(user_id, template_id)).exists()


def _content_settings(content_type: str):
    """Build ContentSettings for blob upload."""
    from azure.storage.blob import ContentSettings

    return ContentSettings(content_type=content_type)
