# NEXORA — Intent-to-Interface: Adaptive AI Workspace
### Full-Stack MERN Application · Deterministic Adaptive Engine · Premium Design System

NEXORA is an adaptive productivity workspace that reorganizes its interface according to user goals, preferences, priorities, and assigned tasks.

```
Intent → Context → Workspace Adaptation → Productive Action
```

Instead of forcing every user into a static one-size-fits-all dashboard, NEXORA dynamically reshapes widgets, focus areas, and recommended shortcuts based on real application telemetry and deterministic rule-based natural language classification.

---

## 1. Architectural Highlights

- **Zero External LLM Dependency**: The core adaptation system uses 100% deterministic, rule-based logic, user onboarding answers, assigned tasks, overdue deadlines, blockers, and meeting context. Natural language requests are classified locally using weighted token matching and keyword stemming. The result is instant (<10ms), private, testable, explainable, and functional offline without API keys.
- **Complete MERN Stack**: Built with React 18, TypeScript, Vite, Express.js, Node.js, and MongoDB with Mongoose.
- **Dusk Rose & Mocha Design System**: Minimalist visual hierarchy, serif editorial headlines, clean sans-serif controls, warm neutral surfaces (`#FBF7F2`, `#FFFEFC`, `#F4ECE5`), rose accents (`#B56F76`), and an accessible dark theme.
- **14-Question Personalization Wizard**: Deep onboarding configuration persisted in MongoDB that directly controls focus widgets, navigation style, density, and layout.
- **Six Full Workspaces**: Meetings with transcript insights, Projects with Kanban task board, Communication inbox, Study & Learning tracks, 90-day Data Analytics with Recharts, and an AI Assistant.
- **Role-Based Admin Console**: Cryptographic JWT authentication, user status management, audit logging, and system health metrics.

---

## 2. Quick Start & Local Run Instructions

### Prerequisites
- Node.js v18+ (tested on Node.js v20)
- MongoDB instance (MongoDB Server running locally on `localhost:27017` or MongoDB Atlas URI)

### A. Environment Configuration

1. **Frontend Environment** (`.env` in project root):
   ```bash
   VITE_API_BASE_URL=http://localhost:5000/api/v1
   ```
2. **Backend Environment** (`backend/.env`):
   ```bash
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://127.0.0.1:27017/nexora
   JWT_SECRET=supersecretkey_change_in_production_min32chars
   JWT_EXPIRES_IN=7d
   CORS_ORIGIN=http://localhost:5173,http://localhost:3000
   ```

### B. Install Dependencies & Seed Database

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Run database seed script (populates demo accounts, tasks, meetings, courses)
npm run seed
cd ..
```

### C. Run the Applications

**Terminal 1 (Backend API):**
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
# Health check: http://localhost:5000/api/v1/health
```

**Terminal 2 (Frontend Client):**
```bash
npm run dev
# Frontend running at http://localhost:5173
```

---

## 3. Seeded Accounts & Credentials

The database seed script (`npm run seed`) provisions two pre-configured accounts:

| Role | Email | Password | Access / Purpose |
|---|---|---|---|
| **Administrator** | `admin@nexora.dev` | `Admin@1234567` | Access to `/admin` portal, user status management, system audit logs, and project administration |
| **Standard User** | `user@nexora.dev` | `User@1234567` | Access to `/app` dashboard, 6 workspaces, 14 onboarding answers, personalized tasks, and meetings |

---

## 4. Verification & Automated Test Suites

All tests and typechecks run offline without network latency:

```bash
# Run backend test suite (21 unit tests covering cryptography, JWT, transcripts, models, and adaptive engine)
npm run test:backend

# Run frontend typecheck
npm run typecheck

# Run frontend production build
npm run build
```

**Test Verification Summary:**
- `testRunner.ts`: **21/21 passed, 0 failed**
- Frontend TypeScript check (`tsc --noEmit`): **0 errors**
- Production bundle: **Built successfully via Vite**

---

## 5. Deterministic Adaptive Workspace Engine

### Pipeline
1. **User Input**: Plain text goal (e.g., *"Prepare for tomorrow's client meeting"* or *"Show overdue project tasks and blockers"*).
2. **Token Normalization & Weighted Scoring**: Normalizes whitespace, punctuation, and casing. Evaluates strong keywords (weight: 2) and weak keywords (weight: 1).
3. **Context Enrichment**: Reads database telemetry (overdue tasks, upcoming meetings, active course assessments, unread messages).
4. **Configuration Generation**: Promotes approved widget IDs (`tasks`, `meetings`, `messages`, `notifications`, `learning`, `projects`, `analytics`, `assistant`) and focus components (`agenda`, `clientContext`, `overdue`, `blockers`, `revisionTopics`, `activityChart`).
5. **Explainability**: Returns transparent human-readable explanation of why widgets were promoted and which keywords matched.
6. **Undo & History**: Stores adaptation snapshots in `AdaptationHistory` collection, allowing one-click rollback.

### Sample Inputs to Test in Dashboard Command Bar:
- `"Prepare for tomorrow's client meeting."` → Promotes agenda, client context, and meeting checklist.
- `"Help me prepare for my upcoming exam."` → Promotes study plan, revision topics, and practice questions.
- `"Show overdue project tasks and blockers."` → Highlights overdue tasks, blocker descriptions, and board.
- `"Investigate why active users have declined."` → Promotes 90-day activity area chart and period-over-period delta.
- `"Summarize my unread messages and help me reply."` → Promotes inbox triage and communication widgets.

---

## 6. API Route Contracts

The backend mounts endpoints on both `/api/v1` and `/api`:

### Authentication & Profiles
- `POST /api/v1/auth/register` (and `/user/register`)
- `POST /api/v1/auth/login` (and `/user/login`)
- `POST /api/v1/auth/admin/login` (requires admin role)
- `GET /api/v1/auth/me` (requires Bearer token)
- `POST /api/v1/auth/logout`
- `PATCH /api/v1/auth/profile`
- `POST /api/v1/auth/change-password`

### Preferences (14 Questions)
- `GET /api/v1/preferences` (and `/users/me/preferences`)
- `PUT /api/v1/preferences` (and `/users/me/preferences`)
- `PATCH /api/v1/preferences`

### Tasks & Projects
- `GET /api/v1/tasks` (with optional `?projectId`, `?status`, `?assignee`)
- `POST /api/v1/tasks`
- `GET /api/v1/tasks/:id`
- `PATCH /api/v1/tasks/:id`
- `PUT /api/v1/tasks/:id`
- `DELETE /api/v1/tasks/:id`
- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/:id`
- `PATCH /api/v1/projects/:id`
- `PUT /api/v1/projects/:id`
- `DELETE /api/v1/projects/:id`

### Meetings & Transcripts
- `GET /api/v1/meetings`
- `POST /api/v1/meetings`
- `GET /api/v1/meetings/:id`
- `PATCH /api/v1/meetings/:id`
- `POST /api/v1/meetings/:id/schedule`
- `POST /api/v1/meetings/:id/start`
- `POST /api/v1/meetings/:id/complete`
- `POST /api/v1/meetings/:id/process-transcript`
- `POST /api/v1/meetings/:id/transcript`
- `PATCH /api/v1/meetings/:id/action-items/:itemId`
- `GET /api/v1/clients`
- `GET /api/v1/integrations/google/status`

### Communication & Messages
- `GET /api/v1/messages` (and `/communication`)
- `POST /api/v1/messages`
- `PATCH /api/v1/messages/:id`
- `PUT /api/v1/messages/:id`
- `DELETE /api/v1/messages/:id`

### Study & Learning
- `GET /api/v1/courses` (and `/tutorials`)
- `POST /api/v1/courses`
- `PATCH /api/v1/courses/:id`
- `PUT /api/v1/courses/:id`

### Analytics & Metrics
- `GET /api/v1/analytics` (returns `DayRow[]` for charts)
- `GET /api/v1/analytics/metrics` (summary KPI metrics)
- `GET /api/v1/analytics/features` (feature breakdown)

### Adaptations Engine
- `POST /api/v1/adaptations/preview`
- `POST /api/v1/adaptations/apply`
- `GET /api/v1/adaptations/history`
- `POST /api/v1/adaptations/undo`

### Assistant
- `POST /api/v1/assistant/messages`

### Admin Management
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id/status`
- `GET /api/v1/admin/activity`

---

## 7. Status of External Integrations

To ensure honest demonstration and zero reliance on paid API services during evaluations:
- **Google Calendar / Meet**: Handled through realistic internal meeting rooms and schedule status indicators. Full OAuth hook architecture is implemented in `integrationRoutes.ts`.
- **Transcript Speech-to-Text**: Raw meeting transcripts are parsed and analyzed using local heuristic cleaners and structured entity extractors (`TranscriptService` & `AiAnalyzerService`) rather than paid external audio transcribers.
- **AI Personalization Engine**: Driven 100% by deterministic rule engines and MongoDB context telemetry.

---

## 8. License & Credits

Built for the **Intent-to-Interface Hackathon Challenge**.
© NEXORA — All rights reserved.
