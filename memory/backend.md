# Backend

## Stack
- FastAPI with Pydantic models, async handlers
- LangChain agent framework (`create_agent`) for AI features
- OpenAI GPT-4o via `langchain-openai` (abstracted for Azure swap)
- asyncpg for PostgreSQL (connection pool, raw SQL) — not connected yet
- Alembic for database migrations — not set up yet
- uv for Python package management

## Code Conventions
- snake_case for everything
- Type hints on all function signatures
- Pydantic BaseModel for all request/response schemas
- All route handlers and DB calls must be async
- `Depends(get_current_user)` on every authenticated endpoint
- Return `{"detail": "Human-readable message"}` with HTTP status codes
- `logging.getLogger("app")` — never log secrets
- All settings via `app/config.py` (Pydantic BaseSettings from env vars)
- **API prefix**: `/api/` (no versioning)
- **Feature modules**: each feature gets its own folder with routes.py, services.py, schemas.py, constants.py
- Routes are **thin** — just call `services.function_name()` and return
- Register routers in `app/main.py`

## Current Files
```
app/
  main.py          — FastAPI app, CORS, health, router registration
  config.py        — Settings from env vars (app URLs + OpenAI)
  schemas.py       — Shared Pydantic models (HealthResponse, ErrorResponse)
  routers/
    hello.py       — Test endpoint
  services/
    docx_filler.py         — Fribourg .docx template filler (python-docx + lxml)
    docx_filler_geneve.py  — Geneva .docx template filler
    fribourg_field_map.py  — 100+ field definitions for Fribourg template (767 lines)
    geneve_field_map.py    — 18 field definitions for Geneva template (249 lines)
  classification/          — Classification + dossier parsing (Steps 1-2)
    schemas.py     — PatientDossier, PatientDossierPatch, DossierResponse, ClassifiedDocument
    constants.py   — Prompt, FORM_FIELD_MAP, ALLOWED_EXTENSIONS
    helpers.py     — file_to_content_blocks() (PDF/image→base64, DOCX→text)
    services.py    — classify_documents(), parse_and_store_dossier(), get/patch_dossier()
    routes.py      — POST /api/classify, POST /api/parse-dossier, GET/PATCH /api/dossiers/{id}
    store.py       — In-memory dossier store (dict[str, PatientDossier]), deep merge for PATCH
  report/                  — Report generation (Step 3)
    schemas.py     — GenerateReportRequest
    constants.py   — REPORT_SYSTEM_PROMPT (field schema + canton name placeholders)
    services.py    — generate_report(): fetch dossier → GPT-4o JSON mode → fill docx → StreamingResponse
    routes.py      — POST /api/generate-report
templates/
  fribourg.docx    — Official Fribourg AI report template
  geneve.docx      — Official Geneva AI report template
```

## Agent Architecture
LangChain-based system. Each wizard step has a specialized AI pipeline:
```
Step 1: Classification Agent  ✅ — create_agent + structured output (Pydantic)
Step 2: Parse-dossier Agent   ✅ — create_agent + structured output (PatientDossier)
Step 3: Report Generator      ✅ — ChatOpenAI JSON mode + docx filler
```

- **Steps 1-2** use `create_agent()` with `response_format` (Pydantic structured output)
- **Step 3** uses raw `ChatOpenAI` with `response_format={"type": "json_object"}` because Fribourg has ~106 fields — too many for a Pydantic model
- All use `_get_model()` factory for easy OpenAI → Azure swap
- Agent detail docs: `memory/agents/{agent_name}.md`

## DOCX Template Filling Services

### Architecture
- Input: `dict[str, Any]` with field IDs as keys → Output: filled `.docx` as `bytes`
- Uses `python-docx` + `lxml` for low-level Word XML manipulation

### Fribourg Template (`docx_filler.py`, 258 lines)
- Complex form: 55 fldChar-based form fields + table cells across 6 sections
- Field types: TEXT, DATE, CHECKBOX, SELECT_ONE, CHOICE

### Geneva Template (`docx_filler_geneve.py`, 101 lines)
- Simpler: 4 header form fields + 14 single-cell answer tables

### Field Maps
- `fribourg_field_map.py`: `FormField`, `TableCell`, `HeaderLabel` dataclasses; `CHOICE_COLUMNS` mapping; `get_ai_prompt_schema()`
- `geneve_field_map.py`: `FormField` + `AnswerTable` dataclasses with field indices

---

## TODO (Backend)
- [ ] Rewrite `auth.py` → Clerk JWT validation
- [ ] Set up asyncpg + Alembic migrations (replace in-memory store)
- [ ] Add `services/blob.py` — Azure Blob Storage for document persistence
- [ ] Wire slide-over editor to real LLM field values (not mock)
- [ ] "Mettre à jour" — re-generate report with edited fields

## Adding a New Agent
1. Create folder `app/{agent_name}/`
2. Add `schemas.py` (Pydantic models), `constants.py` (prompt, config), `helpers.py` (if needed), `services.py` (agent logic), `routes.py` (thin)
3. Register router in `app/main.py` with `prefix="/api"`
4. Create `memory/agents/{agent_name}.md` documenting the agent
5. Reference in this file and MEMORY.md
