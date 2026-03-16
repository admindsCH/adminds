"""Helpers to convert uploaded files into multimodal content blocks for the LLM."""

from __future__ import annotations

import base64
from io import BytesIO
from pathlib import PurePath

import fitz  # pymupdf — renders PDF pages to PNG images.
from docx import Document

from app.classification.constants import MAX_TEXT_CHARS

# DPI for PDF→PNG conversion. 200 gives clean character rendering
_PDF_DPI = 200

_IMAGE_MIMES: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".tiff": "image/tiff",
    ".bmp": "image/bmp",
}


def file_to_content_blocks(
    filename: str, file_bytes: bytes, *, max_pages: int | None = None
) -> list[dict]:
    """Convert a file into multimodal content blocks for the LLM.

    Routes by file extension:
    - PDF   -> base64 data URL (GPT-4o reads PDFs natively via vision)
    - Image -> base64 data URL with correct MIME type
    - DOCX  -> extracted paragraph text (truncated to MAX_TEXT_CHARS)

    Args:
        max_pages: If set, only render up to this many pages from a PDF.
                   Useful for classification where 1-2 pages suffice.

    Returns a list of dicts in OpenAI's content block format:
    [{"type": "image_url", "image_url": {"url": "data:..."}}] or
    [{"type": "text", "text": "..."}]
    """
    ext = PurePath(filename).suffix.lower()

    if ext == ".pdf":
        return _pdf_to_image_blocks(file_bytes, max_pages=max_pages)

    if ext in _IMAGE_MIMES:
        mime = _IMAGE_MIMES[ext]
        b64 = base64.b64encode(file_bytes).decode()
        return [
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}
        ]

    if ext in {".docx", ".doc"}:
        text = _docx_to_text(file_bytes)
        return [
            {"type": "text", "text": f"Contenu du document '{filename}':\n\n{text}"}
        ]

    return [{"type": "text", "text": f"[Fichier non supporté: {filename}]"}]


def _pdf_to_image_blocks(
    file_bytes: bytes, *, max_pages: int | None = None
) -> list[dict]:
    """Render each PDF page as a PNG and return as image_url content blocks.

    Args:
        max_pages: If set, only render the first N pages.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    zoom = _PDF_DPI / 72
    matrix = fitz.Matrix(zoom, zoom)

    blocks: list[dict] = []
    for page in doc:
        # Stop early when we've rendered enough pages for the task.
        if max_pages is not None and page.number >= max_pages:
            break
        # Render page to a pixmap (raster image in memory).
        pix = page.get_pixmap(matrix=matrix)
        # Export pixmap as PNG bytes.
        png_bytes = pix.tobytes("png")
        b64 = base64.b64encode(png_bytes).decode()
        blocks.append(
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}
        )

    doc.close()
    return blocks


def _docx_to_text(file_bytes: bytes) -> str:
    """Extract paragraph text from a DOCX file via python-docx.

    Joins non-empty paragraphs with newlines, truncates to MAX_TEXT_CHARS.
    """
    doc = Document(BytesIO(file_bytes))
    text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return text[:MAX_TEXT_CHARS]
