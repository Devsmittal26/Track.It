# UBC — Unacademy Backlog Counter

## Original Problem Statement
Digital whiteboard replacement for tracking remaining Unacademy lectures. Live counter, daily +/- adjustments, current task, history.

## Stack
- **Backend**: FastAPI + MongoDB + Resend (email) + bcrypt + PyJWT + zoneinfo
- **Frontend**: React + Tailwind + shadcn/ui + framer-motion + recharts + sonner + canvas-confetti + axios

## Iterations

### Phase 1 — MVP (2026-07-15) ✅
Auth (register/login), onboarding with initial count, live counter dashboard, today's stats (added/done/overall), current task inline editor, history page (line + bar charts + table), reset-today.

### Phase 2 — 12 quality-of-life features (2026-07-15) ✅
1. Keyboard shortcuts (A/D/U/R/1–9/?)
2. Undo last action
3. Daily streak badge + goal progress ring
4. Projected finish date pill (7-day avg)
5. Subject tagging on Done
6. Edit past days from history
7. Confetti + milestone toasts (every 25 crossed)
8. Weekly recap card with 7-day heatmap
9. CSV export of history
10. Multi-task checklist mode
11. Timezone-aware "today" via `X-Timezone` header
12. Password reset flow (endpoints only, dev returned link inline)

### Phase 3 — Polish (2026-07-15) ✅
- **Resend email delivery** for password resets (real email sent; graceful failure without leaking user existence)
- **Persistent user-managed subject presets** — CRUD (`/api/tag-presets`), default seed (Physics/Chemistry/Math/Biology), settings UI to add/remove
- **Dashboard refactor** — 594 lines → 234 lines. New components:
  `DashboardHeader`, `HeroCounter`, `StatsCard`, `WeekRecapCard`, `CurrentTaskCard`, `TaskChecklistCard`, `ShortcutsDialog`, `PresetManager`

**Testing**: 100% pass on iter3 (15/15 backend pytest, all E2E frontend flows).

## User Personas
- **The Backlog Owner**: student tracking their own lectures across devices; values speed, emotional feedback (streaks/confetti), and a satisfying counter.

## Prioritized Backlog

### P1 — Ready to build
- Verified custom domain for Resend so emails deliver to any recipient
- Background task for Resend send (currently awaited — endpoint latency tied to Resend response)
- Shareable "streak card" PNG for social sharing

### P2 — Nice-to-have
- Case-insensitive preset uniqueness (currently allows "Physics" and "physics")
- Split `server.py` (~800 lines) into routers per domain
- PWA + offline queueing
- Daily reminder email
- Multiple courses / boards (separate counters)

### P3 — Guardrails
- Move reset-token log line behind DEBUG flag before production

## Notes
- Resend: currently uses `onboarding@resend.dev` — only delivers to the account owner's verified email until a domain is verified. This is expected Resend behavior in testing mode.
- Test credentials in `/app/memory/test_credentials.md`.
