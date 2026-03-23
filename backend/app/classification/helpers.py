"""Helpers to extract text from uploaded files using LiteParse."""

from __future__ import annotations

import tempfile
from pathlib import PurePath

from liteparse import LiteParse
from loguru import logger

# Accepted upload file extensions.
_SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".doc",
    ".jpg",
    ".jpeg",
    ".png",
    ".tiff",
    ".bmp",
}


# Shared parser instance — reused across calls to avoid cold-start overhead.
_parser = LiteParse()


def extract_text(filename: str, file_bytes: bytes) -> str:
    """Extract text from any supported file using LiteParse.

    Writes the file to a temp path, runs LiteParse (handles PDF, DOCX,
    images with OCR), and returns the extracted text.

    Args:
        filename: Original filename (used for extension detection).
        file_bytes: Raw file content.

    Returns:
        Extracted text string. Empty string if extraction fails.
    """
    ext = PurePath(filename).suffix.lower()

    if ext not in _SUPPORTED_EXTENSIONS:
        logger.warning(f"Unsupported file type: {filename}")
        return f"[Fichier non supporté: {filename}]"

    # LiteParse needs a file path — write to a temp file.
    with tempfile.NamedTemporaryFile(suffix=ext, delete=True) as tmp:
        tmp.write(file_bytes)
        tmp.flush()

        logger.info(f"Extracting text from '{filename}' via LiteParse...")
        result = _parser.parse(tmp.name, ocr_language="fra")

    logger.info(
        f"Extracted {len(result.text)} chars from '{filename}' "
        f"({len(result.pages)} page(s))"
    )
    return result.text
