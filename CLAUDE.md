# Adminds — Agent Instructions

## Product

**Adminds** helps psychiatrists in Switzerland write disability insurance reports ("rapports AI") faster using AI.

---

## Workflow Rules

### 1. Think Before Coding
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- **Explain each line of code you write.** The user wants to understand every change.

### 2. Plan First
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately.
- Write a brief plan with verifiable steps before implementing:
  ```
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  ```

### 3. Simplicity First
- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked. No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- If you write 200 lines and it could be 50, rewrite it.
- Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 4. Surgical Changes
- Touch only what you must. Don't "improve" adjacent code.
- Match existing style, even if you'd do it differently.
- Remove imports/variables YOUR changes made unused. Don't touch pre-existing dead code.
- Every changed line should trace directly to the user's request.

### 5. Verify Before Done
- Never mark a task complete without proving it works (build, tests, logs).
- Ask: "Would a staff engineer approve this?"

### 6. Subagent Strategy
- Use subagents to keep main context window clean.
- Offload research, exploration, and parallel analysis.
- One task per subagent for focused execution.

### 7. Self-Improvement Loop
- After ANY correction from the user: update [memory/lessons.md](memory/lessons.md).
- Write rules that prevent the same mistake. Review lessons at session start.

### 8. Autonomous Bug Fixing
- Given a bug report: just fix it. Point at logs/errors, then resolve.

---

## Code Standards (Quick Ref)

**Python**: snake_case, type hints, async, Pydantic, `Depends(get_current_user)`, asyncpg pool, always filter by `cabinet_id`. Details → [memory/backend.md](memory/backend.md)

**TypeScript**: camelCase vars, PascalCase components, kebab-case files, Catalyst UI components, Tailwind only. Details → [memory/frontend.md](memory/frontend.md)

**Security**: Never log secrets. All secrets in `.env`. Validate input with Pydantic.

## Conventions
- **Commits**: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- **API prefix**: `/api/`
- **Error format**: `{ "detail": "Human-readable message" }`
- **Database**: asyncpg, raw parameterized SQL, no ORM, Alembic migrations
