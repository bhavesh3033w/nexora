# Nexora Meetings — Google Meet + AI Meeting Intelligence (Spring Boot contract)

This document is the contract between the Nexora React frontend (already implemented in this repo) and the **separate Spring Boot backend** you are building. The frontend never sees Google secrets, refresh tokens or AI keys; everything below happens on the server.

> Status legend used in this repo: **Frontend: implemented** · **Backend: specified here / reference code in `backend-reference/` (not compiled or run — see its README)**.
> Google API behaviour (scopes, transcript availability, retention) changes. Treat the Google details as a checklist to verify against the current Google documentation before launch.

---
## 1. How the flow works
1. User clicks **Connect Google** → `GET /api/integrations/google/connect` returns `{authUrl}` (server-built consent URL with a one-time CSRF `state`). The browser navigates to Google.
2. Google redirects to `GET /api/integrations/google/callback?code&state`. The server verifies `state` (bound to the logged-in user, single use, ≤10 min), exchanges the code, encrypts and stores the refresh token, then redirects the browser to `{NEXORA_FRONTEND_URL}/app/meetings?google=connected` (or `?google=error&code=<ERROR_CODE>`).
3. `POST /api/meetings` with `createGoogleEvent=true` creates a Calendar event with `conferenceData.createRequest` (`hangoutsMeet`), `conferenceDataVersion=1`, `sendUpdates=all`, attendees = selected clients' emails. The server stores `googleEventId`, `meetUrl`, `meetingCode`, attendees. Status → `SCHEDULED`.
4. **Start Meeting** → `POST /api/meetings/{id}/start` returns `{meetUrl,status:"IN_PROGRESS"}`; the frontend opens that real URL. Selecting a client does **not** join them; they receive a Google invitation and join with their own link/permissions.
5. After the meeting: the organizer clicks **Mark meeting ended** (`POST /complete`) *or* the scheduler detects the Meet conference record has ended. Status → `PROCESSING`, `reportStatus=WAITING_FOR_TRANSCRIPT`.
6. The scheduled job looks up the conference record (`meeting_code`), lists transcripts, and — when a transcript reaches `FILE_GENERATED` — reads its entries, sends the text to the configured AI provider, stores the report, sets `status=COMPLETED`, `reportStatus=READY`. If no transcript exists after bounded retries → `TRANSCRIPT_UNAVAILABLE` (never a fabricated summary). The user can then paste/upload a transcript (`POST /transcript`).
7. The frontend polls `GET /api/meetings` every 20 s while any meeting is `IN_PROGRESS`/`PROCESSING`; the dashboard widget and Insights page update from the same data.

## 2. Google Cloud configuration (still required — nothing here is pre-configured)
1. Create a Google Cloud project → enable **Google Calendar API** and **Google Meet REST API** (`meet.googleapis.com`). Optional: **Google Workspace Events API** + **Cloud Pub/Sub** for push notifications (polling is the baseline and always required as a fallback).
2. OAuth consent screen: add the scopes below. Sensitive scopes require **OAuth app verification** for production use outside your own domain.
3. Create an OAuth 2.0 *Web application* client. Authorized redirect URI: `https://<api-host>/api/integrations/google/callback` (and `http://localhost:8080/api/integrations/google/callback` for dev).
4. Request `access_type=offline` and `prompt=consent` so a refresh token is returned.

| Scope | Why |
|---|---|
| `openid email` | identify the connected Google account |
| `https://www.googleapis.com/auth/calendar.events` | create/update events with Meet links and invite attendees |
| `https://www.googleapis.com/auth/meetings.space.readonly` | read conference records, transcript metadata and transcript entries for meetings the user organised |

Keep scopes minimal: no Drive scope is needed because transcript text is read through the Meet REST API `transcripts.entries` instead of the exported Google Doc.

### Transcript reality check (do not promise more than Google provides)
- Transcripts exist **only if transcription was turned on** in that meeting (by the organiser, or by Workspace admin/Calendar defaults) and the account's Workspace edition supports it. Many personal Google accounts cannot generate transcripts.
- Transcripts can take minutes to appear after the meeting ends; entries are retained by Google for a limited time (verify the current retention period) so process promptly.
- The authorised account must have access to the conference record. Otherwise Google returns 403 → map to `GOOGLE_PERMISSION_MISSING` or `TRANSCRIPT_NOT_AVAILABLE`.
- Obtain participant consent for recording/transcription and respect your Workspace/privacy policies.

## 3. Environment / configuration (Spring Boot)
```yaml
nexora:
  frontend-url: ${NEXORA_FRONTEND_URL:http://localhost:5173}
  google:
    client-id: ${GOOGLE_CLIENT_ID:}          # empty => status.configured=false, GOOGLE_NOT_CONFIGURED errors
    client-secret: ${GOOGLE_CLIENT_SECRET:}
    redirect-uri: ${GOOGLE_REDIRECT_URI:http://localhost:8080/api/integrations/google/callback}
  security:
    token-encryption-key: ${NEXORA_TOKEN_KEY}   # base64 of 32 random bytes; required. e.g. `openssl rand -base64 32`
  transcripts:
    poll-interval: PT2M
    max-attempts: 8
    backoff: [PT2M, PT5M, PT10M, PT20M, PT30M, PT1H, PT2H, PT4H]
    retain-raw-text: false                   # store only the generated report by default
    max-upload-bytes: 1000000
  ai:
    provider: ${AI_PROVIDER:openai-compatible}   # pluggable: see MeetingAnalyzer
    base-url: ${AI_BASE_URL:https://api.openai.com/v1}
    model: ${AI_MODEL:}
    api-key: ${AI_API_KEY:}                  # server-side only; never logged
    max-input-chars: 120000                  # longer transcripts are chunked (map-reduce)
spring:
  servlet.multipart.max-file-size: 1MB
```
Frontend `.env`: `VITE_API_BASE_URL=http://localhost:8080/api` (the frontend has no mock mode). CORS must allow the frontend origin with credentials (HttpOnly session cookie, `SameSite=Lax`).

### Dependencies (Maven)
`spring-boot-starter-web`, `-security`, `-validation`, `-data-jpa`, `-actuator`; your DB driver (PostgreSQL recommended; the SQL in `backend-reference/` is portable) + `flyway-core`; `com.google.api-client:google-api-client`, `com.google.apis:google-api-services-calendar`, `com.google.auth:google-auth-library-oauth2-http` (Meet REST can be called with `RestClient`); `net.javacrumbs.shedlock:shedlock-spring` + a provider (prevents duplicate scheduler runs across instances); `spring-boot-starter-test`, `spring-security-test`, Testcontainers (integration tests).

## 4. REST API
All endpoints require authentication (session cookie). Every `/meetings/**` endpoint enforces **ownership** (`meeting.ownerId == principal.id`); administrators do not get transcript/report access by default. Errors use:
```json
{ "code": "GOOGLE_NOT_CONNECTED", "message": "human readable detail", "fieldErrors": { "title": "required" } }
```
| Code | HTTP | Meaning |
|---|---|---|
| `GOOGLE_NOT_CONFIGURED` | 503 | Server has no OAuth client credentials |
| `GOOGLE_NOT_CONNECTED` | 409 | User has not connected Google |
| `GOOGLE_TOKEN_EXPIRED` | 409 | Refresh token revoked/expired → reconnect |
| `GOOGLE_PERMISSION_MISSING` | 403 | Required scope not granted |
| `GOOGLE_API_ERROR` | 502 | Upstream Google failure (retryable) |
| `TRANSCRIPT_PENDING` / `TRANSCRIPT_NOT_AVAILABLE` | 202 / 404 | Not yet generated / does not exist or no access |
| `TRANSCRIPT_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE` | 413 / 415 | Upload validation |
| `AI_PROVIDER_ERROR` | 502 | Provider failed/not configured |
| `MEETING_NOT_FOUND` / `FORBIDDEN` / `VALIDATION_ERROR` | 404 / 403 / 400 | |

### Google integration
| Endpoint | Request → Response |
|---|---|
| `GET /integrations/google/status` | → `GoogleStatus {connected, configured, email?, scopes?[], transcriptAccess?}` |
| `GET /integrations/google/connect` | → `{authUrl}` (creates + stores one-time `state`) |
| `GET /integrations/google/callback?code&state` | verifies state → 302 to `/app/meetings?google=connected` or `?google=error&code=…` |
| `DELETE /integrations/google` | revokes token at Google, deletes stored credentials → 204 |

### Clients
`GET /clients` → `Client[] {id,name,email,company}` (the user's own clients).

### Meetings
`Meeting` JSON (all fields the frontend reads; see `src/types/index.ts`):
```json
{ "id":"…","title":"…","client":"Orbit Retail","date":"2026-10-20","time":"10:00","timezone":"Asia/Kolkata",
  "agenda":"…","notes":"…","attendees":["Elena Rossi"],"attendeeDetails":[{"name":"Elena Rossi","email":"e@x.com","clientId":"cl1"}],
  "status":"scheduled|draft|in_progress|processing|completed|failed",
  "reportStatus":"none|waiting_for_transcript|processing|ready|transcript_unavailable|failed","reportError":"…",
  "meetUrl":"https://meet.google.com/abc-mnop-xyz","googleEventId":"…","calendarUrl":"…","transcriptAvailable":true,
  "checklist":[{"id":"","text":"","done":false}],"actions":[{"id":"","text":"","done":false}],
  "report": MeetingReport | null, "startedAt":"ISO","endedAt":"ISO","processedAt":"ISO" }
```
`MeetingReport`: `{summary, topics[], decisions[], actionItems[{id,text,owner?,deadline?,done}], risks[], followUps[], generatedAt, source:"google-transcript|manual-transcript", engine}` — `engine` must be the real provider/model name; the frontend no longer has a `simulated` field.

| Endpoint | Body → Response |
|---|---|
| `GET /meetings` | → `Meeting[]` (own meetings). Optional filters `status, clientId, from, to, q` |
| `POST /meetings` | `{title,client,date,time,timezone,agenda,notes,attendees[{name,email,clientId?}],createGoogleEvent}` → `Meeting`. With `createGoogleEvent=true` and no Google connection → `409 GOOGLE_NOT_CONNECTED` (frontend only offers the box when connected). Without it → `DRAFT`. |
| `GET /meetings/{id}` | → `Meeting` |
| `PATCH /meetings/{id}` | partial `Meeting` (title, agenda, notes, checklist, attendeeDetails, date/time…). If a Google event exists, update it (`sendUpdates=all`) |
| `POST /meetings/{id}/schedule` | creates the Google event for a `DRAFT` → `Meeting` |
| `POST /meetings/{id}/start` | → `{meetUrl,status:"in_progress"}`; sets `startedAt`. `409 GOOGLE_NOT_CONNECTED` / error if no Meet link exists |
| `POST /meetings/{id}/complete` | organiser marks ended → status `processing`, reportStatus `waiting_for_transcript`; enqueues job → `Meeting` |
| `GET /meetings/{id}/report` | → `MeetingReport` or `404` (no report). (`report` is also embedded in `Meeting`) |
| `POST /meetings/{id}/process-transcript` | retry now: resets attempt counter if `transcript_unavailable`/`failed`; idempotent if already `processing`/`ready` → `Meeting` |
| `POST /meetings/{id}/transcript` | `{text}` (JSON, ≤ 200 000 chars) **or** `multipart/form-data` `file` (.txt .vtt .srt .md, ≤1 MB, UTF-8, content sniffed) → analyses and returns `Meeting` with `report` |
| `PATCH /meetings/{id}/action-items/{actionItemId}` | `{done:boolean}` → `Meeting`. Backend should keep `actions[]` in sync with report action items (same ids) so dashboard widgets show them |

## 5. Transcript workflow (backend)
```
processing-job(meeting):                      # runs from @Scheduled poll + immediately after /complete
  CAS: reportStatus WAITING|UNAVAILABLE(retry) -> PROCESSING   # exactly one worker wins (UPDATE … WHERE status = ?)
  token = decrypt(refresh) → access token; on invalid_grant → mark GOOGLE_TOKEN_EXPIRED, stop (no retry storm)
  record = meet.conferenceRecords.list(filter = space.meeting_code = "<code>")     # may be empty → retry later
  transcripts = meet.conferenceRecords.transcripts.list(record)
  if none or state != FILE_GENERATED: schedule retry with backoff; after max-attempts → TRANSCRIPT_UNAVAILABLE
  text = join(meet.transcripts.entries.list(...))        # paginated; do not log
  report = analyzer.analyze(text)                        # validated JSON, grounded in text
  tx { upsert meeting_report (UNIQUE meeting_id) ; reportStatus=READY ; status=COMPLETED ; sync action items }
  drop `text` (unless retain-raw-text=true, then encrypt at rest)
```
Idempotency: unique `meeting_reports.meeting_id`, CAS status transitions, Google transcript resource name stored as `transcript_ref` (duplicate Pub/Sub deliveries or poll overlaps are no-ops). Optional push: Workspace Events subscription for `google.workspace.meet.transcript.v2.fileGenerated` → Pub/Sub push endpoint that **verifies the Google-signed OIDC JWT** (audience + service-account email) before enqueueing; the poll remains the safety net.

### AI analysis contract (provider-pluggable `MeetingAnalyzer`)
System prompt rules: *use only the transcript; never invent speakers, owners or deadlines; leave `owner`/`deadline` null unless explicitly stated; return JSON only.* Expected JSON: `{summary, topics[], decisions[], actionItems[{text,owner|null,deadline|null}], risks[], followUps[]}`. Validate with a schema, reject/repair-retry once, otherwise `reportStatus=failed` with `AI_PROVIDER_ERROR`. Chunk transcripts longer than `max-input-chars` (summarise chunks, then merge). Treat transcript text as **untrusted data** (prompt-injection) — never let it change instructions or trigger tool use.

## 6. Security checklist
- Spring Security on everything; ownership check in the service layer (`@PreAuthorize` + repository queries scoped by owner). Frontend route guards are UX only.
- OAuth `state`: random 256-bit, stored server-side bound to user+session, single-use, 10-min TTL; reject mismatches. Use PKCE if desired.
- Refresh tokens: AES-256-GCM (`TokenCipher`), key from env/secret manager, rotated via key-id prefix. Never return tokens to the browser; never log tokens, auth codes, transcripts or AI request bodies.
- Redact `text`/`transcript` fields in logging and exception messages. Add request-size limits and per-user rate limits on `/transcript` and `/process-transcript`.
- Upload validation: size, extension allow-list, strict UTF-8, no archive/office formats.
- Retention: delete raw transcript text after analysis by default; provide delete-report capability; document consent/retention in your privacy policy.
- Never return success if Google/AI calls failed. Return the error code above.

## 7. Tests to add in the backend
Unit: `TokenCipher` round-trip/tamper; transcript state machine (CAS, backoff, max attempts); VTT cleaning; JSON schema validation of analyzer output; ownership checks (user A cannot read user B's meeting → 403/404). Integration (Testcontainers + WireMock for Google/AI): connect callback with bad `state` → rejected; create meeting → Calendar insert payload contains `conferenceData.createRequest` and attendees; transcript delayed → retried then `READY`; no transcript → `TRANSCRIPT_UNAVAILABLE`; duplicate Pub/Sub delivery → single report; revoked token → `GOOGLE_TOKEN_EXPIRED`.

## 8. Manual end-to-end test
1. Set the env vars, start the backend, run `npm run dev`, sign in.
2. Meetings → **Connect Google** → approve → you land back with “Google account connected”.
3. **New meeting** → select a client (use a real mailbox you control) → create with the Google box ticked → check Google Calendar for the event + Meet link and the invitation email.
4. Open the meeting → **Start Meeting** → Meet opens in a new tab. In Meet, turn on **transcription** (Workspace account), talk for a minute, end the call.
5. Back in Nexora click **Mark meeting ended** → status Processing / “Waiting for transcript” → within minutes the report appears (Insights page + dashboard widget update).
6. Negative tests: disconnect Google → Start shows a clear error; meeting without transcription → “Transcript unavailable” after retries; paste a transcript → report generated; mark an action item complete.
