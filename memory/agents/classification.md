# Dossier Parser Agent (Step 1)

## Purpose
Parses uploaded medical documents (any format, any DPI system) into a structured `PatientDossier` for Swiss disability insurance (AI) report generation. Step 1 of the wizard — the doctor uploads files and the agent extracts all clinical information.

## Input Patterns
1. **Single large PDF** (e.g. SMEEX/Mediway export) — 20+ pages containing the full patient dossier
2. **Multiple separate files** (PDF + DOCX + images) — each is a different document

Both are handled the same way: all content blocks are concatenated and sent in one LLM call.

## Architecture
- **Framework**: LangChain `with_structured_output()` (not agent — single-shot extraction)
- **Model**: OpenAI GPT-4o via `ChatOpenAI` (configurable via `OPENAI_MODEL`)
- **Input**: Multimodal content blocks — PDF pages as PNG images (pymupdf), DOCX as text, images as base64
- **Output**: `PatientDossier` Pydantic model enforced by structured output

## Files
```
backend/app/classification/
  __init__.py
  schemas.py     — PatientDossier, PatientInfo, TimelineEntry, Medication, Diagnostic, RapportAiFields
  constants.py   — DOSSIER_SYSTEM_PROMPT, FORM_FIELD_MAP, ALLOWED_EXTENSIONS
  helpers.py     — file_to_content_blocks() (PDF→PNG images via pymupdf, DOCX→text, image→base64)
  services.py    — _get_model(), parse_dossier()
  routes.py      — POST /api/parse-dossier
```

## Output Schema: PatientDossier
| Field | Type | Description |
|-------|------|-------------|
| `patient_info` | PatientInfo | Demographics + antecedents (all optional) |
| `timeline` | list[TimelineEntry] | Chronological clinical events (for psychiatrist review) |
| `medications` | list[Medication] | Consolidated medications with status |
| `diagnostics` | list[Diagnostic] | Consolidated diagnostics with CIM codes |
| `rapport_ai_fields` | RapportAiFields | 14 semantic fields pre-filled for rapport AI generation |

## RapportAiFields (14 canton-agnostic fields)
`antecedents`, `situation_actuelle`, `medication`, `constats_medicaux`, `diagnostics_incapacitants`, `diagnostics_sans_incidence`, `pronostic_capacite_travail`, `plan_traitement`, `situation_professionnelle`, `limitations_fonctionnelles`, `freins_readaptation`, `capacite_readaptation`, `fonctions_cognitives`, `activites_possibles`

These map to canton-specific form sections via `FORM_FIELD_MAP` in constants.py.

## File Handling
- **PDF**: Each page rendered to PNG at 150 DPI via pymupdf → sent as `data:image/png;base64,...`
- **Images** (jpg, png, tiff, bmp): Sent as `data:image/{mime};base64,...`
- **DOCX**: Text extracted via python-docx, truncated to 8000 chars, sent as text block
- **Multi-file**: Text separator inserted between files so model distinguishes documents

## Error Handling
If the LLM call fails, the error propagates to the route which returns a 500. No per-file fallback since all files are parsed together in one call.

## Model Abstraction
`_get_model()` in services.py — swap `ChatOpenAI` → `AzureChatOpenAI` in one place.
