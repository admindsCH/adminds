# Adminds — Project Status & Roadmap

Last updated: 2026-03-10

---

## What's Built (MVP near-complete)

### Frontend (Next.js 16)
- [x] **Auth** — Clerk sign-in/sign-up, redirect to `/dashboard`
- [x] **Dashboard shell** — White card on grey bg, Clerk UserButton top-right
- [x] **Settings** — Name + canton selector (Fribourg/Geneva), syncs to Clerk metadata
- [x] **Rapport Wizard** (`/dashboard/rapport`) — **3-step flow** (Documents → Résumé → Rapport):
  - Step 1: Document upload with drag-and-drop, real classification via `/api/classify`
  - Step 2: AI-extracted summary — fully editable inline (auto-save on blur via PATCH), notes + voice dictation integrated here
  - Step 3: Report generation — calls real backend, in-browser .docx preview (`docx-preview`), PDF/DOCX download
- [x] **Editable report sections** — Slide-over panel in Step 3 with canton-specific fields (still mock field values)
- [x] **Frontend types** — `frontend/src/lib/schemas/classification.ts` with PatientDossier, DossierResponse, PatientDossierPatch
- [x] **API client** — `api.ts` with `classifyDocuments`, `parseDossier`, `getDossier`, `updateDossier`, `generateReport` (blob download)
- [x] **Marketing site** — Landing page, team, pricing, privacy/terms

### Backend (FastAPI)
- [x] **Classification Agent** — `POST /api/classify`: uploads files → GPT-4o vision classifies each → structured JSON
- [x] **Parse-dossier Agent** — `POST /api/parse-dossier`: uploads files → GPT-4o extracts PatientDossier → stores in memory → returns DossierResponse
- [x] **Dossier CRUD** — `GET /api/dossiers/{id}` + `PATCH /api/dossiers/{id}` (deep-merge partial updates)
- [x] **In-memory dossier store** — `classification/store.py`: dict keyed by UUID, deep merge for PATCH
- [x] **Report generation** — `POST /api/generate-report`: fetches stored dossier → GPT-4o JSON mode fills canton-specific fields → docx filler → returns .docx blob
- [x] **DOCX filler services** — Template filling for Fribourg (~106 fields) and Geneva (~21 fields)
- [x] **Field maps** — Complete field definitions + `get_ai_prompt_schema()` for both cantons
- [x] **Templates** — `backend/templates/fribourg.docx` and `geneve.docx`

### Infrastructure
- [x] **Clerk auth** — Configured for frontend
- [x] **OpenAI** — Connected via `langchain-openai` (ChatOpenAI, configurable model)
- [ ] **Azure PostgreSQL** — Not connected (in-memory store for now)
- [ ] **Azure Blob Storage** — Not connected

---

## What's Still Mock / Not Connected

| Feature | Current State | What It Needs |
|---------|--------------|---------------|
| Slide-over editor field values | Uses `MOCK_FRIBOURG_FIELDS`/`MOCK_GENEVE_FIELDS` | Wire to real LLM-generated values from report endpoint |
| "Mettre à jour" button | 800ms loading flash | Re-generate report with edited field values |
| Database | In-memory dict (lost on restart) | asyncpg + Alembic migrations |
| Auth (backend) | Not implemented | Clerk JWT validation |
| File storage | Files only in memory during request | Azure Blob Storage |

---

## Next Steps (Prioritized)

### Phase 1: Test & Refine (current)
> Goal: End-to-end testing with real medical documents, fix issues.

1. **Test full flow** — Upload real PDFs → classify → parse dossier → edit → generate report
2. **Fix prompt quality** — Tune classification + report generation prompts based on real output
3. **Wire slide-over editor** — Use real LLM field values instead of mock data
4. **Clean up** — Delete unused `step-supplements.tsx`, remove stale mock data

### Phase 2: Persistence & Auth
> Goal: Save drafts, resume later, proper auth.

1. Set up asyncpg + Alembic migrations
2. Replace in-memory store with PostgreSQL
3. Rewrite auth → Clerk JWT validation on backend
4. Azure Blob Storage for document persistence
5. Save/resume report drafts

### Phase 3: Production Readiness
> Goal: Deploy and polish.

1. Azure Container Apps deployment
2. Error handling, logging, monitoring
3. Rate limiting, input validation hardening
4. PDF generation (server-side, not browser print)

---

## Key Files Reference

| Area | Files |
|------|-------|
| Wizard UI | `frontend/src/app/dashboard/rapport/page.tsx` |
| Frontend schemas | `frontend/src/lib/schemas/classification.ts` |
| API client | `frontend/src/lib/api.ts` |
| Mock data (partial) | `frontend/src/lib/mock-data.ts` |
| Docx templates (FE) | `frontend/public/templates/{canton}.docx` |
| Classification module | `backend/app/classification/` (routes, services, schemas, constants, helpers, store) |
| Report module | `backend/app/report/` (routes, services, schemas, constants) |
| Docx templates (BE) | `backend/templates/{canton}.docx` |
| Fribourg filler | `backend/app/services/docx_filler.py` + `fribourg_field_map.py` |
| Geneva filler | `backend/app/services/docx_filler_geneve.py` + `geneve_field_map.py` |
| Settings | `backend/app/config.py` |
| Agent docs | `memory/agents/classification.md` |
