-- Migration 001: Add activity columns + employee profile columns
-- Run once in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT DO NOTHING)

-- ── Phase 1: Activity columns on screenshots ─────────────────────────────────
ALTER TABLE screenshots
ADD COLUMN IF NOT EXISTS keyboard_count INTEGER,
ADD COLUMN IF NOT EXISTS mouse_count    INTEGER,
ADD COLUMN IF NOT EXISTS activity_level TEXT;

CREATE INDEX IF NOT EXISTS idx_screenshots_activity
ON screenshots(activity_level);

-- ── Phase 3: Profile columns on employees ────────────────────────────────────
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS role             TEXT,
ADD COLUMN IF NOT EXISTS department       TEXT,
ADD COLUMN IF NOT EXISTS work_description TEXT,
ADD COLUMN IF NOT EXISTS expected_apps    TEXT[],
ADD COLUMN IF NOT EXISTS expected_sites   TEXT[],
ADD COLUMN IF NOT EXISTS youtube_ok       BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS meeting_pct      INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS edge_cases       TEXT;

CREATE INDEX IF NOT EXISTS idx_employees_role       ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);

-- ── Ishfak's profile ─────────────────────────────────────────────────────────
UPDATE employees
SET
  role             = 'Full Stack Developer',
  department       = 'Engineering',
  work_description = 'Building employee monitoring system with Python, React, and AI. Full-stack: desktop agent, backend API, web dashboard, AI analysis.',
  expected_apps    = ARRAY['Visual Studio Code', 'PyCharm', 'Google Chrome', 'Slack', 'Git Bash', 'Postman'],
  expected_sites   = ARRAY['github.com', 'stackoverflow.com', 'supabase.com', 'anthropic.com', 'react.dev', 'python.org'],
  youtube_ok       = true,
  meeting_pct      = 10,
  edge_cases       = 'Works late at night. Sometimes tests on multiple machines. Uses both VS Code and PyCharm depending on project.'
WHERE email = 'ishfakeraz@gmail.com';

-- ── v4.0.0 additions ─────────────────────────────────────────────────────────

-- Cleaned app/window columns on screenshots
ALTER TABLE screenshots
ADD COLUMN IF NOT EXISTS app_name     TEXT,
ADD COLUMN IF NOT EXISTS window_title TEXT;

-- Password support on employees
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Admins table (separate admin accounts)
CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Default admin: username=admin, password=admin123
INSERT INTO admins (username, password_hash)
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5ux8F9Kq/f7S2')
ON CONFLICT DO NOTHING;

-- Device registrations (links MAC-based device_id to employee after onboarding)
CREATE TABLE IF NOT EXISTS device_registrations (
  device_id   TEXT PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  registered  BOOLEAN DEFAULT false,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Real-time tracking flag (agent sets TRUE on START, FALSE on STOP/close)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS is_tracking BOOLEAN DEFAULT FALSE;
