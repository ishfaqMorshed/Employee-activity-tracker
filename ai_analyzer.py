"""
Employee Activity Tracker - AI Analyzer
Version: 4.0.0 (Personalized — Claude claude-sonnet-4-6)

Fetches each employee's profile from DB and builds a role-specific
prompt so Claude judges productivity relative to the employee's job,
not a generic standard. Uses OS window title from agent as ground truth.

Usage:
  python ai_analyzer.py              # analyze all pending
  python ai_analyzer.py --limit 50   # analyze max 50 per run
  python ai_analyzer.py --today      # only analyze today's screenshots
"""

import os
import base64
import logging
import argparse
from datetime import datetime, date

import requests
import anthropic
from supabase import create_client, Client

# ============================================================
# CONFIG
# ============================================================

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
STORAGE_BUCKET = "screenshots"

# 1 = analyze every screenshot (good for once-daily 9 PM runs)
ANALYZE_EVERY_N = int(os.environ.get("ANALYZE_EVERY_N", "1"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ============================================================
# CLIENTS
# ============================================================

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# ============================================================
# EMPLOYEE PROFILE CACHE
# ============================================================

_employee_cache: dict[str, dict] = {}

def get_employee(employee_id: str) -> dict:
    if employee_id not in _employee_cache:
        result = supabase.table("employees").select(
            "id, name, role, department, work_description, expected_apps, expected_sites, youtube_ok, meeting_pct"
        ).eq("id", employee_id).execute()
        _employee_cache[employee_id] = result.data[0] if result.data else {}
    return _employee_cache[employee_id]

# ============================================================
# PERSONALIZED PROMPT
# ============================================================

def build_prompt(employee: dict, process_name: str, window_title_raw: str,
                 keyboard_count: int = 0, mouse_count: int = 0, activity_level: str = "") -> str:
    name = employee.get("name", "Unknown")
    role = employee.get("role") or "Employee"
    department = employee.get("department") or "Unknown department"
    work_desc = employee.get("work_description") or "No description provided"
    expected_apps = ", ".join(employee.get("expected_apps") or []) or "Not specified"
    expected_sites = ", ".join(employee.get("expected_sites") or []) or "Not specified"
    youtube_ok = employee.get("youtube_ok", False)
    meeting_pct = employee.get("meeting_pct", 25)

    window_section = ""
    if process_name or window_title_raw:
        window_section = f"""
ACTIVE WINDOW (captured from OS — use this as ground truth, do not guess):
- Process: {process_name or 'unknown'}
- Window title: {window_title_raw or 'unknown'}
"""

    activity_section = ""
    if activity_level:
        activity_section = f"""
ACTIVITY DATA (hardware counters from agent — objective signal):
- Keyboard strokes in last 60s: {keyboard_count}
- Mouse clicks in last 60s: {mouse_count}
- Activity level: {activity_level.upper()}
  (high = >100 keys or >20 clicks, medium = >30 keys or >10 clicks, low = minimal, idle = none)
Use this to distinguish active work from leaving an app open while away.
"""

    return f"""You are analyzing a workplace screenshot for an employee productivity report.
Be specific, factual, and fair. Employees can dispute generic reports — yours must be accurate.

EMPLOYEE PROFILE:
- Name: {name}
- Role: {role}
- Department: {department}
- Daily work: {work_desc}
- Expected apps: {expected_apps}
- Expected work sites: {expected_sites}
- YouTube for work tutorials: {'Yes — count relevant tutorials as Medium productivity' if youtube_ok else 'No — YouTube is off-task unless clearly work demo'}
- Typical meeting time: ~{meeting_pct}% of day
{window_section}{activity_section}
ANALYSIS RULES:
1. If window title is available, use it to identify EXACTLY what is on screen:
   - "Homepage redesign v3 — Figma" → app_name="Figma", window_title="Homepage redesign v3"
   - "How to center a div - Stack Overflow - Chrome" → app_name="Stack Overflow (Chrome)", window_title="How to center a div"
   - "How to use React Hooks - YouTube" → app_name="YouTube (Chrome)", window_title="How to use React Hooks"
   - "dashboard.py - Visual Studio Code" → app_name="VS Code", window_title="dashboard.py"
   - "Inbox (24) - Gmail" → app_name="Gmail (Chrome)", window_title="Inbox"
   - "Zoom Meeting" → app_name="Zoom", window_title="Meeting"

2. Judge productivity RELATIVE TO THIS EMPLOYEE'S ROLE:
   - {role} using their expected tools ({expected_apps}) = High
   - {role} in meetings/Zoom/Teams = Medium-High (they have {meeting_pct}% meeting time)
   - {role} on work email/Slack = Medium
   - {role} on relevant reference sites ({expected_sites}) = Medium-High
   - {role} on social media/news/entertainment = Low
   - Screen locked / blank / idle = Idle

3. Notes must be specific:
   - Good: "Working in Figma on file 'Homepage redesign v3'. Design task — expected for this role."
   - Good: "Watching YouTube: 'How to use React Hooks'. Learning content — {'allowed for this role' if youtube_ok else 'off-task for this role'}."
   - Good: "Reading Stack Overflow: 'How to center a div'. Coding reference — relevant for {role}."
   - Bad: "Employee is browsing the web."
   - Bad: "Using Chrome."

Respond ONLY in this exact JSON format (no markdown, no extra text):
{{
  "activity_category": "<coding/email/meetings/browsing/documents/design/communication/idle/other>",
  "app_name": "<exact specific name: Figma, Photoshop, VS Code, YouTube, Gmail, Slack, Zoom, etc.>",
  "window_title": "<exact title from window or screenshot — the file/page/video name>",
  "productivity": "<High/Medium/Low/Idle — relative to this employee's role>",
  "focus_score": <integer 0-100>,
  "time_wasted_pct": <integer 0-100>,
  "notes": "<2-3 specific sentences: what app, what file/page/video, is this expected for their role?>"
}}"""

# ============================================================
# IMAGE FETCH + ANALYSIS
# ============================================================

def fetch_image_bytes(storage_path: str) -> bytes | None:
    try:
        signed = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(storage_path, 3600)
        url = signed.get("signedURL") or signed.get("signedUrl", "")
        if not url:
            log.error(f"No signed URL for {storage_path}")
            return None
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        log.error(f"Image fetch failed [{storage_path}]: {e}")
        return None


def analyze_with_claude(image_bytes: bytes, prompt: str) -> dict | None:
    import json
    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    try:
        response = claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        return json.loads(raw)
    except Exception as e:
        log.error(f"Claude error: {e}")
        return None


def update_screenshot_row(screenshot_id: str, analysis: dict):
    supabase.table("screenshots").update({
        "analyzed": True,
        "activity_category": analysis.get("activity_category"),
        "app_name": analysis.get("app_name"),
        "window_title": analysis.get("window_title"),
        "productivity": analysis.get("productivity"),
        "focus_score": analysis.get("focus_score"),
        "time_wasted_pct": analysis.get("time_wasted_pct"),
        "notes": analysis.get("notes"),
        "analyzed_at": datetime.now(datetime.UTC).isoformat() if hasattr(datetime, 'UTC') else datetime.utcnow().isoformat(),
    }).eq("id", screenshot_id).execute()


def mark_as_skipped(screenshot_id: str):
    supabase.table("screenshots").update({
        "analyzed": True,
        "notes": "skipped (sampled)",
        "analyzed_at": datetime.utcnow().isoformat(),
    }).eq("id", screenshot_id).execute()

# ============================================================
# MAIN RUNNER
# ============================================================

def run(limit: int = 200, today_only: bool = False):
    log.info(f"AI Analyzer v4.0 starting — limit={limit} every_n={ANALYZE_EVERY_N} today_only={today_only}")

    query = (
        supabase.table("screenshots")
        .select("id, employee_id, captured_at, storage_path, process_name, window_title_raw, keyboard_count, mouse_count, activity_level")
        .eq("analyzed", False)
        .order("captured_at")
        .limit(limit)
    )
    if today_only:
        query = query.gte("captured_at", date.today().isoformat())

    rows = query.execute().data
    log.info(f"Found {len(rows)} unanalyzed screenshots")

    if not rows:
        log.info("Nothing to analyze.")
        return

    from collections import defaultdict
    employee_counters: dict[str, int] = defaultdict(int)
    analyzed = skipped = errors = 0

    for row in rows:
        sid = row["id"]
        emp_id = row["employee_id"]
        process_name = row.get("process_name") or ""
        window_title_raw = row.get("window_title_raw") or ""
        keyboard_count = row.get("keyboard_count") or 0
        mouse_count = row.get("mouse_count") or 0
        activity_level = row.get("activity_level") or ""

        employee_counters[emp_id] += 1
        if employee_counters[emp_id] % ANALYZE_EVERY_N != 0:
            mark_as_skipped(sid)
            skipped += 1
            continue

        employee = get_employee(emp_id)
        prompt = build_prompt(employee, process_name, window_title_raw, keyboard_count, mouse_count, activity_level)

        log.info(f"Analyzing [{employee.get('name', emp_id[:8])}] {row['captured_at']} | [{process_name}] {window_title_raw[:60]}")

        image_bytes = fetch_image_bytes(row["storage_path"])
        if not image_bytes:
            errors += 1
            continue

        analysis = analyze_with_claude(image_bytes, prompt)
        if not analysis:
            errors += 1
            continue

        update_screenshot_row(sid, analysis)
        analyzed += 1
        log.info(f"  -> {analysis.get('productivity')} | {analysis.get('app_name')} | {analysis.get('window_title', '')[:50]}")

    log.info(f"Done. analyzed={analyzed} skipped={skipped} errors={errors}")


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Employee AI Analyzer (personalized)")
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--today", action="store_true", help="Only analyze today's screenshots")
    args = parser.parse_args()
    run(limit=args.limit, today_only=args.today)
