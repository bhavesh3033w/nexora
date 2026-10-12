-- Portable SQL (PostgreSQL-flavoured types; adjust for MySQL/other). UNTESTED reference.
CREATE TABLE google_connections (
  user_id            VARCHAR(64) PRIMARY KEY,
  google_email       VARCHAR(320) NOT NULL,
  refresh_token_enc  TEXT NOT NULL,            -- TokenCipher "v1:..." AES-GCM; never plaintext
  scopes             TEXT NOT NULL,
  connected_at       TIMESTAMP NOT NULL,
  revoked_at         TIMESTAMP NULL
);
CREATE TABLE meetings (
  id                 VARCHAR(64) PRIMARY KEY,
  owner_id           VARCHAR(64) NOT NULL,     -- every query is scoped by owner_id
  title              VARCHAR(140) NOT NULL,
  client_name        VARCHAR(200),
  meeting_date       DATE NOT NULL,
  meeting_time       TIME NOT NULL,
  timezone           VARCHAR(64) NOT NULL,
  agenda             TEXT, notes TEXT,
  status             VARCHAR(20) NOT NULL,     -- DRAFT|SCHEDULED|IN_PROGRESS|PROCESSING|COMPLETED|FAILED
  report_status      VARCHAR(30) NOT NULL DEFAULT 'NONE', -- NONE|WAITING_FOR_TRANSCRIPT|PROCESSING|READY|TRANSCRIPT_UNAVAILABLE|FAILED
  report_error       VARCHAR(500),
  google_event_id    VARCHAR(256), meet_url VARCHAR(256), meeting_code VARCHAR(32), calendar_url VARCHAR(512),
  transcript_ref     VARCHAR(256) UNIQUE,      -- Google transcript resource name => duplicate deliveries are no-ops
  attempts           INT NOT NULL DEFAULT 0, next_attempt_at TIMESTAMP NULL,
  started_at TIMESTAMP, ended_at TIMESTAMP, processed_at TIMESTAMP,
  created_at         TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_meetings_owner ON meetings(owner_id, meeting_date);
CREATE INDEX idx_meetings_poll ON meetings(report_status, next_attempt_at);
CREATE TABLE meeting_attendees (
  meeting_id VARCHAR(64) NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL, name VARCHAR(200), client_id VARCHAR(64),
  PRIMARY KEY (meeting_id, email)
);
CREATE TABLE meeting_reports (
  meeting_id   VARCHAR(64) PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,  -- one report per meeting (idempotent upsert)
  summary      TEXT NOT NULL, topics_json TEXT NOT NULL, decisions_json TEXT NOT NULL, risks_json TEXT NOT NULL, follow_ups_json TEXT NOT NULL,
  source       VARCHAR(30) NOT NULL,           -- google-transcript | manual-transcript
  engine       VARCHAR(100) NOT NULL,          -- real provider/model name
  generated_at TIMESTAMP NOT NULL
);
CREATE TABLE report_action_items (
  id VARCHAR(64) PRIMARY KEY, meeting_id VARCHAR(64) NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  text VARCHAR(1000) NOT NULL, owner VARCHAR(200), deadline VARCHAR(64), done BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE oauth_states (state VARCHAR(128) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, expires_at TIMESTAMP NOT NULL, used BOOLEAN NOT NULL DEFAULT FALSE);
