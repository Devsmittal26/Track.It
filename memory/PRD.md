# UBC — Unacademy Backlog Counter

## Original Problem Statement
User manages a whiteboard tracking remaining Unacademy lectures. Wants a digital, aesthetic, and convenient website version with:
- A live counter of remaining lectures (starts at 176 or user-defined)
- Daily +/- adjustments (added = new lectures scheduled today, done = lectures watched today, overall = net change)
- A "current task" section
- History view

## User Choices
- Onboarding: web asks user how many lectures are in backlog
- Auth: simple email + password login (JWT-based custom auth)
- History: keep record of daily changes (chart + table)
- Single current task for now
- Aesthetic: design agent decides — chose "Midnight Library" (dark, warm off-white, Sage + Terracotta accents, Outfit + Manrope fonts)

## Architecture
- **Backend**: FastAPI + MongoDB
  - `/api/auth/register|login|logout|me` — JWT via httpOnly cookie + Bearer fallback
  - `/api/state` — snapshot: counter, onboarded, current_task, today's stats
  - `/api/onboard` — set initial counter
  - `/api/action` — kind=add|done, amount → mutates counter + today's day_log
  - `/api/task` — save current task
  - `/api/history?days=N` — daily log with computed running counter
- **Frontend**: React + Tailwind + shadcn/ui + framer-motion + recharts + sonner
  - Routes: `/login`, `/register`, `/` (dashboard or onboarding based on state), `/history`
  - AuthContext with cookie + localStorage token
  - AnimatedCounter with per-digit slide animation on change

## Implemented (2026-07-15) ✅
- Email + password registration + login with JWT cookies
- Onboarding flow (initial backlog input)
- Live counter dashboard with +/- Add/Done buttons and configurable amount step
- Today's stats: Added, Done, Overall (with color-coded direction)
- Current task inline editor (persists)
- History page with line chart (backlog curve), bar chart (added vs done), full table
- Motivational toasts on actions
- Grain texture, glass header, tactile card slabs — "Midnight Library" aesthetic
- Full end-to-end tested (backend + frontend, 100% pass)

## User Personas
- **The Backlog Owner**: single user (student) tracking their own lectures across devices, needs speed and emotional feedback.

## Prioritized Backlog

### P1 (Next Enhancements)
- Streak tracking (consecutive days with done>0)
- Weekly/monthly aggregate stats + goals
- Reset / manually edit a past day
- Multiple tasks (checklist mode — user hinted this may come later)

### P2 (Nice-to-have)
- Subject / category tagging per lecture batch
- Notifications / daily reminder email
- Export CSV of history
- Undo last action
- Dark/light theme toggle

## Test Credentials
See `/app/memory/test_credentials.md`.

## Notes
No mocked APIs — full backend integration in place.
