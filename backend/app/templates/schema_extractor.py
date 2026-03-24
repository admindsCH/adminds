"""Schema extractor — detects fillable slots in .docx and .pdf templates.

DOCX: parses Word XML for legacy form fields (ffData), table cells, headers.
PDF:  reads AcroForm widgets via PyMuPDF — field names, types, options.

Each slot is returned as a RawSlot with position and context,
ready for the LLM labeler to assign semantic meaning.
"""

from __future__ import annotations

import io
import re

import fitz  # PyMuPDF
from docx import Document
from lxml import etree

from app.templates.schemas import RawSlot

# ── Word XML namespaces ──────────────────────────────────

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

# Known choice-grid header labels
_CHOICE_HEADERS = {
    "oui",
    "non",
    "ne sais pas",
    "ne_sais_pas",
    "limitée",
    "limitee",
    "non limitée",
    "non limitee",
    "fluctuant",
    "préciser",
    "preciser",
    "plein temps",
    "temps partiel",
    "yes",
    "no",
}

_PLACEHOLDER_RE = re.compile(
    r"^[\s_.…\u2026\[\]()]*$"
    r"|^\[.*compléter.*\]$"
    r"|^_{2,}$"
    r"|^\.{3,}$",
    re.IGNORECASE,
)


# ── Public API ───────────────────────────────────────────


def extract_raw_slots(file_bytes: bytes) -> list[RawSlot]:
    """Extract all fillable slots from a .docx or .pdf file.

    Detects format from magic bytes and dispatches accordingly.
    """
    if file_bytes[:4] == b"%PDF":
        return _extract_pdf_fields(file_bytes)
    if file_bytes[:2] == b"PK":
        return _extract_docx_slots(file_bytes)
    raise ValueError("Format non supporté. Fichier .docx ou .pdf requis.")


# ══════════════════════════════════════════════════════════
#  PDF EXTRACTION (AcroForm via PyMuPDF)
# ══════════════════════════════════════════════════════════


def _extract_pdf_fields(pdf_bytes: bytes) -> list[RawSlot]:
    """Extract AcroForm fields from a PDF using PyMuPDF.

    Each widget becomes a RawSlot with:
    - position = {"field_name": "..."} (the AcroForm field name is the key)
    - detected_field_type from widget type
    - context from surrounding text on the page
    - options for combo/listbox/radio widgets
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    slots: list[RawSlot] = []
    seen_names: set[str] = set()
    for page_num in range(len(doc)):
        page = doc[page_num]
        page_headings = _extract_section_headings(page)

        for widget in page.widgets():
            field_name = widget.field_name
            if not field_name or field_name in seen_names:
                continue
            seen_names.add(field_name)

            field_type = _map_widget_type(widget)

            # choice_values can be list[str] or list[tuple[str, str]]
            options: list[str] = []
            if widget.choice_values:
                for v in widget.choice_values:
                    options.append(v[0] if isinstance(v, tuple) else str(v))

            # Build context: section heading + nearby text
            # Use page-local headings for this page (no offset needed)
            context = _get_widget_context(page, widget, page_headings)

            slots.append(
                RawSlot(
                    slot_type="pdf_field",
                    position={"field_name": field_name},
                    detected_field_type=field_type,
                    context=context,
                    original_text=widget.field_value or None,
                    options=options,
                )
            )

    doc.close()
    return slots


def _map_widget_type(widget: fitz.Widget) -> str:
    """Map PyMuPDF widget field_type to our FieldType."""
    # fitz widget types: 0=unknown, 1=pushbutton, 2=checkbox,
    # 3=radiobutton, 4=text, 5=listbox, 6=combobox, 7=signature
    wt = widget.field_type
    if wt == 2:  # checkbox
        return "checkbox"
    if wt == 3:  # radio button
        return "select_one"
    if wt in (5, 6):  # listbox, combobox
        return "select_one"
    if wt == 4:  # text
        # Check if it looks like a date field from the name
        name_lower = (widget.field_name or "").lower()
        if any(d in name_lower for d in ("date", "datum", "naissance", "_du", "_au")):
            return "date"
        return "text"
    return "text"


def _get_widget_context(
    page: fitz.Page,
    widget: fitz.Widget,
    section_headings: list[tuple[float, str]],
    max_chars: int = 200,
) -> str:
    """Get text near a widget on the page for context.

    Combines:
    1. The current section heading (closest heading above the widget)
    2. Nearby text blocks (labels directly next to the field)
    """
    wr = widget.rect

    # Find the current section heading (closest heading above this widget)
    current_section = ""
    for heading_y, heading_text in section_headings:
        if heading_y <= wr.y0:
            current_section = heading_text
        else:
            break

    # Find nearby text (labels next to the field)
    search_rect = fitz.Rect(
        wr.x0 - 250,
        wr.y0 - 25,
        wr.x1 + 250,
        wr.y1 + 25,
    )
    blocks = page.get_text("blocks")
    nearby: list[tuple[float, str]] = []

    for block in blocks:
        bx0, by0, bx1, by1, text, *_ = block
        if not isinstance(text, str) or not text.strip():
            continue
        block_rect = fitz.Rect(bx0, by0, bx1, by1)
        if block_rect.intersects(search_rect):
            dist = abs(by0 - wr.y0) + abs(bx0 - wr.x0) * 0.5
            nearby.append((dist, text.strip()))

    nearby.sort(key=lambda x: x[0])
    label_parts = [text for _, text in nearby[:3]]

    parts = []
    if current_section:
        parts.append(f"Section: {current_section}")
    parts.extend(label_parts)
    return " | ".join(parts)[:max_chars]


def _extract_section_headings(page: fitz.Page) -> list[tuple[float, str]]:
    """Extract section headings from a page (bold or numbered lines).

    Returns list of (y_position, heading_text) sorted by y.
    """
    headings: list[tuple[float, str]] = []
    blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE).get(
        "blocks", []
    )

    for block in blocks:
        if block.get("type") != 0:  # text block only
            continue
        for line in block.get("lines", []):
            text = "".join(
                span.get("text", "") for span in line.get("spans", [])
            ).strip()
            if not text:
                continue
            # Detect headings: bold text or numbered sections like "3. Anamnèse"
            is_bold = any(span.get("flags", 0) & 2**4 for span in line.get("spans", []))
            is_numbered = bool(re.match(r"^\d+\.\s", text))
            if (is_bold or is_numbered) and len(text) > 3:
                y = line["bbox"][1]
                headings.append((y, text))

    headings.sort(key=lambda x: x[0])
    return headings


# ══════════════════════════════════════════════════════════
#  DOCX EXTRACTION (legacy form fields + table cells)
# ══════════════════════════════════════════════════════════


def _extract_docx_slots(docx_bytes: bytes) -> list[RawSlot]:
    """Extract slots from a .docx file using XML parsing."""
    doc = Document(io.BytesIO(docx_bytes))
    root = doc.element

    slots: list[RawSlot] = []
    slots.extend(_extract_form_fields(root))
    slots.extend(_extract_table_slots(root))
    return slots


# ── Form field extraction ────────────────────────────────


def _extract_form_fields(root: etree._Element) -> list[RawSlot]:
    """Find all legacy form fields (w:ffData) and classify them."""
    all_ff = root.findall(f".//{W}ffData")
    if not all_ff:
        return []

    slots: list[RawSlot] = []
    processed: set[int] = set()

    # Detect SELECT_ONE: consecutive text fields with short default labels
    i = 0
    while i < len(all_ff):
        if not _is_text_field(all_ff[i]):
            i += 1
            continue

        run: list[tuple[int, str]] = []
        j = i
        while j < len(all_ff) and _is_text_field(all_ff[j]):
            default = _get_ff_default_text(all_ff[j])
            if default and len(default) < 60:
                run.append((j, default))
                j += 1
            else:
                break

        if len(run) >= 2:
            options = [text for _, text in run]
            context = _get_element_context(all_ff[run[0][0]])
            slots.append(
                RawSlot(
                    slot_type="form_field",
                    position={"ff_index": run[0][0]},
                    detected_field_type="select_one",
                    context=context,
                    options=options,
                )
            )
            for idx, _ in run:
                processed.add(idx)
            i = j
        else:
            i += 1

    for idx, ff in enumerate(all_ff):
        if idx in processed:
            continue
        slots.append(
            RawSlot(
                slot_type="form_field",
                position={"ff_index": idx},
                detected_field_type=_detect_ff_type(ff),
                context=_get_element_context(ff),
            )
        )

    return slots


def _is_text_field(ff: etree._Element) -> bool:
    return ff.find(f"{W}checkBox") is None and ff.find(f"{W}ddList") is None


def _detect_ff_type(ff: etree._Element) -> str:
    if ff.find(f"{W}checkBox") is not None:
        return "checkbox"
    name_el = ff.find(f"{W}name")
    if name_el is not None:
        name = name_el.get(f"{W}val", "").lower()
        if "date" in name or "datum" in name:
            return "date"
    return "text"


def _get_ff_default_text(ff: etree._Element) -> str:
    p = _get_parent_paragraph(ff)
    if p is None:
        return ""
    state = False
    for elem in p:
        if elem.tag == f"{W}r":
            fc = elem.find(f"{W}fldChar")
            if fc is not None:
                ft = fc.get(f"{W}fldCharType")
                if ft == "begin" and fc.find(f"{W}ffData") is ff:
                    state = True
                elif ft == "separate" and state:
                    state = "sep"
                elif ft == "end" and state == "sep":
                    break
            elif state == "sep":
                t = elem.find(f"{W}t")
                if t is not None and t.text:
                    return t.text.strip()
    return ""


# ── Table slot extraction ────────────────────────────────


def _extract_table_slots(root: etree._Element) -> list[RawSlot]:
    """Find fillable cells in tables."""
    tables = root.findall(f".//{W}tbl")
    slots: list[RawSlot] = []

    for table_idx, table in enumerate(tables):
        rows = table.findall(f"{W}tr")
        if not rows:
            continue

        # Skip tables that contain form fields — those are header/metadata
        # tables already handled by _extract_form_fields
        if table.findall(f".//{W}ffData"):
            continue

        header_texts = _get_row_texts(rows[0])
        choice_columns = _detect_choice_grid(header_texts)
        table_context = _get_preceding_text(table)

        for row_idx, row in enumerate(rows):
            cells = row.findall(f"{W}tc")
            for col_idx, cell in enumerate(cells):
                cell_text = _get_cell_text(cell).strip()

                if choice_columns and row_idx > 0 and col_idx == 0:
                    if cell_text:
                        context = f"[Table] {table_context} | Row: {cell_text} | Headers: {', '.join(header_texts)}"
                        slots.append(
                            RawSlot(
                                slot_type="table_cell",
                                position={
                                    "table_index": table_idx,
                                    "row": row_idx,
                                    "col": col_idx,
                                },
                                detected_field_type="choice",
                                context=context,
                                options=list(choice_columns.keys()),
                                choice_columns=choice_columns,
                            )
                        )
                elif not choice_columns:
                    is_empty = not cell_text
                    is_placeholder = bool(
                        cell_text and _PLACEHOLDER_RE.match(cell_text)
                    )
                    if is_empty or is_placeholder:
                        row_header = (
                            _get_cell_text(cells[0]).strip()
                            if col_idx > 0 and cells
                            else ""
                        )
                        col_header = ""
                        if row_idx > 0 and rows:
                            header_cells = rows[0].findall(f"{W}tc")
                            if col_idx < len(header_cells):
                                col_header = _get_cell_text(
                                    header_cells[col_idx]
                                ).strip()
                        context_parts = [f"[Table] {table_context}"]
                        if row_header:
                            context_parts.append(f"Row: {row_header}")
                        if col_header:
                            context_parts.append(f"Col: {col_header}")
                        slots.append(
                            RawSlot(
                                slot_type="table_cell",
                                position={
                                    "table_index": table_idx,
                                    "row": row_idx,
                                    "col": col_idx,
                                },
                                detected_field_type="text",
                                context=" | ".join(context_parts),
                                original_text=cell_text if is_placeholder else None,
                            )
                        )

    return slots


def _detect_choice_grid(header_texts: list[str]) -> dict[str, int] | None:
    if len(header_texts) < 2:
        return None
    matches = 0
    columns: dict[str, int] = {}
    for col_idx, text in enumerate(header_texts):
        normalized = text.strip().lower()
        if normalized in _CHOICE_HEADERS:
            matches += 1
            columns[normalized] = col_idx
    if matches >= 2:
        return columns
    return None


# ── Text helpers ─────────────────────────────────────────


def _get_cell_text(cell: etree._Element) -> str:
    return " ".join(t.text for t in cell.findall(f".//{W}t") if t.text)


def _get_row_texts(row: etree._Element) -> list[str]:
    return [_get_cell_text(cell) for cell in row.findall(f"{W}tc")]


def _get_parent_paragraph(element: etree._Element) -> etree._Element | None:
    current = element
    while current is not None:
        if current.tag == f"{W}p":
            return current
        current = current.getparent()
    return None


def _get_element_context(element: etree._Element) -> str:
    """Get context around a form field element — no truncation."""
    p = _get_parent_paragraph(element)
    if p is None:
        return ""
    parts: list[str] = []
    parent = p.getparent()
    if parent is None:
        return _get_paragraph_text(p)
    found = False
    for sibling in parent:
        if sibling is p:
            found = True
            parts.append(f">>> {_get_paragraph_text(p)}")
            continue
        if sibling.tag == f"{W}p":
            text = _get_paragraph_text(sibling)
            if text.strip():
                if not found:
                    parts.append(text)
                else:
                    parts.append(text)
                    break
    return " | ".join(parts[-4:])


def _get_paragraph_text(p: etree._Element) -> str:
    return " ".join(t.text for t in p.findall(f".//{W}t") if t.text)


def _get_preceding_text(element: etree._Element) -> str:
    """Get ALL text between the previous table and *element*.

    Walks backwards through siblings, collecting paragraph text until
    another ``<w:tbl>`` (or the document start) is reached.  This gives
    the complete question text that precedes an answer table — including
    question numbers, sub-questions, and instructions — so the LLM
    labeler can unambiguously identify the field.
    """
    parent = element.getparent()
    if parent is None:
        return ""
    # Collect paragraphs between the previous table and this element
    paragraphs: list[str] = []
    for sibling in parent:
        if sibling is element:
            break
        if sibling.tag == f"{W}tbl":
            # Reset: only keep text AFTER the most recent table
            paragraphs = []
        elif sibling.tag == f"{W}p":
            text = _get_paragraph_text(sibling).strip()
            if text:
                paragraphs.append(text)
    return " | ".join(paragraphs)
