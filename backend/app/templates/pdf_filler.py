"""PDF filler — writes values into AcroForm fields using PyMuPDF.

Takes a blank PDF template, a schema (to map semantic IDs back to
AcroForm field names), and LLM-generated field_values.
"""

from __future__ import annotations

from typing import Any

import fitz  # PyMuPDF
from loguru import logger

from app.templates.schemas import TemplateSchema


def fill_pdf_template(
    pdf_bytes: bytes,
    field_values: dict[str, Any],
    schema: TemplateSchema | None = None,
) -> bytes:
    """Fill AcroForm fields in a PDF template.

    Args:
        pdf_bytes: Raw bytes of the blank PDF template.
        field_values: Mapping of semantic field ID → value.
        schema: Template schema used to map semantic IDs to AcroForm field names.

    Returns:
        Filled PDF as bytes.
    """
    # Build mapping: AcroForm field_name → value
    acro_values: dict[str, Any] = {}
    if schema:
        for field in schema.fields:
            if field.id in field_values and field_values[field.id] is not None:
                acro_name = field.position.get("field_name")
                if acro_name:
                    acro_values[acro_name] = field_values[field.id]
    else:
        acro_values = field_values

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    filled = 0

    for page in doc:
        for widget in page.widgets():
            field_name = widget.field_name
            if field_name not in acro_values:
                continue

            value = acro_values[field_name]

            if widget.field_type == 2:  # checkbox
                widget.field_value = bool(value)
            else:
                widget.field_value = str(value)

            widget.update()
            filled += 1

    result = doc.tobytes(deflate=True)
    doc.close()

    logger.info(f"Filled {filled}/{len(acro_values)} fields in PDF")
    return result
