"""PDF filler — writes values into AcroForm fields using PyMuPDF.

Takes a blank PDF template + field_values dict and returns filled PDF bytes.
Field names in field_values must match the AcroForm field names in the PDF.
"""

from __future__ import annotations

import fitz  # PyMuPDF
from loguru import logger


def fill_pdf_template(
    pdf_bytes: bytes,
    field_values: dict[str, str | bool],
) -> bytes:
    """Fill AcroForm fields in a PDF template.

    Args:
        pdf_bytes: Raw bytes of the blank PDF template.
        field_values: Mapping of AcroForm field_name → value.
            - Text/date fields: str value
            - Checkboxes: bool (True = checked)
            - Combo/listbox: str matching one of the options

    Returns:
        Filled PDF as bytes.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    filled = 0

    for page in doc:
        for widget in page.widgets():
            field_name = widget.field_name
            if field_name not in field_values:
                continue

            value = field_values[field_name]

            if widget.field_type == 2:  # checkbox
                widget.field_value = bool(value)
            else:
                widget.field_value = str(value)

            widget.update()
            filled += 1

    result = doc.tobytes(deflate=True)
    doc.close()

    logger.info(f"Filled {filled}/{len(field_values)} fields in PDF")
    return result
