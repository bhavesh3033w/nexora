# Nexora — Phase 2 Report: Employee dashboard redesign

Scope: **frontend only**. No backend, API contract, auth flow, landing page, intro, N logo, hero video component or login/registration UI was changed. All Phase 1 fixes (no demo mode, no mock data, honest loading/empty/error states) are preserved.

## 1. Verification status — read this first

| Check | Result |
|---|---|
| `npm install` | **Could not run.** The build sandbox blocks `registry.npmjs.org` (organisation egress policy → HTTP 403). No `node_modules` and no `package-lock.json` could be produced (same as Phase 1). |
| `npm run typecheck` / `npm run build` | **Not run with the real toolchain** (needs the real `@types/react`, `react-router-dom`, `lucide-react`, `recharts`, `vite`). **You must run both on a networked machine.** |
| Substitute typecheck | `tsc 6.0.3`, `strict` + `noUnusedLocals` + `noUnusedParameters` over all of `src/`, with throw-away type stubs for the uninstalled libraries (stubs are not in the ZIP). Result: **no errors in Phase 2 code other than stub artefacts** (implicit-any on event handlers, `React` namespace, CSS side-effect imports — 64 notices, all of those three kinds, same nature as Phase 1). Third-party typings (react-router, lucide, recharts) are *not* verified. |
| Real-browser render test | The real app (`src/main.tsx`) was bundled with esbuild and run in Chromium. Missing libraries were replaced by small stand-ins (icons → circles, a minimal router, charts → empty boxes); React 19 + real axios + real zod were used (project pins React 18.3). The API was faked **only at the network layer in the test harness** to exercise states. **25/25 checks passed**: summary counts = API rows; table filter/search/empty-filter; progress % (2/10 → 20%); overdue-first upcoming list; calendar markers, day select, month navigation; profile menu open/Escape; empty state (zero cards, no rows); error state (Retry banners, `—` instead of numbers); loading state (skeletons, `aria-busy`); no horizontal overflow at 390 px and 820 px; mobile drawer; dark theme; no console errors/warnings. |
| Not verified | Real Vite build, real icon/router/chart rendering, a live Spring Boot backend, Safari/Firefox, automated accessibility audit. The project has **no lint script and no test runner**; none was added. The test harness and its fixtures are intentionally **not** shipped (they are sample data, and the app must never contain any). |

Run before relying on this build:
```bash
npm install && npm run typecheck && npm run build
```

## 2. What changed

**New / changed files (everything else is byte-identical to Phase 1):**
- `src/components/Shell.tsx` — redesigned shell (used by user *and* admin portals).
- `src/pages/Dashboard.tsx` — recomposed dashboard.
- `src/features/dashboard/panels.tsx`, `helpers.ts` — new panels and pure helpers.
- `src/styles/workspace.css` — new, additive stylesheet (imported after `global.css`; `global.css` is untouched).
- `src/main.tsx` — one added `import './styles/workspace.css'`.
- `README.md` (Phase 2 section), `PHASE-2-REPORT.md`.

**Shell:** elegant sidebar (N monogram from `NexoraMark`, section caption, animated active indicator, signed-in card from the real session, log out), sticky blurred top navigation with current-page title and date, notification bell (unchanged behaviour), profile menu (name, email, role, Settings, Log out; Escape / outside click closes). Sidebar / top-nav / compact modes from the personalization wizard still work; mobile drawer kept. Route changes no longer scroll the page (`focus({preventScroll})`).

**Dashboard (all from the API):**
- **Task summary cards** — Total / In progress / Completed / Overdue, count-up animation.
- **My tasks table** — status tabs with counts, search, project name (via `GET /projects`), priority, status, due, assignee, "Blocked" tag from `blocker`; 8 rows + "Show all". Read-only; editing remains in Projects.
- **Calendar widget** — month grid; dots for task due dates (`/tasks`), meetings (`/meetings`) and course assessments (`/courses`); selecting a day lists its items.
- **Overall progress** — completion ring (done ÷ total tasks), stacked status bar, per-project progress.
- **Upcoming tasks** — open tasks, overdue first, relative due labels.
- **Animations** — staggered rise-in, count-up, ring draw, bar fill, hover lifts. All disabled by `prefers-reduced-motion` and by the "motion: none" preference.
- **States** — each panel has its own skeleton, error + Retry, and empty message. Cards show `—` (never a number) when their request failed.
- Kept from Phase 1: adaptive command bar, proposals/"Why this workspace", custom widget show/hide/reorder, remaining widgets (meetings, messages, notifications, learning, projects, analytics, assistant) under "More from your workspace", shortcuts.

**Behaviour changes to be aware of**
- The old *Open tasks / Meetings / Unread / Study avg* KPI strip is replaced by the four task cards. Unread/meetings/study figures remain in their widgets (if selected in the wizard).
- The `tasks` widget is no longer in the widget grid (superseded by the table + upcoming panels); layout "minimal" still limits the extra widgets to 3.
- The admin portal uses the same shell, so it gets the new sidebar/top bar (admin keeps its dark espresso sidebar).

## 3. Data sources used (no new endpoints)
`GET /tasks`, `/projects`, `/meetings`, `/courses`, `/messages` (existing widgets), `GET /auth/me` (profile), `GET /users/me/preferences`. No backend change is needed. The Phase 1 assumptions still apply (see `PHASE-1-REPORT.md` §6). Task dates are expected as `YYYY-MM-DD` (or an ISO string starting with it).

## 4. Known limitations
- `public/videos/nexora-office.mp4` is still **not in the project** (it was absent from the Phase 1 ZIP); the hero falls back to the static gradient until you add it.
- The dashboard does not change task status (it would depend on the unconfirmed `PUT /tasks/{id}` shape); use Projects.
- Notifications remain "not available yet" (no endpoint).
- Calendar uses Sunday as first weekday and the browser locale for names.

Stopped after Phase 2 as requested.
