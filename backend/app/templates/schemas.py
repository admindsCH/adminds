"""Pydantic models for the generic template engine.

Two template formats supported:
- DOCX: slots are form fields (ffData), table cells, header labels
- PDF:  slots are AcroForm widgets (text, checkbox, combo, radio, listbox)

RawSlot — output of the parser (positions + context, no semantic labels).
SchemaField — labeled slot (position + semantic info, ready for LLM prompt + filler).
TemplateSchema — complete schema for a template, stored as JSON in blob storage.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

# Slot types across both formats
SlotType = Literal[
    # DOCX slots
    "form_field",  # legacy ffData form field
    "table_cell",  # table cell (empty or choice grid)
    "header_label",  # static label cell for text replacement
    # PDF slots
    "pdf_field",  # AcroForm widget (text, checkbox, combo, etc.)
]

FieldType = Literal["text", "date", "checkbox", "select_one", "choice"]


# ── Raw slot (output of parser, input to LLM labeler) ─


class RawSlot(BaseModel):
    """A detected fillable slot before LLM labeling."""

    slot_type: SlotType

    # Position in the document:
    #   form_field   → {"ff_index": int}
    #   table_cell   → {"table_index": int, "row": int, "col": int}
    #   header_label → {"table_index": int, "row": int, "col": int}
    #   pdf_field    → {"field_name": str}  (AcroForm field name is the key)
    position: dict[str, Any]

    detected_field_type: FieldType
    context: str  # surrounding text for LLM (~150 chars)

    original_text: str | None = None
    options: list[str] = Field(default_factory=list)
    choice_columns: dict[str, int] | None = None


# ── Labeled schema field (output of LLM labeler) ─────────


class SchemaField(BaseModel):
    """A fully labeled slot — position + semantic info. Used by both
    the LLM prompt builder and the generic filler."""

    id: str  # snake_case field ID (LLM-assigned)
    slot_type: SlotType
    position: dict[str, Any]  # same as RawSlot.position
    field_type: FieldType
    label: str  # human-readable label (French)
    section: str  # section grouping
    hint: str = ""  # guidance for the content-generation LLM
    options: list[str] = Field(default_factory=list)
    original_text: str | None = None
    choice_columns: dict[str, int] | None = None
    mapped_rubrique: str | None = None  # r01_historique .. r08_activites


# ── Complete template schema (stored in blob storage) ─────


class TemplateSchema(BaseModel):
    """Full schema for a template — stored as JSON in the 'schemas' container."""

    template_id: str
    template_name: str
    fields: list[SchemaField]
    template_format: Literal["docx", "pdf"] = "docx"
    canton_addendum: str = ""  # auto-generated semantic mapping text
    extracted_at: str  # ISO timestamp

    def to_prompt_schema(self) -> list[dict[str, Any]]:
        """Strip position data — produce the list injected into the LLM prompt.

        Same shape as the existing get_ai_prompt_schema() output:
        [{id, type, label, section, hint, options?}, ...]
        """
        result = []
        for f in self.fields:
            entry: dict[str, Any] = {
                "id": f.id,
                "type": f.field_type,
                "label": f.label,
                "section": f.section,
            }
            if f.hint:
                entry["hint"] = f.hint
            if f.options:
                entry["options"] = f.options
            result.append(entry)
        return result


# ── API request / response models ─────────────────────────


class TemplateResponse(BaseModel):
    """Returned by GET /api/templates and POST /api/templates."""

    id: str
    name: str
    description: str = ""
    category: str = "rapport-ai"
    insurance_id: str = ""
    canton: str = "all"
    estimated_minutes: int = 5
    page_count: int = 1
    is_official: bool = False
    has_schema: bool = False
    filename: str = ""
    size: int = 0


class ExtractSchemaResponse(BaseModel):
    """Returned after schema extraction."""

    template_id: str
    field_count: int
    sections: list[str]
