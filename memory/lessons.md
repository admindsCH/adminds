# Lessons & Corrections

Rules learned from user corrections. Review at session start.

## Code Explanation
- **Always explain each line of code** before or as you write it. The user wants to understand every change.
- Don't just write code and say "done" — explain the why.

## Clerk / Next.js 16
- Use `proxy.ts` NOT `middleware.ts` — Next.js 16 deprecated the middleware convention
- Use `<Show when="signed-in">` NOT `<SignedIn>` (deprecated)
- Use `clerkMiddleware()` NOT `authMiddleware()` (deprecated)
- Clerk supports keyless mode — no env vars needed to get started
- `@clerk/localizations` is a separate package from `@clerk/nextjs`

## Planning
- Don't present a full roadmap when user asks for "first step" — give the immediate next step and its plan only
- Plan carefully before coding. User prefers deliberate, step-by-step approach.

## Design & Components
- **Default to our Catalyst components** — don't pull in external libraries (21st.dev, shadcn) unless explicitly asked
- Keep empty states simple: white card, Catalyst Text + Button. No fancy animated icons.
- All components must match existing brand: purple #7C5CBA, Inter font, Tailwind 4 theme tokens
- Don't hardcode colors — use theme tokens (indigo-500, indigo-600, etc.)
- Don't over-design — simple and clean beats fancy animations
- **Section headings need breathing room** — when a section title (h3) follows a card/container, add `mt-2` or extra spacing so it doesn't look cramped against the element above
- **Work WITH the SidebarLayout, not against it** — SidebarLayout already provides white bg, `p-10` padding, and `max-w-6xl` centering. Don't use negative margins to "break out." Just render content normally inside it.
- Always add `break-words` alongside `whitespace-pre-line` to prevent text overflow
- **Tailwind v4 spacing bug**: `space-y-*` and `gap-*` utilities don't reliably apply through Headless UI wrappers. Use inline `style={{ paddingBottom: "Xrem" }}` on form fields or plain divs instead of Headless UI `Fieldset`/`Field`/`FieldGroup` for form layouts.
- Catalyst components use `data-slot="icon"` for icon alignment — always add this attribute to lucide icons inside Catalyst Buttons/DropdownItems

## Information Architecture
- Documents belong to patients, NOT a top-level nav item
- Flow: Patient → Documents (drag-and-drop upload) → Report generation
- Nav: Patients, Modèles, Paramètres

## Architecture Decisions
- Always check privacy/compliance implications before recommending third-party services
- Clerk stores auth data (email/name) on US servers — acceptable for doctor info but not patient data
- All patient data must stay in Azure Switzerland

## Backend Patterns
- **Routes must be extremely thin** — just `return await services.function_name(args)`. No validation, no logic in routes. Import as `from app.feature import services` to keep it readable.
- **Feature modules**: each feature gets its own folder (`app/classification/`, etc.) with routes.py, services.py, schemas.py, constants.py
- **Use LangChain agent framework** for AI features — `create_agent()` with `response_format` for structured output, `system_prompt` for domain expertise
- **API prefix is `/api/`** — no versioning
- **Don't use ChatPromptTemplate** when `create_agent` accepts `system_prompt` directly — keep it simple
- **Each agent gets its own memory doc** in `memory/agents/{name}.md`
