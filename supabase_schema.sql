-- ============================================================
-- Employee Activity Tracker - Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Employees table
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  slack_user_id text,
  api_key text unique not null default gen_random_uuid()::text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Screenshots table
create table if not exists screenshots (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  captured_at timestamptz not null,
  storage_path text not null,
  storage_url text,

  -- AI Analysis fields
  analyzed boolean default false,
  activity_category text,     -- coding / email / meetings / browsing / idle / other
  app_name text,              -- VS Code, Chrome, Excel, Teams...
  window_title text,
  productivity text,          -- High / Medium / Low / Idle
  focus_score int,            -- 0-100
  time_wasted_pct int,        -- 0-100
  notes text,
  analyzed_at timestamptz,

  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_screenshots_employee_id on screenshots(employee_id);
create index if not exists idx_screenshots_captured_at on screenshots(captured_at);
create index if not exists idx_screenshots_analyzed on screenshots(analyzed) where analyzed = false;
create index if not exists idx_screenshots_employee_date on screenshots(employee_id, captured_at);

-- Daily summaries table (populated by report generator)
create table if not exists daily_summaries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  summary_date date not null,
  total_screenshots int default 0,
  analyzed_screenshots int default 0,
  active_minutes int default 0,
  idle_minutes int default 0,
  offline_minutes int default 0,
  productivity_score numeric(5,2),         -- 0-100
  top_app text,
  top_category text,
  time_wasted_minutes int default 0,
  slack_posted boolean default false,
  created_at timestamptz default now(),
  unique(employee_id, summary_date)
);

-- ============================================================
-- Storage bucket (run this too)
-- ============================================================
-- In Supabase dashboard: Storage > New bucket > "screenshots"
-- Set to PRIVATE (not public)

-- RLS Policies - disable for now (server uses service key)
alter table employees disable row level security;
alter table screenshots disable row level security;
alter table daily_summaries disable row level security;

-- ============================================================
-- Helper view: employee status (last screenshot < 5min = active)
-- ============================================================
create or replace view employee_status as
select
  e.id,
  e.name,
  e.email,
  e.slack_user_id,
  e.active,
  max(s.captured_at) as last_seen,
  extract(epoch from (now() - max(s.captured_at))) / 60 as minutes_since_last,
  case
    when max(s.captured_at) is null then 'Offline'
    when extract(epoch from (now() - max(s.captured_at))) / 60 < 5 then 'Active'
    when extract(epoch from (now() - max(s.captured_at))) / 60 < 30 then 'Idle'
    else 'Offline'
  end as status,
  count(s.id) filter (where s.captured_at >= current_date) as screenshots_today
from employees e
left join screenshots s on s.employee_id = e.id
where e.active = true
group by e.id, e.name, e.email, e.slack_user_id, e.active;
