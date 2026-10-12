# Nexora — Phase 3 Report: Interactive task table, deadlines, calendar navigation, status changes

Scope: **frontend only**. No endpoint was added or invented; no backend file touched. Phase 1 (no demo/mock data, honest states) and Phase 2 (shell, dashboard, theme) are preserved. Changed files vs Phase 2: `features/dashboard/{panels.tsx,helpers.ts}`, **new** `features/dashboard/useTaskStatus.ts`, `features/adaptive/Widgets.tsx` (exposes `refresh` on the shared `Status`), `pages/Dashboard.tsx`, `styles/workspace.css` (appended), `README.md`, this report. Everything else is byte-identical to the Phase 2 ZIP.

> Note: the message referred to an uploaded Phase 2 ZIP, but only the Phase 1 ZIP was attached in this session. I continued from the Phase 2 project I produced in this session (identical to the `nexora-phase-2.zip` delivered earlier).

## 1. Verification status — read this first

| Check | Result |
|---|---|
| `npm install`, `npm run typecheck`, `npm run build` | **Could not run.** The sandbox blocks `registry.npmjs.org` (org policy, HTTP 403), as in Phases 1–2. **Run them on a networked machine.** There is still no lint script and no test runner in the project. |
| Substitute typecheck | `tsc 6.0.3` strict + `noUnusedLocals/Parameters` with throw-away stubs for uninstalled libraries: **0 errors other than stub artefacts** (71 notices of the three known kinds: implicit-any on handlers, `React` namespace, CSS imports). Third-party typings unverified. |
| Real-browser tests (Chromium, real app bundled with esbuild; icons/router/charts replaced by stand-ins; React 19 rather than the project's 18.3) | **68/68 new checks + 25/25 Phase 2 regression checks pass.** The API is faked **only at the network layer inside the test harness** (including `PUT /tasks/{id}` success, 500, 404 and slow). The harness and its fixtures are not in the ZIP. |
| Not verified | Real Vite build, real library rendering, a live Spring Boot backend, Firefox/Safari, screen-reader testing, automated accessibility audit. |

## 2. What was added

**Search** (task table) — case-insensitive over title, project name, assignee, priority, status and blocker text; clear (×) button and Escape; live result count ("Showing 3 of 10 tasks").

**Filtering** — status tabs with counts, plus Priority, Project and Deadline (overdue / due today / next 7 days / no due date) selects, plus a day filter set from the calendar. Filters combine; **Reset** clears everything. A filter combination with no result shows an empty state with "Clear all filters".

**Sorting** — every column header is a button (Task, Project, Priority, Status, Deadline, Assignee): click = ascending, second click = descending, third = back to the default order (open tasks first, then by deadline). `aria-sort` is set; tasks without a due date always sort last on Deadline; priority sorts high→low, status To do→In progress→Done.

**Deadline indicators** — one `DeadlineBadge` used in the table, Upcoming tasks and the calendar day list: *N days overdue* (red), *Due today* (amber), *Due tomorrow / Due in N days* (rose-sand), a plain date for later deadlines, *No due date*, and *Completed* for done tasks (a done task is never shown as overdue). Overdue rows are tinted; calendar cells show a red dot when a day holds an overdue open task.

**Calendar navigation** — previous/next month, month and year selects, a **Today** button, full keyboard grid navigation (arrow keys ±1/±7 days, Home/End, PageUp/PageDown by month, roving tabindex, focus follows selection), `aria-current="date"`, and **"Filter table to this day"** / "Clear table filter" which drives the task table.

**Status interactions** — the Status cell is a select (To do / In progress / Done) and Upcoming tasks has a one-click "Mark as done" button. Both use the **existing contract already used by the Projects board**: `PUT /tasks/{id}` with the full task object `{...task, status}`.
- Nothing is optimistic. While saving, the control is disabled with a spinner.
- On success the list is **re-read from `GET /tasks`**; only then do the table, cards, progress ring and calendar change, and a "saved as …" notice appears.
- On failure the task is left exactly as it was, the control returns to the server's value and a banner shows the real error (`Could not … not changed. <server message>`); a 404/405/501 reads "not available on the server yet". No "saved" message is ever shown for a failed write.
- Count-up numbers now animate from the value on screen (not from 0) when data changes.

States: every panel keeps its own skeleton / error + Retry / empty state; the filter controls are hidden while loading and when there are no tasks; the calendar remains navigable with "Nothing scheduled." and reports which sources failed to load.

## 3. API usage (no new endpoints)
Reads: `GET /tasks`, `/projects`, `/meetings`, `/courses`. Write: `PUT /tasks/{id}` (full object). **Reminder:** the `/{id}` item path for PUT is the Phase 1 assumption to confirm with the backend (README "Proposed API contract"); if the backend uses a different shape the UI will show the server's error and change nothing. Dates are expected as `YYYY-MM-DD`.

## 4. Known limitations
- Filters, sort and the day filter live in component state only (not saved, not in the URL); they reset on reload.
- Status changes are per task, one request each; there is no bulk edit, undo, or editing of title/priority/due date from the dashboard (use Projects).
- If the re-read after a successful save fails, the panel shows the load error with Retry rather than a stale table.
- A very narrow task card scrolls the table horizontally (inside the card, not the page).
- `public/videos/nexora-office.mp4` is still not in the project (absent since Phase 1).

Stopped after Phase 3 as requested.
