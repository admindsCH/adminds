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

from app.templates.docx_compat import normalize_docx_bytes
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
    "de manière fluctuante",
    "préciser",
    "preciser",
    "plein temps",
    "temps partiel",
    "yes",
    "no",
}


# Normalize header text for matching: strip accents and extra whitespace
def _normalize_header(text: str) -> str:
    """Normalize a table header for choice grid detection."""
    import unicodedata as _ud

    text = text.strip().lower()
    text = " ".join(text.split())  # collapse whitespace
    text = _ud.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    return text


_PLACEHOLDER_RE = re.compile(
    r"^[\s_.…\u2026\[\]()]*$"
    r"|^\[.*compléter.*\]$"
    r"|^_{2,}$"
    r"|^\.{3,}$",
    re.IGNORECASE,
)


def extract_raw_slots(file_bytes: bytes) -> list[RawSlot]:
    """Extract all fillable slots from a .docx or .pdf file.

    Detects format from magic bytes and dispatches accordingly.
    """
    if file_bytes[:4] == b"%PDF":
        return _extract_pdf_fields(file_bytes)
    if file_bytes[:2] == b"PK":
        return _extract_docx_slots(file_bytes)
    raise ValueError("Format non supporté. Fichier .docx ou .pdf requis.")


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
        # Cache text blocks once per page (avoid re-extracting per widget)
        page_blocks = page.get_text("blocks")

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
            context = _get_widget_context(widget, page_blocks, page_headings)

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
    widget: fitz.Widget,
    page_blocks: list,
    section_headings: list[tuple[float, str]],
    max_chars: int = 200,
) -> str:
    """Get text near a widget on the page for context.

    Combines:
    1. The current section heading (closest heading above the widget)
    2. Nearby text blocks (labels directly next to the field)

    Args:
        widget: The PDF widget.
        page_blocks: Pre-extracted text blocks from page.get_text("blocks").
        section_headings: Pre-extracted headings from _extract_section_headings().
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
    nearby: list[tuple[float, str]] = []

    for block in page_blocks:
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


def _extract_docx_slots(docx_bytes: bytes) -> list[RawSlot]:
    """Extract slots from a .docx file using XML parsing."""
    doc = Document(io.BytesIO(normalize_docx_bytes(docx_bytes)))
    root = doc.element

    slots: list[RawSlot] = []
    slots.extend(_extract_form_fields(root))
    slots.extend(_extract_table_slots(root))

    # Fallback: plain-text Q&A documents with no structured fields
    if not slots:
        slots.extend(_extract_paragraph_slots(doc))

    return slots


# ── Paragraph Q&A extraction (fallback) ────────────────


_QUESTION_RE = re.compile(r"^\d+[\.\-\)_]+\s")


def _extract_paragraph_slots(doc: Document) -> list[RawSlot]:
    """Fallback extractor for plain-text Q&A documents.

    Detects numbered questions (e.g. "1-", "2.", "3)") and emits one
    text slot per question.  Sub-items (bullets, lettered items) between
    questions are collected as context.
    """
    paragraphs = doc.paragraphs
    # First pass: find indices of top-level numbered questions
    question_indices: list[int] = []
    for i, para in enumerate(paragraphs):
        if _QUESTION_RE.match(para.text.strip()):
            question_indices.append(i)

    if not question_indices:
        return []

    slots: list[RawSlot] = []
    for q_pos, q_idx in enumerate(question_indices):
        # Determine where this question's content ends
        next_q_idx = (
            question_indices[q_pos + 1]
            if q_pos + 1 < len(question_indices)
            else len(paragraphs)
        )
        # Build context: question text + all sub-items until next question
        parts = [paragraphs[q_idx].text.strip()]
        for j in range(q_idx + 1, next_q_idx):
            sub = paragraphs[j].text.strip()
            if sub:
                parts.append(sub)
        context = " | ".join(parts)

        # Insert answer after the last non-empty paragraph of this question,
        # so for questions with sub-items the answer goes after the sub-items.
        insert_after = q_idx
        for j in range(next_q_idx - 1, q_idx, -1):
            if paragraphs[j].text.strip():
                insert_after = j
                break

        slots.append(
            RawSlot(
                slot_type="paragraph",
                position={"paragraph_index": q_idx, "insert_after": insert_after},
                detected_field_type="text",
                context=context,
            )
        )

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

        # Identify which columns are choice columns (for "X" marking)
        choice_col_indices = set(choice_columns.values()) if choice_columns else set()

        _DETAIL_KEYWORDS = (
            "préciser",
            "preciser",
            "genre",
            "rendement",
            "taux",
            "durée",
            "duree",
            "fréquence",
            "frequence",
        )

        for row_idx, row in enumerate(rows):
            cells = row.findall(f"{W}tc")

            # ── Per-row check: does this row actually follow the choice pattern?
            # A row follows the choice pattern if the choice columns (oui/non/etc.)
            # are EMPTY or contain only short markers (x, X, ☒).
            # If choice columns contain substantial text (e.g. "Fréquence: ..."),
            # this row is NOT a choice row — treat all its cells as text fields.
            row_follows_choice = False
            if choice_columns and row_idx > 0:
                row_follows_choice = True
                for _cc_col in choice_col_indices:
                    if _cc_col < len(cells):
                        cc_text = _get_cell_text(cells[_cc_col]).strip()
                        # Choice cells should be empty or contain only short markers
                        if (
                            cc_text
                            and len(cc_text) > 3
                            and cc_text.lower() not in ("x", "☒", "☐")
                        ):
                            row_follows_choice = False
                            break

            for col_idx, cell in enumerate(cells):
                cell_text = _get_cell_text(cell).strip()
                visual_col = _visual_col_index(cells, col_idx)

                if row_follows_choice and visual_col == 0:
                    # Row label cell in a choice grid → emit choice field
                    if cell_text:
                        context = f"[Table] {table_context} | Row: {cell_text} | Headers: {', '.join(header_texts)}"
                        slots.append(
                            RawSlot(
                                slot_type="table_cell",
                                position={
                                    "table_index": table_idx,
                                    "row": row_idx,
                                    "col": _visual_col_index(cells, col_idx),
                                },
                                detected_field_type="choice",
                                context=context,
                                options=list(choice_columns.keys()),
                                choice_columns=choice_columns,
                            )
                        )
                elif (
                    row_follows_choice
                    and visual_col not in choice_col_indices
                    and visual_col > 0
                ):
                    # Non-choice column in a choice grid row → justification/detail text
                    row_label = _get_cell_text(cells[0]).strip() if cells else ""
                    col_header = ""
                    if rows:
                        header_cells = rows[0].findall(f"{W}tc")
                        if col_idx < len(header_cells):
                            col_header = _get_cell_text(header_cells[col_idx]).strip()
                    is_empty = not cell_text
                    is_placeholder = bool(
                        cell_text and _PLACEHOLDER_RE.match(cell_text)
                    )
                    is_detail_col = col_header and any(
                        kw in col_header.lower() for kw in _DETAIL_KEYWORDS
                    )
                    is_detail_cell = cell_text and any(
                        kw in cell_text.lower() for kw in _DETAIL_KEYWORDS
                    )
                    if is_empty or is_placeholder or is_detail_col or is_detail_cell:
                        context = f"[Table] {table_context} | Row: {row_label} | Col: {col_header} | Headers: {', '.join(header_texts)}"
                        slots.append(
                            RawSlot(
                                slot_type="table_cell",
                                position={
                                    "table_index": table_idx,
                                    "row": row_idx,
                                    "col": _visual_col_index(cells, col_idx),
                                },
                                detected_field_type="text",
                                context=context,
                            )
                        )
                elif (
                    choice_columns
                    and row_idx > 0
                    and not row_follows_choice
                    and visual_col > 0
                ):
                    # Non-choice row in a choice grid table (e.g. D.3 with "Fréquence"/"Durée")
                    # → treat each non-label cell as a text field
                    row_label = _get_cell_text(cells[0]).strip() if cells else ""
                    col_header = ""
                    if rows:
                        header_cells = rows[0].findall(f"{W}tc")
                        if col_idx < len(header_cells):
                            col_header = _get_cell_text(header_cells[col_idx]).strip()
                    is_empty = not cell_text
                    is_placeholder = bool(
                        cell_text and _PLACEHOLDER_RE.match(cell_text)
                    )
                    has_label_with_space = cell_text and ":" in cell_text
                    is_detail_cell = cell_text and any(
                        kw in cell_text.lower() for kw in _DETAIL_KEYWORDS
                    )
                    if (
                        is_empty
                        or is_placeholder
                        or has_label_with_space
                        or is_detail_cell
                    ):
                        context = f"[Table] {table_context} | Row: {row_label} | Cell: {cell_text} | Headers: {', '.join(header_texts)}"
                        slots.append(
                            RawSlot(
                                slot_type="table_cell",
                                position={
                                    "table_index": table_idx,
                                    "row": row_idx,
                                    "col": _visual_col_index(cells, col_idx),
                                },
                                detected_field_type="text",
                                context=context,
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
                            if visual_col > 0 and cells
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
                                    "col": _visual_col_index(cells, col_idx),
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
    # Build a normalized version of _CHOICE_HEADERS for fuzzy matching
    normalized_headers = {_normalize_header(h) for h in _CHOICE_HEADERS}
    matches = 0
    columns: dict[str, int] = {}
    for col_idx, text in enumerate(header_texts):
        normalized = _normalize_header(text)
        if normalized in normalized_headers:
            matches += 1
            columns[normalized] = col_idx
    if matches >= 2:
        return columns
    return None


def _get_cell_text(cell: etree._Element) -> str:
    return " ".join(t.text for t in cell.findall(f".//{W}t") if t.text)


def _get_cell_grid_span(cell: etree._Element) -> int:
    """Return the gridSpan value of a cell (1 if not merged)."""
    tc_pr = cell.find(f"{W}tcPr")
    if tc_pr is not None:
        gs = tc_pr.find(f"{W}gridSpan")
        if gs is not None:
            try:
                return int(gs.get(f"{W}val", "1"))
            except (ValueError, TypeError):
                pass
    return 1


def _visual_col_index(cells: list, xml_col_idx: int) -> int:
    """Compute the visual column index of a cell, accounting for gridSpan."""
    visual = 0
    for i, cell in enumerate(cells):
        if i == xml_col_idx:
            return visual
        visual += _get_cell_grid_span(cell)
    return visual


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
    """Get context around a form field element — no truncation.

    If the form field lives inside a table cell, walks up to the table
    and captures the preceding body-level text (question text above the
    table), giving the LLM the full question to label correctly.
    """
    p = _get_parent_paragraph(element)
    if p is None:
        return ""

    # Check if this paragraph is inside a table cell
    ancestor = p.getparent()
    while ancestor is not None:
        if ancestor.tag == f"{W}tbl":
            # Form field is inside a table — get the text before this table
            return _get_preceding_text(ancestor)
        ancestor = ancestor.getparent()

    # Not in a table — walk siblings of the parent
    parent = p.getparent()
    if parent is None:
        return _get_paragraph_text(p)
    parts: list[str] = []
    found = False
    for sibling in parent:
        if sibling is p:
            found = True
            parts.append(f">>> {_get_paragraph_text(p)}")
            continue
        if sibling.tag == f"{W}p":
            text = _get_paragraph_text(sibling)
            if text.strip():
                parts.append(text)
                if found:
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
