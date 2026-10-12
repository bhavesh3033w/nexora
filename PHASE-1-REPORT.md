# Nexora — Phase 1 Report: Frontend audit and demo-mode removal

Scope: frontend only. No backend service, schema, controller or server configuration was created or modified. (`backend-reference/` was already in the uploaded ZIP and is included **untouched**.)

## 1. Verification status — read this first

| Check | Result |
|---|---|
| `npm install` | **Not completed.** The sandbox has no network access; the command timed out (exit 124) with the registry unreachable. No `node_modules`, no lockfile could be produced. |
| `npm run typecheck` (`tsc --noEmit`) | **Not run as specified** (needs the real `@types/react`, `react-router-dom`, `axios`, `recharts`, … which could not be installed). |
| `npm run build` (`vite build`) | **Not run** (Vite not installable offline). |
| Lint | **Not available.** The project has no lint script or ESLint config; none was added in Phase 1. |
| Browser / runtime / UI test | **Not performed.** |
| **Partial type-check (what *was* run)** | `tsc 6.0.3` with strict mode **plus** `noUnusedLocals`/`noUnusedParameters` over all of `src/`, using throw-away loose type stubs for the uninstalled libraries (stubs are not part of the ZIP). Run on both the original ZIP and the modified project. **Original:** 2 real findings (unused `Activity` import and unused `logs` variable in `Admin.tsx`). **Modified:** **0** findings. Both runs also report ~57 `TS7006` "implicit any" notices on event-handler parameters (`e`) — an artefact of the stubs (real `@types/react` types those) and identical in nature before and after. This verifies syntax, internal imports/exports, our own types, strict null checks and unused code. It does **not** verify third-party API usage (React Router, recharts, react-hook-form, axios, lucide typings) or the production bundle. |
| Static audits (grep) | No remaining references to `USE_MOCKS`, `mocks/`, `usePersisted`, `resetDemo`, `DEMO_*`, `seed*`, `FEATURE_USAGE`, `ANALYTICS`, `Sim`, `simulated` anywhere in `src/`. |

**Commands you must run on a machine with network access before Phase 2:**

```bash
npm install            # also creates package-lock.json (none existed in the upload)
npm run typecheck
npm run build
```

Please send me any errors; I could not see real-library type errors.

## 2. What was found (demo / mock inventory) and what happened to it

| # | Demo element | Where | Action |
|---|---|---|---|
| 1 | `VITE_USE_MOCKS` flag (default **true**) and `USE_MOCKS` branches in every service | `api/client.ts`, `api/services.ts`, auth, prefs, meetings, pages | Removed. Services always call the real API. `.env` / `.env.example` cleaned. |
| 2 | Mock auth with demo users and passwords (`user@nexora.dev` / `User@12345`, `admin@nexora.dev` / `Admin@12345`), mock registration, mock session restore, demo-credential hints on login pages | `mocks/auth.ts`, `AuthContext`, `AuthPages` | Deleted. Session comes only from `GET /auth/me`. |
| 3 | Fabricated meetings, clients, messages, courses, projects, tasks, 90-day analytics, feature usage, admin users, audit logs, adoption %, usage trend, "system health" | `mocks/data.ts` | Deleted. Replaced by API reads with loading/empty/error states. |
| 4 | Mock meetings backend, fake Google connect, fake "Start meeting", local transcript "AI" heuristic (`heuristicAnalyze`) | `mocks/meetings.ts`, `lib/transcript.ts` | Deleted. `simulated` fields removed from types. |
| 5 | Mock assistant with canned replies built from sample data; seeded greeting claiming to be "simulated" | `mocks/assistant.ts`, `Assistant.tsx` | Deleted. Replies come only from `POST /assistant/messages`; errors show with Retry. |
| 6 | `localStorage` persistence of application data (`nexora.demo.*`, `nexora.prefs.v1:*`), `usePersisted`, "Reset demo" buttons (user Settings + Admin Settings) | `lib/storage.ts`, Settings, Admin | Removed. Added a one-time `purgeLegacyDemoData()` so old browsers do not keep stale sample data. |
| 7 | Hard-coded dashboard content: fake "Recent activity" list, hard-coded "Exam in 6 days", `QUIZ`/`FLASHCARDS` (OS questions), fake investigation tips ("Mobile web — largest drop"), name-based filter `/Elena\|Marcus\|Priya/`, `TEAM` list, fake 450 ms loading delay | `Dashboard.tsx`, `Widgets.tsx`, `Study.tsx`, `Projects.tsx` | Removed or derived from API data. |
| 8 | Hard-coded notification bell items | `Shell.tsx` | Replaced by an honest "not available yet" notice. |
| 9 | Fake figures on public/login screens (Landing cards: "10:00 Client kickoff", "Active users 2,310", "+4.1% MoM"…; login art: "Uptime 99.9%", "Study streak · 5 days"; fake chart line) and "Demo build" footer text | `Landing.tsx`, `AuthPages.tsx` | Replaced with neutral, capability-only text (no numbers/names). Layout, intro, N logo, video component untouched. |
| 10 | Fake "Forgot password" success ("Simulated: no email is sent") | `AuthPages.tsx` | Now says plainly that reset is not available yet; form disabled. |
| 11 | Silent fallbacks: preferences load failure → defaults; Google status failure → "not configured"; session check failure → logged out | `PrefsContext`, `useMeetings`, `AuthContext` | Now surface the real error with Retry (401/403 on `/auth/me` still just means "not signed in"). |
| 12 | Unused code in the original (`Activity` import, `logs` variable) | `Admin.tsx` | Gone with the rewrite. |

## 3. Behaviour changes you will notice

- **Dashboard**: widgets and KPIs load per resource; each shows its own skeleton, error + Retry, or empty message. KPIs show `—` instead of invented numbers. The *Detailed* layout no longer adds the fake "Recent activity" panel (it now equals *Balanced*; real replacement is a Phase 2 / backend topic).
- **After login** the app always goes to `/app`; an `OnboardingGate` loads the saved preferences and redirects to `/onboarding` only if the server says the user is not onboarded (previously decided from `localStorage`).
- **Projects**: assignees are no longer a fixed `TEAM` list — they are free text with suggestions taken from existing tasks. Task **Delete** was removed (no delete endpoint in the contract).
- **Communication**: reading and mark-read/unread work against the API; compose, draft, reminders, AI rewrite and AI summary are replaced by a clearly labelled "not available yet" panel.
- **Study**: courses and topic toggles use the API; quiz, flashcards, goals and streak show "not available yet".
- **Analytics**: charts use `GET /analytics` rows only; the feature-usage donut/bar section shows "not available yet" (components kept in `FeatureCharts.tsx`).
- **Admin**: Users (list + real status `PATCH`), Activity logs, Projects overview use the API. Overview usage/adoption/health and Workspace Analytics show "not available yet". Status changes are shown only after the server confirms.
- **Assistant** conversation is in-memory for the session only (no more local persistence).

## 4. Kept intact (verified byte-identical to the upload)
`BrandIntro.tsx`, `NexoraMark.tsx`, `HeroVideo.tsx`, `Tilt.tsx`, `global.css`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `engine.ts` (local intent classifier), `FeatureCharts.tsx`, `courses.ts`, `docs/HERO_VIDEO.md`, `backend-reference/**`. Login/registration forms, routes, dashboard layout and personalization wizard behave as before apart from the items above.

## 5. Things you should know
- **`public/videos/nexora-office.mp4` is NOT in the uploaded ZIP** (only `.gitkeep`). I could not include it. Copy it to `public/videos/nexora-office.mp4`; until then the hero uses the static gradient (by design).
- **No `package-lock.json`** existed and none could be generated offline.
- `.env` is included with only the non-secret `VITE_API_BASE_URL`. No credentials exist in the project.
- **Tutorial Library** (`courses.ts`) is a static list of real external course links, not app data, so it was kept; bookmarks are stored in this browser only (`nexora.ui.tutorialBookmarks`). Prices/durations of those external courses were not verified by me.
- The **intent engine** is a local keyword classifier (no data fabricated). The README lists `POST /adaptive/intent` as the future replacement; it is not called.
- "Suggest priorities" (Projects) and the dashboard suggestion line are rule-based calculations over the user's real tasks, labelled as such.

## 6. Backend capabilities the frontend needs (exact)

**A. Existing documented contract — frontend now depends on these being real**
1. `POST /auth/{user|admin}/login`, `POST /auth/user/register` → `{id,name,email,role}`; `GET /auth/me` → same, **401/403 when not signed in**; `POST /auth/logout`.
2. `GET /users/me/preferences` → `Prefs` (see `src/types`). **Assumption:** `404` or an empty body means "no saved preferences yet" (new user). `PUT /users/me/preferences` with the full `Prefs`.
3. `GET /messages`, `/courses`, `/projects`, `/tasks` → JSON arrays of `Message`, `Course`, `Project`, `Task` (`src/types/index.ts`). `GET /analytics` → array of `{date,activeUsers,revenue,conversion,sessions}` (client does range/metric slicing; rows not matching this shape are rejected with an error).
4. `POST /tasks`, `POST /projects` (body = type without `id`).
5. **Assumption to confirm:** `PUT /messages/{id}`, `PUT /courses/{id}`, `PUT /tasks/{id}` with the full object. The README says "PUT" but gives no item path.
6. `POST /assistant/messages` `{text}` → `{intent,title,lines[],actions[]}`.
7. `GET /admin/users`, `PATCH /admin/users/{id}/status {status}`, `GET /admin/activity` → `AdminUser[]` / `LogEntry[]`.
8. Meetings, clients and Google integration exactly as in `docs/MEETINGS_BACKEND.md` (`/clients`, `/meetings/**`, `/integrations/google/**`).

**B. Missing from the contract — frontend shows "not available yet" until defined**
1. Notifications (list/read) — bell is empty.
2. Messages: send/compose, reply, drafts, follow-up reminders, AI rewrite and AI summary.
3. Study: quiz questions + submit scores (`quizBest`), flashcards, learning goals, study streak.
4. Analytics: per-feature usage counts (current vs previous period).
5. Admin: response shape for `GET /admin/dashboard` (listed in README, shape undefined), org-wide analytics/adoption, system health. Also clarify whether `/projects` and `/tasks` are org-wide for admins (the Projects overview currently shows whatever those endpoints return for the signed-in account).
6. Password reset (request + confirm).
7. Delete/edit endpoints for tasks and projects (frontend has no delete today).
8. A people/team directory endpoint for task assignees (currently free text).
9. `POST /adaptive/intent` (optional; local classifier is used).
10. Admin invitation redemption (screen is already disabled and says so).

## 7. Files changed
- **Deleted:** `src/mocks/` (assistant, auth, data, meetings).
- **Added:** `src/api/useResource.ts`, `src/features/analytics/data.ts`, `PHASE-1-REPORT.md`.
- **Rewritten/modified:** `api/client.ts`, `api/services.ts`, `types/index.ts`, `lib/storage.ts`, `lib/transcript.ts`, `main.tsx`, `app/App.tsx`, `components/ui.tsx`, `components/Shell.tsx`, `features/auth/AuthContext.tsx`, `features/personalization/{PrefsContext,questions}`, `features/adaptive/Widgets.tsx`, `features/meetings/{controls,parts,useMeetings}`, `features/tutorials/TutorialLibrary.tsx`, `pages/{Dashboard,Landing,AuthPages,Onboarding,Settings}.tsx`, `pages/admin/Admin.tsx`, `pages/workspaces/{Analytics,Assistant,Communication,MeetingDetail,MeetingInsights,Meetings,Projects,Study}.tsx`, `README.md`, `docs/MEETINGS_BACKEND.md` (mock references only), `.env`, `.env.example`.
