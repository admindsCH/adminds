from __future__ import annotations

import io
import unicodedata
from typing import Any

from docx import Document
from lxml import etree

from loguru import logger

from app.templates.docx_compat import normalize_docx_bytes
from app.templates.schemas import SchemaField, TemplateSchema


def _normalize_choice(value: str) -> str:
    """Normalize a choice value for matching: lowercase, strip accents, underscores→spaces."""
    value = value.strip().lower()
    value = value.replace("_", " ")
    # Strip accents: "limitée" → "limitee", "ne sais pas" stays "ne sais pas"
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii")
    return value

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def fill_template(
    template_bytes: bytes,
    schema: TemplateSchema,
    field_values: dict[str, Any],
) -> bytes:
    """Fill a .docx template using schema positions and LLM-generated values.

    Args:
        template_bytes: Raw bytes of the .docx template.
        schema: TemplateSchema with field positions.
        field_values: Flat dict mapping field IDs to values.

    Returns:
        Filled .docx as bytes.
    """
    doc = Document(io.BytesIO(normalize_docx_bytes(template_bytes)))
    all_ff = doc.element.findall(f".//{W}ffData")
    tables = doc.element.findall(f".//{W}tbl")

    for field in schema.fields:
        value = field_values.get(field.id)
        if value is None or value == "":
            continue

        if field.slot_type == "form_field":
            _fill_form_field(all_ff, field, value)

        elif field.slot_type == "table_cell":
            _fill_table_cell(tables, field, value)

        elif field.slot_type == "header_label":
            _fill_header_label(tables, field, str(value))

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _fill_form_field(
    all_ff: list[etree._Element],
    field: SchemaField,
    value: Any,
) -> None:
    """Fill a form field based on its field_type."""
    ff_index = field.position.get("ff_index")
    if ff_index is None or ff_index >= len(all_ff):
        return

    if field.field_type == "select_one":
        _fill_select_one(all_ff, ff_index, field.options, str(value))
    elif field.field_type == "checkbox":
        if value:
            _check_checkbox(all_ff[ff_index])
    else:
        # text or date
        _set_form_field_text(all_ff[ff_index], str(value))


def _fill_table_cell(
    tables: list[etree._Element],
    field: SchemaField,
    value: Any,
) -> None:
    """Fill a table cell based on its field_type."""
    table_index = field.position.get("table_index")
    row = field.position.get("row")
    col = field.position.get("col")

    if table_index is None or row is None or table_index >= len(tables):
        return

    table = tables[table_index]

    if field.field_type == "choice" and field.choice_columns:
        # Normalize both the LLM value and the schema keys for fuzzy matching
        normalized_value = _normalize_choice(str(value))
        # Build normalized lookup: normalized_key → column_index
        normalized_map = {
            _normalize_choice(k): v for k, v in field.choice_columns.items()
        }
        target_col = normalized_map.get(normalized_value)
        if target_col is not None:
            _add_text_to_cell(table, row, target_col, "X")
    else:
        # text — write into the cell
        if col is None:
            return
        _add_text_to_cell(table, row, col, str(value))


def _fill_header_label(
    tables: list[etree._Element],
    field: SchemaField,
    value: str,
) -> None:
    """Replace a header label's original text with new value."""
    table_index = field.position.get("table_index")
    row = field.position.get("row")
    col = field.position.get("col")

    if table_index is None or row is None or col is None:
        return
    if table_index >= len(tables):
        return

    original = field.original_text or ""
    if original:
        _replace_cell_label(tables[table_index], row, col, original, value)
    else:
        _add_text_to_cell(tables[table_index], row, col, value)


def _set_form_field_text(ff: etree._Element, value: str) -> None:
    """Replace the text run between fldChar separate and end."""
    p = ff.getparent().getparent().getparent()
    state: bool | str = False
    for elem in p:
        if elem.tag == f"{W}r":
            fc = elem.find(f"{W}fldChar")
            if fc is not None:
                ft = fc.get(f"{W}fldCharType")
                if ft == "begin" and fc.find(f"{W}ffData") is ff:
                    state = True
                elif ft == "separate" and state is True:
                    state = "sep"
                elif ft == "end" and state == "sep":
                    break
            elif state == "sep":
                t = elem.find(f"{W}t")
                if t is not None:
                    t.text = value
                    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
                    return


def _check_checkbox(ff: etree._Element) -> None:
    """Set a checkbox form field to checked and update its display symbol."""
    cb = ff.find("w:checkBox", NS)
    if cb is None:
        return

    for child in list(cb):
        if child.tag in (f"{W}checked", f"{W}default"):
            cb.remove(child)
    checked = etree.SubElement(cb, f"{W}checked")
    checked.set(f"{W}val", "1")

    p = ff.getparent().getparent().getparent()
    state: bool | str = False
    for elem in p:
        if elem.tag == f"{W}r":
            fc = elem.find(f"{W}fldChar")
            if fc is not None:
                ft = fc.get(f"{W}fldCharType")
                if ft == "begin" and fc.find(f"{W}ffData") is ff:
                    state = True
                elif ft == "separate" and state is True:
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
        idx = start_index + i
        if idx >= len(all_ff):
            break
        ff = all_ff[idx]
        p = ff.getparent().getparent().getparent()
        state: bool | str = False
        for elem in p:
            if elem.tag == f"{W}r":
                fc = elem.find(f"{W}fldChar")
                if fc is not None:
                    ft = fc.get(f"{W}fldCharType")
                    if ft == "begin" and fc.find(f"{W}ffData") is ff:
                        state = True
                    elif ft == "separate" and state is True:
                        state = "sep"
                    elif ft == "end" and state == "sep":
                        break
                elif state == "sep":
                    if option_text == selected:
                        rPr = elem.find(f"{W}rPr")
                        if rPr is None:
                            rPr = etree.SubElement(elem, f"{W}rPr")
                            elem.insert(0, rPr)
                        if rPr.find(f"{W}b") is None:
                            etree.SubElement(rPr, f"{W}b")
                        if rPr.find(f"{W}u") is None:
                            u = etree.SubElement(rPr, f"{W}u")
                            u.set(f"{W}val", "single")
                    break


def _resolve_cell_by_visual_col(
    row_el: etree._Element,
    visual_col: int,
) -> etree._Element | None:
    """Find the table cell at a given visual column, accounting for gridSpan.

    In Word XML, a cell with <w:gridSpan w:val="2"/> occupies 2 visual columns
    but is only 1 <w:tc> element. This function maps visual column indices
    to the correct XML cell element.
    """
    cells = row_el.findall("w:tc", NS)
    current_visual = 0
    for cell in cells:
        # Check gridSpan
        tc_pr = cell.find("w:tcPr", NS)
        span = 1
        if tc_pr is not None:
            grid_span = tc_pr.find("w:gridSpan", NS)
            if grid_span is not None:
                try:
                    span = int(grid_span.get(f"{W}val", "1"))
                except (ValueError, TypeError):
                    span = 1
        if current_visual <= visual_col < current_visual + span:
            return cell
        current_visual += span
    return None


def _add_text_to_cell(
    table: etree._Element,
    row: int,
    col: int,
    text: str,
    size_pt: int = 8,
) -> None:
    """Insert a text run into a table cell, accounting for merged cells (gridSpan)."""
    rows = table.findall("w:tr", NS)
    if row >= len(rows):
        logger.warning(f"_add_text_to_cell: row {row} out of bounds (table has {len(rows)} rows)")
        return

    cell = _resolve_cell_by_visual_col(rows[row], col)
    if cell is None:
        logger.warning(f"_add_text_to_cell: visual col {col} not found in row {row}, text='{text[:50]}'")
        return
    p = cell.find("w:p", NS)
    if p is None:
        return

    r = etree.SubElement(p, f"{W}r")
    rPr = etree.SubElement(r, f"{W}rPr")
    sz = etree.SubElement(rPr, f"{W}sz")
    sz.set(f"{W}val", str(size_pt * 2))
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

    cell = _resolve_cell_by_visual_col(rows[row], col)
    if cell is None:
        return

    for t in cell.findall(f".//{W}t"):
        if t.text and original in t.text:
            t.text = t.text.replace(original, replacement)
            return
