from __future__ import annotations

from typing import Any

import fitz
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
    # Track checkbox pairs: selected_field_name → unselected_field_name
    acro_unchecks: dict[str, bool] = {}

    if schema:
        for field in schema.fields:
            if field.id not in field_values or field_values[field.id] is None:
                continue
            acro_name = field.position.get("field_name")
            if not acro_name:
                continue
            pair_name = field.position.get("pair_field_name")
            value = field_values[field.id]

            if pair_name:
                # select_one from a checkbox pair: check the selected, uncheck the other
                selected = str(value)
                acro_values[selected] = True
                other = pair_name if selected == acro_name else acro_name
                acro_unchecks[other] = False
            else:
                acro_values[acro_name] = value
    else:
        acro_values = field_values

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    filled = 0

    for page in doc:
        for widget in page.widgets():
            field_name = widget.field_name

            # Handle unchecks for checkbox pairs
            if field_name in acro_unchecks:
                widget.field_value = False
                widget.update()
                filled += 1
                continue

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
