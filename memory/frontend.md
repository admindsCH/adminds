# Frontend

## Stack
- Next.js 16 App Router + React 19
- Tailwind 4 (utility classes only, no CSS modules)
- Headless UI + Heroicons
- Motion (Framer Motion) for animations
- clsx + tailwind-merge (`cn` utility in `src/lib/utils.ts`)
- lucide-react for additional icons
- Clerk for auth (`@clerk/nextjs`, `@clerk/localizations`)

## Styling
- **Brand color**: Purple `#7C5CBA` (full indigo scale in globals.css)
- **Fonts**: Inter (sans), DM Serif Display (serif), Instrument Serif (logo)
- **Selection color**: `rgba(124, 92, 186, 0.2)`
- **Gradient text**: `.gradient-text` class (purple gradient)
- **Card hover**: `.card-hover` class (lift + shadow on hover)

## Catalyst UI Components

All in `frontend/src/components/`:

| Component | File | Usage |
|-----------|------|-------|
| Button | `button.tsx` | Primary actions, links, color variants (`color="indigo"`, `outline`, `plain`) |
| Badge | `badge.tsx` | Status labels (green, red, amber, zinc, etc.) |
| Input | `input.tsx` | Form text inputs |
| Heading | `heading.tsx` | `<Heading>` and `<Subheading>` |
| Text | `text.tsx` | `<Text>`, `<Strong>`, `<Code>`, `<TextLink>` |
| Avatar | `avatar.tsx` | User avatars with initials or image |
| Divider | `divider.tsx` | Horizontal separator |
| Dialog | `dialog.tsx` | Modal dialogs with title/body/actions |
| Dropdown | `dropdown.tsx` | Dropdown menus |
| Sidebar | `sidebar.tsx` | Navigation sidebar with sections |
| SidebarLayout | `sidebar-layout.tsx` | Responsive sidebar + content layout |
| Navbar | `navbar.tsx` | Top navigation bar |
| Logo | `logo.tsx` | LogoFavicon (square icon) + Logo (wordmark) |
| Link | `link.tsx` | Next.js Link wrapper for Headless UI |

**Rule**: Use these components — don't reinvent. Don't pull in external component libraries unless explicitly asked.

## Code Conventions
- camelCase for variables/functions
- PascalCase for components
- kebab-case for file names
- Tailwind utility classes only
- App Router conventions: route groups `(marketing)` for layout separation
- Private folders `_components/` for page-specific components

## App Structure & Routes
```
(marketing)/       — Landing page, privacy, terms (public)
sign-in/           — Clerk sign-in
sign-up/           — Clerk sign-up
dashboard/         — Authenticated app (white card on grey bg, Clerk UserButton)
  page.tsx         — Redirects to /dashboard/rapport
  rapport/
    page.tsx       — 4-step report generation wizard (main feature)
  settings/
    page.tsx       — User profile: first/last name + canton selector (syncs to Clerk metadata)
api/waitlist/      — Waitlist API route
```

### Deleted Pages
- `patients/page.tsx`, `patients/[id]/page.tsx`, `modeles/page.tsx` — removed in favor of wizard flow
- `step-supplements.tsx` — removed (notes/dictation moved to step-summary.tsx)

## Report Wizard (`/dashboard/rapport`)
**3-step wizard** — Documents → Résumé → Rapport:

### File structure
```
rapport/
  page.tsx                              — Orchestrator: step/canton/docs/dossierId/dossier state, navigation
  _components/
    wizard-stepper.tsx                  — Top bar: logo + canton selector + 3 step pills
    step-documents.tsx                  — Step 1: drag-and-drop upload + real classification via /api/classify
    step-summary.tsx                    — Step 2: editable PatientDossier fields (auto-save on blur via PATCH) + notes/dictation
    step-report.tsx                     — Step 3: real report generation, docx preview, slide-over editor, download
    document-list-item.tsx              — Shared doc row component
  _hooks/
    use-file-upload.ts                  — classify, addFiles, onDrop, dragging
    use-voice-dictation.ts              — Web Speech API (fr-CH), toggle listening
```

### Steps
1. **Documents** — Drag-and-drop upload, real classification via `POST /api/classify`, status dots (classifying → extracting → done)
2. **Résumé** — Inline-editable PatientDossier fields (click pencil → edit → blur saves via `PATCH /api/dossiers/{id}`). Notes textarea + voice dictation at bottom. Auto-triggers `POST /api/parse-dossier` on first load.
3. **Rapport** — Calls `POST /api/generate-report` (GPT-4o fills canton-specific fields → docx filler → .docx blob). In-browser preview via `docx-preview`. Slide-over editor with collapsible sections. Download as PDF or DOCX.

### Key design decisions
- Canton selector lives in top bar (always visible, changeable from any step)
- `dossierId` and `dossier` state lifted to page.tsx — shared across steps 2 and 3
- PatientDossier persisted server-side (in-memory store) — survives step navigation
- Auto-save on blur pattern: click to edit → blur/Enter calls `api.updateDossier()` → parent state updated
- Notes stored as `notes` field on PatientDossier (backend), not frontend-only
- Templates stored in `public/templates/` and `backend/templates/` (both cantons)
- `docx-preview` npm package renders .docx in-browser
- Filenames: `Rapport AI - {patient} - {stade} - {date}.{ext}` (date in fr-CH format)

### Frontend types (`src/lib/schemas/classification.ts`)
- `PatientDossier` — patient_info, timeline, medications, diagnostics, rapport_ai_fields, notes
- `DossierResponse` — { dossier_id, dossier }
- `PatientDossierPatch` — partial update model (all fields optional)
- `ClassifiedDocument` — from classification endpoint

## Mock Data (`src/lib/mock-data.ts`)
- `Canton` type: `"geneve" | "fribourg"`
- `WizardDocument`: document lifecycle states (classifying → extracting → done/error)
- `MOCK_FRIBOURG_FIELDS` / `MOCK_GENEVE_FIELDS`: canton-specific report editor fields (still used in slide-over)
- `ReportFieldSection` / `ReportField`: field section types for slide-over editor

## New Dependencies
- `docx-preview@0.3.7` — in-browser .docx rendering

## Adding a New Feature (Frontend)
1. Add TypeScript types and API function in `src/lib/api.ts`
2. Build UI in `src/app/` using Catalyst components
3. Verify build passes: `npx next build`
