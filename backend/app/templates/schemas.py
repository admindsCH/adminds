from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

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
    section_number: str = ""  # e.g. "2.2" — extracted from the template heading
    hint: str = ""  # guidance for the content-generation LLM
    options: list[str] = Field(default_factory=list)
    original_text: str | None = None
    choice_columns: dict[str, int] | None = None
    mapped_rubrique: str | None = None  # r01_historique .. r08_activites


class TemplateSchema(BaseModel):
    """Full schema for a template — stored as JSON in the 'schemas' container."""

    template_id: str
    template_name: str
    fields: list[SchemaField]
    template_format: Literal["docx", "pdf"] = "docx"
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
            if f.section_number:
                entry["section_number"] = f.section_number
            if f.hint:
                entry["hint"] = f.hint
            if f.options:
                entry["options"] = f.options
            if f.choice_columns:
                entry["valid_values"] = list(f.choice_columns.keys())
            result.append(entry)
        return result


class TemplateResponse(BaseModel):
    """Returned by GET /api/templates and POST /api/templates."""

    id: str
    name: str
    description: str = ""
    category: str = "rapport-ai"
    insurance_id: str = ""
    insurance_name: str = ""
    canton: str = "all"
    estimated_minutes: int = 5
    page_count: int = 1
    is_official: bool = False
    has_schema: bool = False
    filename: str = ""
    size: int = 0
    created_at: str = ""


class RenameTemplateRequest(BaseModel):
    """Request body for PATCH /api/templates/{template_id}/rename."""

    name: str = Field(..., min_length=1, max_length=200)


class ExtractSchemaResponse(BaseModel):
    """Returned after schema extraction."""

    template_id: str
    field_count: int
    sections: list[str]


class UpdateSchemaRequest(BaseModel):
    """Request body for PUT /api/templates/{template_id}/schema."""

    fields: list[SchemaField]


class TemplateClassification(BaseModel):
    """Structured output from the template classifier LLM call."""

    name: str = Field(description="Nom court et clair du formulaire en français (ex: 'Rapport AI Fribourg', 'Certificat médical SUVA'). Max 50 caractères.")
    description: str = Field(description="Description d'une ligne expliquant le but du formulaire. Max 100 caractères.")
    category: str = Field(description="Une parmi: 'rapport-ai' (assurance invalidité), 'rapport-medical' (rapport médical initial ou de suivi), 'rapport-assurance' (assurance privée), 'rapport-perte-gain' (attestation perte de gain).")
    canton: str = Field(description="Canton cible: 'fribourg', 'geneve', ou 'all' si non spécifique à un canton.")
    insurance: str = Field(description="Nom de l'assurance si identifiable (ex: 'SUVA', 'CSS', 'AI fédérale'), sinon chaîne vide.")
    page_count: int = Field(description="Nombre estimé de pages du formulaire rempli.")

    @field_validator("name")
    @classmethod
    def truncate_name(cls, v: str) -> str:
        return v[:50]

    @field_validator("description")
    @classmethod
    def truncate_description(cls, v: str) -> str:
        return v[:100]
