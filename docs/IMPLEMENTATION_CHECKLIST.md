# NEXORA — Implementation Checklist & Architecture Audit

## Executive Summary
This document outlines the complete architectural audit, status assessment, and implementation plan for **NEXORA — Intent-to-Interface: Adaptive AI Workspace**, ensuring a full-stack MERN recreation with a deterministic rule-based adaptation engine, premium UI/UX, and end-to-end functionality.

---

## 1. Codebase Audit Matrix

| Domain | Component / Feature | Current State | Target State | Status / Action Plan |
|---|---|---|---|---|
| **Root** | Repository Structure | Root contained nested folder; now unified at `d:\PROJECT` | Root package.json with concurrent dev, build, and test scripts | **DONE** / Add root scripts |
| **Frontend** | Build & Typecheck | 1 minor Recharts typing error in `FeatureCharts.tsx` | Clean `tsc --noEmit` and Vite build | **FIXED** (0 errors, Vite builds in 5.5s) |
| **Frontend** | Design System & Palette | Warm palette (#FBF7F2, #B56F76, etc.), dark mode, CSS custom properties | Polished editorial serif headlines, consistent dark/light tokens, responsive layout | Preserved & Enhanced |
| **Frontend** | Animations | Framer-motion/CSS keyframes, BrandIntro, Tilt, count-up, stagger | Respects `prefers-reduced-motion` and user motion preferences | Preserved & Enhanced |
| **Frontend** | Landing Page | Hero video fallback, BrandIntro, sample intent tester, 6 cards | Fully interactive workspace preview with live rule-based adaptation | Functional |
| **Frontend** | Authentication & AuthContext | In-memory token, strict role guards, login/register forms | Persist token to localStorage/cookie for session restore on page refresh | Align with backend |
| **Frontend** | Onboarding Wizard | 14 questions, 3 steps, live preview, progress bar | Full MongoDB persistence via preference endpoint, review step, reload safety | Integrated |
| **Frontend** | Dashboard | Task table, calendar widget, summary cards, upcoming tasks, adaptive bar | Connects to real API endpoints, reactive status update, adaptive widgets | Connected to MERN API |
| **Frontend** | Adaptive Engine | Local classifier in `engine.ts` with 5 intents | Enhanced typed rule engine with widget scoring, context inputs, explainability, undo, history | Extend & Add tests |
| **Frontend** | Workspaces | Meetings, Projects, Comm, Study, Analytics, Assistant | All 6 workspaces functional against Express API | Connected |
| **Backend** | Express & Server Setup | `server.ts` on port 5000, CORS, Morgan, ErrorHandler | Mount routes on both `/api/v1` and `/api`, graceful shutdown | Mount & configure |
| **Backend** | MongoDB Connection | Mongoose connecting to database | Verified active connection (local MongoDB running) | **VERIFIED** |
| **Backend** | Models | User, UserPreference, Project, Task, Meeting, Message, Course, AnalyticsMetric | Add `WorkspaceConfiguration`, `AdaptationHistory`, `ActivityLog` | Create models |
| **Backend** | Auth Endpoints | `/auth/register`, `/auth/login`, `/auth/admin/login`, `/auth/me` | Support `/auth/user/login`, `/auth/user/register`, `/auth/logout`, token restore | Normalize routes |
| **Backend** | Preferences Endpoints | `/preferences` | Support both `/preferences` and `/users/me/preferences`, full 14-question schema | Normalize routes |
| **Backend** | Tasks & Projects | `/tasks`, `/projects` | CRUD endpoints matching frontend contracts (due date, status, blocker, assignee) | Enhance controllers |
| **Backend** | Meetings & Clients | `/meetings` | All actions (schedule, start, complete, transcript, action items) + `/clients` | Enhance controllers |
| **Backend** | Messages & Courses | `/communication`, `/tutorials` | Add `/messages` and `/courses` route aliases matching frontend calls | Add route aliases |
| **Backend** | Analytics & Assistant | `/analytics` | Add `/analytics` endpoint returning `DayRow[]`, `/assistant/messages` deterministic replies | Add endpoints |
| **Backend** | Adaptations API | Not implemented | `POST /api/adaptations/preview`, `POST /api/adaptations/apply`, `GET /api/adaptations/history`, `POST /api/adaptations/undo` | Implement |
| **Backend** | Seed Script | `reset-admin-password.ts` only | Comprehensive `seed.ts` populating users, tasks, projects, meetings, messages, courses, analytics | Create seed script |
| **Tests** | Backend Test Runner | 13/13 passing in `testRunner.ts` | Add unit tests for adaptive engine, widget scoring, undo, and API validation | Expand test suite |

---

## 2. Phase-by-Phase Execution Roadmap

### Phase 1: Audit & Baseline Verification (Completed)
- [x] Unpack and organize codebase at project root `d:\PROJECT`.
- [x] Fix TypeScript compilation error in `FeatureCharts.tsx`.
- [x] Verify Vite build (`npx vite build`) and frontend typecheck (`npx tsc --noEmit`).
- [x] Verify backend compilation and run 13/13 backend test suite checks.
- [x] Verify MongoDB connectivity.

### Phase 2: Backend Models & API Architecture
- [ ] Create missing Mongoose models:
  - `WorkspaceConfiguration.ts`
  - `AdaptationHistory.ts`
  - `ActivityLog.ts`
- [ ] Align and enhance existing models (`Task`, `Project`, `UserPreference`, `Meeting`, `Message`, `Course`, `AnalyticsMetric`) to guarantee 100% contract compatibility with frontend types.
- [ ] Implement required API controllers and routes:
  - Auth routes: `/auth/login`, `/auth/user/login`, `/auth/admin/login`, `/auth/register`, `/auth/user/register`, `/auth/me`, `/auth/logout`
  - Preferences routes: `/preferences` and `/users/me/preferences` (GET, PUT, PATCH)
  - Tasks & Projects CRUD: `/tasks`, `/projects` with filtering, sorting, status update, delete
  - Meetings & Clients: `/meetings/**`, `/clients`, `/integrations/google/**`
  - Communications: `/messages` (GET, POST, PATCH)
  - Study: `/courses` (GET, POST, PATCH)
  - Analytics: `/analytics` (GET `DayRow[]`)
  - Assistant: `/assistant/messages` (POST deterministic intent response)
  - Adaptations API: `/adaptations/preview`, `/adaptations/apply`, `/adaptations/history`, `/adaptations/undo`
  - Admin API: `/admin/dashboard`, `/admin/users`, `/admin/users/:id/status`, `/admin/activity`, `/admin/projects`
- [ ] Mount routes on both `/api/v1` and `/api` to support flexible client base URLs.

### Phase 3: Comprehensive Deterministic Adaptation Engine
- [ ] Refactor & expand `engine.ts` into a robust, deterministic, rule-based intent engine:
  - Normalized keyword extraction and token stemming
  - Multi-criteria scoring considering:
    1. Natural language intent keywords
    2. User onboarding answers (focus, layout, widgets, goal, navigation)
    3. Assigned tasks & task status (overdue, blockers, due today)
    4. Meeting agenda & preparation state
    5. Study goals & course progress
    6. Analytics anomalies
  - Registry of approved widget IDs (`tasks`, `meetings`, `messages`, `notifications`, `learning`, `projects`, `analytics`, `assistant`, plus focus widgets)
  - Explainability generator providing human-readable explanations of why widgets were promoted
  - Adaptation history tracking and undo mechanism
- [ ] Unit tests for intent classification, ambiguity handling, widget scoring, undo, and follow-ups.

### Phase 4: Frontend API & Session Integration
- [ ] Update `src/api/client.ts` to restore JWT tokens from localStorage/cookies seamlessly upon page reload.
- [ ] Update `src/api/services.ts` to support adaptation API endpoints (`preview`, `apply`, `history`, `undo`), handle response data wrappers gracefully, and expose all workspace operations.
- [ ] Connect Dashboard adaptive bar to both local fallback and server adaptation endpoints.

### Phase 5: Realistic Seed Data & Hackathon Demo Setup
- [ ] Create `backend/scripts/seed.ts` with rich demo data:
  - Admin: `admin@nexora.dev` / `Admin@1234567` (Role: `admin`)
  - User: `user@nexora.dev` / `User@1234567` (Role: `user`)
  - 3 Projects with realistic descriptions and progress
  - 10 Tasks with mixed statuses (todo, doing, done), priorities, overdue tags, and blockers
  - 4 Meetings with agendas, checklists, notes, attendees, and action items
  - 5 Messages with priority labels and unread statuses
  - 3 Courses with topics, assessments, and completion status
  - 90 days of realistic daily analytics data
  - Activity logs for the admin dashboard
- [ ] Add root npm scripts for easy starting (`npm run dev`, `npm run build`, `npm run seed`).

### Phase 6: Verification, End-to-End Testing & Documentation
- [ ] Run full typecheck and build on both frontend and backend.
- [ ] Run all automated backend tests and new adaptive engine unit tests.
- [ ] Verify complete E2E workflow:
  1. Landing page → Intent preview
  2. Registration & Login
  3. 14-question Personalization Wizard → DB persistence
  4. Dashboard rendering → Task table, Calendar, Summary cards
  5. Intent query → Adaptation preview → Apply → Verify widget changes → Undo
  6. Settings updates → Immediate theme/density/layout change
  7. Admin portal access & user status management
- [ ] Produce clear setup and API documentation in `README.md`.
