# Nexora Backend API Service

Enterprise MERN backend for the Nexora Collaboration & Workspace Platform.
Built with Node.js, Express.js, MongoDB Atlas (Mongoose), JWT authentication, bcrypt password hashing, and transcript analysis engines.

---

## 1. Architecture Overview

```
backend/
├── .env.example              # Environment variables template
├── package.json              # Backend dependencies & scripts
├── tsconfig.json             # TypeScript configuration
├── dist/                     # Compiled JavaScript output
└── src/
    ├── config/
    │   ├── db.ts             # MongoDB Atlas connection with pooling & graceful shutdown
    │   └── env.ts            # Environment parsing & defaults
    ├── controllers/
    │   ├── adminController.ts          # System diagnostics & user role management
    │   ├── analyticsController.ts      # Feature metrics & telemetry tracking
    │   ├── authController.ts           # JWT login, registration, password hashing
    │   ├── communicationController.ts  # Workspace channels & message threads
    │   ├── meetingController.ts        # Meetings, transcripts, AI insights
    │   ├── preferenceController.ts     # Personalization & adaptive workspace
    │   ├── projectController.ts        # Projects, progress tracking
    │   ├── taskController.ts           # Kanban tasks & status progression
    │   └── tutorialController.ts       # Courses & study modules
    ├── middleware/
    │   ├── auth.ts           # JWT Bearer token authentication & user context
    │   ├── errorHandler.ts   # Centralized error handler & Mongoose/Zod error parser
    │   ├── roles.ts          # Role-Based Access Control (RBAC: user, manager, admin)
    │   └── validate.ts       # Zod schema validation middleware
    ├── models/
    │   ├── AnalyticsMetric.ts# Telemetry and usage records
    │   ├── Channel.ts        # Chat and communication channels
    │   ├── Course.ts         # Tutorials and study lessons
    │   ├── Meeting.ts        # Meetings, transcript entries, AI action items
    │   ├── Message.ts        # Channel messages and attachments
    │   ├── Project.ts        # Project boards and workspace metadata
    │   ├── Task.ts           # Kanban task items
    │   ├── User.ts           # User accounts with bcrypt password hashes
    │   └── UserPreference.ts # Adaptive layouts and personalization questions
    ├── routes/
    │   ├── adminRoutes.ts
    │   ├── analyticsRoutes.ts
    │   ├── authRoutes.ts
    │   ├── communicationRoutes.ts
    │   ├── index.ts          # Root API router (/api/v1) & health check (/health)
    │   ├── meetingRoutes.ts
    │   ├── preferenceRoutes.ts
    │   ├── projectRoutes.ts
    │   ├── taskRoutes.ts
    │   └── tutorialRoutes.ts
    ├── services/
    │   ├── aiAnalyzerService.ts    # AI executive summary, key takeaways & sentiment
    │   └── transcriptService.ts    # Transcript cleaning & talk-time distribution
    ├── tests/
    │   └── testRunner.ts     # Standalone automated unit and integration tests
    ├── utils/
    │   ├── jwt.ts            # JWT signing and verification
    │   ├── password.ts       # Bcrypt password hashing & comparison
    │   └── response.ts       # Standardized API response wrappers
    └── server.ts             # Express server setup and lifecycle management
```

---

## 2. Getting Started

### Prerequisites
- Node.js >= 20.x
- MongoDB Atlas cluster URI (or local MongoDB)

### Installation & Run
```bash
cd backend
npm install

# Run automated tests
npm test

# Build TypeScript to dist/
npm run build

# Start development server
npm run dev

# Start production server
npm start
```

---

## 3. Environment Variables (`.env.example`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port the server listens on | `5000` |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb://127.0.0.1:27017/nexora` |
| `JWT_SECRET` | 256-bit secret key for signing JWTs | *(set in .env)* |
| `JWT_EXPIRES_IN` | Token validity duration | `7d` |
| `CORS_ORIGIN` | Allowed client origins (comma-separated or `*`) | `http://localhost:3000` |
| `GEMINI_API_KEY` | Optional: Gemini API key for meeting transcript AI | *(empty fallback)* |

---

## 4. API Endpoints Specification

Base Path: `/api/v1`

### 4.1 Health Check
- **`GET /api/v1/health`**
  - **Auth**: None
  - **Response**: `{ status: "ok", uptimeSeconds: 120, database: { connected: true, driver: "mongoose" } }`

---

### 4.2 Authentication & User Profile (`/auth`)
- **`POST /api/v1/auth/register`**
  - **Body**: `{ email: string, password: string (min 6), name: string, department?: string }`
  - **Response 201**: `{ success: true, data: { token: string, user: IUser } }`
- **`POST /api/v1/auth/login`**
  - **Body**: `{ email: string, password: string }`
  - **Response 200**: `{ success: true, data: { token: string, user: IUser } }`
- **`GET /api/v1/auth/me`**
  - **Headers**: `Authorization: Bearer <token>`
  - **Response 200**: `{ success: true, data: { user: IUser } }`
- **`PATCH /api/v1/auth/profile`**
  - **Headers**: `Authorization: Bearer <token>`
  - **Body**: `{ name?: string, bio?: string, avatar?: string, department?: string, preferences?: object }`
- **`POST /api/v1/auth/change-password`**
  - **Headers**: `Authorization: Bearer <token>`
  - **Body**: `{ currentPassword: string, newPassword: string }`

---

### 4.3 Meetings, Transcripts & AI Insights (`/meetings`)
- **`GET /api/v1/meetings`**
  - **Headers**: `Authorization: Bearer <token>`
  - **Query Params**: `page`, `limit`, `status`, `search`
- **`POST /api/v1/meetings`**
  - **Headers**: `Authorization: Bearer <token>`
  - **Body**: `{ title: string, description?: string, scheduledAt?: string, durationMinutes?: number, attendees?: array }`
- **`GET /api/v1/meetings/:id`**
  - Returns meeting with full transcript and AI insights.
- **`PATCH /api/v1/meetings/:id`**
  - Updates meeting fields.
- **`DELETE /api/v1/meetings/:id`**
  - Deletes meeting.
- **`POST /api/v1/meetings/:id/process-transcript`**
  - **Headers**: `Authorization: Bearer <token>`
  - **Body**: `{ rawTranscript: string }`
  - **Action**: Cleans filler words, structures speaker blocks, calculates talk-time distribution, generates AI summary, key takeaways, action items, sentiment score, and topics.
- **`PATCH /api/v1/meetings/:id/actions/:actionItemId/toggle`**
  - Toggles action item `open` vs `completed`.

---

### 4.4 Projects & Tasks (`/projects` & `/tasks`)
- **`GET /api/v1/projects`**
  - Filter by `status`, `category`, `search`.
- **`POST /api/v1/projects`**
  - Creates project with title, category, priority, dueDate.
- **`GET /api/v1/projects/:id`**
  - Returns project and all child tasks.
- **`GET /api/v1/tasks`**
  - Query: `projectId`, `status`, `assigneeId`.
- **`POST /api/v1/tasks`**
  - Creates task with title, project, assignee, status, priority, order.
- **`PATCH /api/v1/tasks/:id/status`**
  - Body: `{ status: "backlog" | "todo" | "in_progress" | "review" | "done", order?: number }`
  - Automatically recalculates parent project progress percentage.

---

### 4.5 Team Communication (`/communication`)
- **`GET /api/v1/communication/channels`**
  - Retrieves channels list.
- **`POST /api/v1/communication/channels`**
  - Creates channel (`name`, `topic`, `workspaceType`, `isPrivate`).
- **`GET /api/v1/communication/channels/:channelId/messages`**
  - Retrieves chat messages with user avatars and reactions.
- **`POST /api/v1/communication/channels/:channelId/messages`**
  - Sends a message in channel.

---

### 4.6 Tutorials & Study (`/tutorials`)
- **`GET /api/v1/tutorials/courses`**
  - Public / Authenticated catalog of courses.
- **`GET /api/v1/tutorials/courses/:id`**
  - Course curriculum, lessons, modules.
- **`POST /api/v1/tutorials/courses/:id/enroll`**
  - Enrolls user into course.

---

### 4.7 Personalization & Adaptive Layout (`/preferences`)
- **`GET /api/v1/preferences`**
  - Retrieves user widget arrangement, theme, and adaptive engine preferences.
- **`PATCH /api/v1/preferences`**
  - Updates layout density, widget order, and onboarding question responses.

---

### 4.8 Analytics (`/analytics`)
- **`GET /api/v1/analytics/dashboard`**
  - Total meetings, completed meetings, tasks, productivity score.
- **`GET /api/v1/analytics/features`**
  - Feature adoption breakdown and weekly activity time series.
- **`POST /api/v1/analytics/events`**
  - Ingests telemetry metrics.

---

### 4.9 Admin Console (`/admin`)
- **`GET /api/v1/admin/overview`**
  - Protected: `requireAdmin`. Returns system health, process uptime, memory usage, entity counts.
- **`GET /api/v1/admin/users`**
  - Protected: `requireAdmin`. Paginated user directory.
- **`PATCH /api/v1/admin/users/:id/role`**
  - Updates user role (`user`, `manager`, `admin`).
