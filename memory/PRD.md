# UBC — Unacademy Backlog Counter

## Original Problem Statement
Digital replacement for a whiteboard tracking remaining Unacademy lectures. Live counter, daily +/- adjustments, current task, history.

## User Choices
- Onboarding asks initial backlog count
- JWT email+password auth
- History with charts + table
- Single current task by default (multi-task mode added later)
- "Midnight Library" aesthetic — Outfit + Manrope + JetBrains Mono, Sage + Terracotta accents

## Architecture
- **Backend**: FastAPI + MongoDB. Timezone-aware "today" via `X-Timezone` header.
- **Frontend**: React + Tailwind + shadcn/ui + framer-motion + recharts + sonner + canvas-confetti.

### Endpoints
Auth: register/login/logout/me, forgot-password, reset-password.
Core: /state, /onboard, /action (kind + amount + optional tag), /undo, /reset-today, /task, /day (edit past), /history, /history/csv, /summary/week, /tags/summary, /actions/recent.
Settings: PATCH /settings (daily_goal, task_mode, timezone).
Tasks: GET/POST/PATCH/DELETE /tasks.

## Implemented

### Phase 1 (2026-07-15) ✅
- Auth (register/login), onboarding with initial count, dashboard with live counter + Add/Done, today's stats, current task inline editor, history page (line + bar charts + table), reset-today.

### Phase 2 — 12 features (2026-07-15) ✅
1. Keyboard shortcuts (A / D / U / R / 1–9 / ?)
2. Undo last action (header button + toast action)
3. Daily streak (fire badge) + goal progress ring
4. Projected finish date pill (uses 7-day avg)
5. Subject tagging on Done via a dialog + suggestion chips
6. Edit past days in history (row hover → edit dialog)
7. Confetti + milestone toast when counter crosses multiples of 25 downward
8. Weekly recap card with 7-day heatmap
9. CSV export of full history
10. Multi-task checklist mode (toggleable in Settings)
11. Timezone-aware "today" via `X-Timezone` header
12. Password reset flow (dev returns link inline; ready for email service)

**Testing**: 100% pass on backend (13/13 pytest) and frontend (12/12 E2E flows). No mocked APIs.

## User Personas
- **The Backlog Owner**: student tracking lectures across devices, prizes speed and emotional feedback.

## Backlog

### P1
- Email delivery for password reset (SendGrid/Resend)
- Notifications / daily reminder
- Subject presets managed by user (persistent tag list)
- Bulk-import backlog from Unacademy calendar CSV

### P2
- Multiple courses / boards (separate counters)
- PWA install + offline queueing
- Shareable public streak card
- Weekly email digest

## Notes
- Dashboard.jsx is ~590 lines — consider splitting into subcomponents in a future refactor.
- Password reset currently returns the reset link inline (dev mode); wire up email delivery before production.
