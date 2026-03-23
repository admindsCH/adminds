"""
Fill a Fribourg .docx template from a flat JSON dict keyed by field IDs.

Usage:
    from app.services.docx_filler import fill_fribourg_template

    filled_bytes = fill_fribourg_template(
        template_path="path/to/fribourg.docx",
        data={"field_id": "value", ...},
    )
    # filled_bytes is a bytes object containing the filled .docx
"""

from __future__ import annotations

import io
from typing import Any

from docx import Document
from lxml import etree

from app.services.fribourg_field_map import (
    ALL_FORM_FIELDS,
    ALL_HEADER_LABELS,
    ALL_TABLE_CELLS,
    CHOICE_COLUMNS,
    FieldType,
)

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def fill_fribourg_template(template_path: str, data: dict[str, Any]) -> bytes:
    """
    Open the Fribourg .docx template and fill every field that has a
    corresponding key in ``data``.  Returns the filled document as bytes.

    Args:
        template_path: Path to the empty Fribourg .docx template.
        data: Flat dict mapping field IDs (from fribourg_field_map) to values.
              Missing keys are silently skipped (field left empty).
    """
    doc = Document(template_path)
    all_ff = doc.element.findall(".//w:ffData", NS)
    tables = doc.element.findall(".//w:tbl", NS)

    # ── 1. Fill form fields (fldChar-based) ─────────────────
    for field in ALL_FORM_FIELDS:
        value = data.get(field.id)
        if value is None or value == "":
            continue

        if field.field_type == FieldType.SELECT_ONE:
            # Bold + underline the selected option among ff_index..ff_index+len(options)-1
            _fill_select_one(all_ff, field.ff_index, field.options, str(value))

        elif field.field_type == FieldType.CHECKBOX:
            # Set checkbox to checked if value is truthy
            if value:
                _check_checkbox(all_ff[field.ff_index])

        else:
            # TEXT or DATE — replace the text between separate and end
            _set_form_field_text(all_ff[field.ff_index], str(value))

    # ── 2. Fill header labels (text replacement) ────────────
    doctor_name = data.get("doctor_name", "")
    if doctor_name:
        for header in ALL_HEADER_LABELS:
            _replace_cell_label(
                tables[header.table_index],
                header.row,
                header.col,
                header.original_text,
                doctor_name,
            )

    # ── 3. Fill table cells (sections A–D) ──────────────────
    for tc in ALL_TABLE_CELLS:
        value = data.get(tc.id)
        if value is None or value == "":
            continue

        if tc.field_type == FieldType.CHOICE:
            # Place "X" in the column matching the choice value
            col_map = CHOICE_COLUMNS.get(tc.section, {})
            col = col_map.get(str(value).lower())
            if col is not None:
                _add_text_to_cell(tables[tc.table_index], tc.row, col, "X")

        elif tc.field_type == FieldType.TEXT:
            _add_text_to_cell(tables[tc.table_index], tc.row, tc.col, str(value))

    # ── 4. Serialize to bytes ───────────────────────────────
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ── Private helpers ─────────────────────────────────────────


def _set_form_field_text(ff: etree._Element, value: str) -> None:
    """Replace the text run between fldChar separate and end."""
    # Walk up from ffData → fldChar run → paragraph
    p = ff.getparent().getparent().getparent()
    state = False
    for elem in p:
        if elem.tag == f"{W}r":
            fc = elem.find(f"{W}fldChar", NS)
            if fc is not None:
                ft = fc.get(f"{W}fldCharType")
                if ft == "begin" and fc.find(f"{W}ffData", NS) is ff:
                    state = True
                elif ft == "separate" and state:
                    state = "sep"
                elif ft == "end" and state == "sep":
                    break
            elif state == "sep":
                t = elem.find(f"{W}t", NS)
                if t is not None:
                    t.text = value
                    # Preserve spaces at start/end
                    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
                    return


def _check_checkbox(ff: etree._Element) -> None:
    """Set a checkbox form field to checked and update its display symbol."""
    cb = ff.find("w:checkBox", NS)
    if cb is None:
        return

    # Remove existing checked/default elements, add checked=1
    for child in list(cb):
        if child.tag in (f"{W}checked", f"{W}default"):
            cb.remove(child)
    checked = etree.SubElement(cb, f"{W}checked")
    checked.set(f"{W}val", "1")

    # Update the display symbol from unchecked (00A8) to checked (00FE)
    p = ff.getparent().getparent().getparent()
    state = False
    for elem in p:
        if elem.tag == f"{W}r":
            fc = elem.find(f"{W}fldChar", NS)
            if fc is not None:
                ft = fc.get(f"{W}fldCharType")
                if ft == "begin" and fc.find(f"{W}ffData", NS) is ff:
                    state = True
                elif ft == "separate" and state:
                    state = "sep"
                elif ft == "end" and state == "sep":
                    break
            elif state == "sep":
                sym = elem.find(".//w:sym", NS)
                if sym is not None:
                    sym.set(f"{W}char", "00FE")
                    return


def _fill_select_one(
    all_ff: list[etree._Element],
    start_index: int,
    options: list[str],
    selected: str,
) -> None:
    """Bold + underline the text run of the selected option."""
    for i, option_text in enumerate(options):
        ff = all_ff[start_index + i]
        p = ff.getparent().getparent().getparent()
        state = False
        for elem in p:
            if elem.tag == f"{W}r":
                fc = elem.find(f"{W}fldChar", NS)
                if fc is not None:
                    ft = fc.get(f"{W}fldCharType")
                    if ft == "begin" and fc.find(f"{W}ffData", NS) is ff:
                        state = True
                    elif ft == "separate" and state:
                        state = "sep"
                    elif ft == "end" and state == "sep":
                        break
                elif state == "sep":
                    if option_text == selected:
                        # Add bold + underline to this run
                        rPr = elem.find(f"{W}rPr", NS)
                        if rPr is None:
                            rPr = etree.SubElement(elem, f"{W}rPr")
                            elem.insert(0, rPr)
                        if rPr.find(f"{W}b", NS) is None:
                            etree.SubElement(rPr, f"{W}b")
                        if rPr.find(f"{W}u", NS) is None:
                            u = etree.SubElement(rPr, f"{W}u")
                            u.set(f"{W}val", "single")
                    break


def _add_text_to_cell(
    table: etree._Element,
    row: int,
    col: int,
    text: str,
    size_pt: int = 8,
) -> None:
    """Insert a text run into an empty table cell."""
    rows = table.findall("w:tr", NS)
    if row >= len(rows):
        return
    cells = rows[row].findall("w:tc", NS)
    if col >= len(cells):
        return

    cell = cells[col]
    p = cell.find("w:p", NS)
    if p is None:
        return

    # Create run with font size
    r = etree.SubElement(p, f"{W}r")
    rPr = etree.SubElement(r, f"{W}rPr")
    sz = etree.SubElement(rPr, f"{W}sz")
    sz.set(f"{W}val", str(size_pt * 2))  # half-points
    szCs = etree.SubElement(rPr, f"{W}szCs")
    szCs.set(f"{W}val", str(size_pt * 2))
    t = etree.SubElement(r, f"{W}t")
    t.text = text
    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def _replace_cell_label(
    table: etree._Element,
    row: int,
    col: int,
    original: str,
    replacement: str,
) -> None:
    """Find a cell by position and replace its label text."""
    rows = table.findall("w:tr", NS)
    if row >= len(rows):
        return
    cells = rows[row].findall("w:tc", NS)
    if col >= len(cells):
        return

    for t in cells[col].findall(f".//{W}t", NS):
        if t.text and original in t.text:
            t.text = t.text.replace(original, replacement)
            return
