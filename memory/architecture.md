# Architecture

## Overview
Multi-cabinet SaaS, 100% Swiss-hosted on Azure Switzerland North (failover to West). No patient data leaves Swiss territory.

## Azure Services

| Service | Usage |
|---------|-------|
| Azure Container Apps | Next.js frontend + FastAPI backend (autoscaling serverless) |
| Azure PostgreSQL Flexible | Main database — AES-256 encrypted at rest |
| Azure Blob Storage | Raw document storage — CMK encryption per cabinet |
| Azure Document Intelligence | OCR / text extraction (Layout mode) — PDF, DOCX, images/scans (region CH) |
| Azure OpenAI Service (CH North) | GPT-4o via Private Endpoint — zero data retention |
| Azure Key Vault | Encryption key management per tenant |
| Azure Service Bus | Async queue for document ingestion pipeline |

## Other Services
- **Auth**: Clerk (US-hosted, doctor email/name only — no patient data)
- **Payments**: Stripe Checkout + Webhooks (mock mode for local dev)
- **Email**: Resend for transactional notifications

## Database
- Azure PostgreSQL Flexible via **asyncpg** (no ORM)
- Raw SQL with parameterized queries (`$1`, `$2`, etc.)
- **Always filter by `cabinet_id`** for tenant isolation
- Migrations via **Alembic**

### Access Pattern
```python
from app.database import get_pool

async with get_pool().acquire() as conn:
    row = await conn.fetchrow("SELECT * FROM patients WHERE id = $1 AND cabinet_id = $2", patient_id, cabinet_id)
    rows = await conn.fetch("SELECT * FROM documents WHERE patient_id = $1 ORDER BY created_at DESC LIMIT $2", patient_id, 10)
    new_id = await conn.fetchval("INSERT INTO patients (name, cabinet_id) VALUES ($1, $2) RETURNING id", name, cabinet_id)
    await conn.execute("UPDATE patients SET status = $1 WHERE id = $2", "active", patient_id)
    await conn.execute("DELETE FROM documents WHERE id = $1 AND cabinet_id = $2", doc_id, cabinet_id)
```

## Environment Variables

### Backend (`backend/.env`)
**Currently active:**
- `API_URL` — Backend URL (default: `http://localhost:8000`)
- `APP_URL` — Frontend URL (CORS + redirects, default: `http://localhost:3000`)
- `OPENAI_API_KEY` — OpenAI API key (used by classification agent)
- `OPENAI_MODEL` — Model name (default: `gpt-4o`)

**Planned (not connected yet):**
- `DATABASE_URL` — Azure PostgreSQL connection string
- `AZURE_STORAGE_CONNECTION_STRING` — Blob Storage connection
- `AZURE_STORAGE_CONTAINER` — Blob container name
- `AZURE_SERVICEBUS_CONNECTION_STRING` — Service Bus connection
- `AZURE_KEYVAULT_URL` — Key Vault URL
- `CLERK_SECRET_KEY` — Clerk backend JWT validation

### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL` — Backend API URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk public key
- `CLERK_SECRET_KEY` — Clerk secret key
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`

## File Structure
```
backend/
  app/
    main.py              — FastAPI app, CORS, health, router registration
    config.py            — Settings from env vars (app URLs + OpenAI)
    schemas.py           — Shared Pydantic models
    routers/
      hello.py           — Test endpoint
    services/            — DOCX fillers + field maps
      docx_filler.py     — Fribourg template filler
      docx_filler_geneve.py — Geneva template filler
      fribourg_field_map.py — Fribourg field definitions (~106 fields)
      geneve_field_map.py   — Geneva field definitions (~21 fields)
    classification/      — Classification + dossier parsing (Steps 1-2)
      schemas.py         — PatientDossier, DossierResponse, PatientDossierPatch, ClassifiedDocument
      constants.py, helpers.py, services.py, routes.py, store.py
    report/              — Report generation (Step 3)
      schemas.py, constants.py, services.py, routes.py
  templates/
    fribourg.docx        — Official canton templates (also in frontend/public/templates/)
    geneve.docx

frontend/
  src/
    app/             — Next.js 16 App Router pages
      (marketing)/   — Public pages (landing, pricing, privacy, terms)
      sign-in/       — Clerk sign-in (catch-all route)
      sign-up/       — Clerk sign-up (catch-all route)
      dashboard/     — Authenticated app
        rapport/     — 3-step wizard (Documents → Résumé → Rapport)
    components/      — Catalyst UI components (reusable)
    lib/
      api.ts         — Typed API client (classifyDocuments, parseDossier, getDossier, updateDossier, generateReport)
      schemas/
        classification.ts — PatientDossier, DossierResponse, PatientDossierPatch types
    proxy.ts         — Clerk middleware (route protection)
```
