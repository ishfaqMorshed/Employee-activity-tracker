"""
Employee Activity Tracker - Central API Server
Deploy on Railway / Render / Fly.io

Endpoints:
  POST /screenshot      - receive screenshot from agent
  GET  /health          - health check
  GET  /employees       - list employees + status
"""

import os
import sys
import base64
import logging
import uuid
import subprocess
import threading
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, Header, HTTPException, Depends, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from supabase import create_client, Client
import uvicorn

# ============================================================
# CONFIG
# ============================================================

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
SERVER_API_KEY = os.environ.get("SERVER_API_KEY", "change-me-in-production")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "ishfakeraz@gmail.com")
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
STORAGE_BUCKET = "screenshots"
REPORT_EVERY_N = int(os.environ.get("REPORT_EVERY_N", "10"))

# In-memory agent control state: {employee_id: "running"|"stopped"}
_agent_control: dict[str, str] = defaultdict(lambda: "running")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ============================================================
# SUPABASE CLIENT
# ============================================================

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(title="Employee Activity Tracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# AUTH
# ============================================================

def verify_employee_api_key(x_api_key: str = Header(...)) -> dict:
    """Verify employee's API key, return employee record"""
    result = supabase.table("employees").select("*").eq("api_key", x_api_key).eq("active", True).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return result.data[0]

def verify_admin_key(x_admin_key: Optional[str] = Header(default=None), key: Optional[str] = Query(default=None)):
    if (x_admin_key or key) != SERVER_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key")

# ============================================================
# MODELS
# ============================================================

class ScreenshotPayload(BaseModel):
    captured_at: str
    image_b64: str
    process_name: str = ""
    window_title_raw: str = ""
    keyboard_count: int = 0
    mouse_count: int = 0
    activity_level: str = ""

class OnboardingProfile(BaseModel):
    name: str
    email: str
    department: str
    role: str
    work_description: str = ""
    expected_apps: List[str] = []
    expected_sites: List[str] = []
    youtube_ok: bool = False
    meeting_pct: int = 20
    edge_cases: str = ""

# ============================================================
# ENDPOINTS
# ============================================================

@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


@app.post("/screenshot")
async def receive_screenshot(
    payload: ScreenshotPayload,
    employee: dict = Depends(verify_employee_api_key)
):
    """
    Receive screenshot from employee agent.
    1. Decode base64 image
    2. Upload to Supabase Storage
    3. Insert metadata row to screenshots table
    """
    employee_id = employee["id"]
    employee_name = employee["name"]

    try:
        # Decode image
        image_bytes = base64.b64decode(payload.image_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    # Storage path: screenshots/{employee_id}/{date}/{timestamp}.jpg
    captured_dt = datetime.fromisoformat(payload.captured_at)
    date_str = captured_dt.strftime("%Y-%m-%d")
    timestamp_str = captured_dt.strftime("%Y%m%d_%H%M%S")
    storage_path = f"{employee_id}/{date_str}/{timestamp_str}.jpg"

    try:
        # Upload to Supabase Storage
        supabase.storage.from_(STORAGE_BUCKET).upload(
            path=storage_path,
            file=image_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
    except Exception as e:
        log.error(f"Storage upload failed for {employee_name}: {e}")
        raise HTTPException(status_code=500, detail="Storage upload failed")

    # Generate signed URL (valid 7 days — AI analyzer uses this)
    try:
        signed = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(storage_path, 604800)
        storage_url = signed.get("signedURL") or signed.get("signedUrl", "")
    except Exception:
        storage_url = ""

    # Insert DB row
    try:
        supabase.table("screenshots").insert({
            "employee_id": employee_id,
            "captured_at": payload.captured_at,
            "storage_path": storage_path,
            "storage_url": storage_url,
            "process_name": payload.process_name or None,
            "window_title_raw": payload.window_title_raw or None,
            "keyboard_count": payload.keyboard_count,
            "mouse_count": payload.mouse_count,
            "activity_level": payload.activity_level or None,
            "analyzed": False,
        }).execute()
    except Exception as e:
        log.error(f"DB insert failed for {employee_name}: {e}")
        raise HTTPException(status_code=500, detail="Database insert failed")

    log.info(f"Screenshot received: {employee_name} @ {payload.captured_at}")

    # Auto-trigger pipeline every REPORT_EVERY_N screenshots
    try:
        today = datetime.utcnow().date().isoformat()
        count_today = len(supabase.table("screenshots").select("id")
                         .eq("employee_id", employee_id)
                         .gte("captured_at", today).execute().data)
        if REPORT_EVERY_N > 0 and count_today % REPORT_EVERY_N == 0:
            log.info(f"Auto-triggering pipeline at {count_today} screenshots for {employee_name}")
            _run_pipeline_async()
    except Exception as e:
        log.warning(f"Pipeline trigger check failed: {e}")

    return {"status": "ok", "path": storage_path}


def _run_pipeline_async():
    base = os.path.dirname(os.path.abspath(__file__))
    env = {**os.environ}

    def run():
        subprocess.run([sys.executable, "ai_analyzer.py", "--today"], cwd=base, env=env)
        subprocess.run([sys.executable, "slack_reporter.py"], cwd=base, env=env)

    threading.Thread(target=run, daemon=True).start()


@app.get("/employees")
def list_employees(_admin=Depends(verify_admin_key)):
    """List all employees with live status"""
    result = supabase.table("employee_status").select("*").execute()
    return result.data


@app.post("/employees/register")
def register_employee(name: str, email: str, slack_user_id: str = "", _admin=Depends(verify_admin_key)):
    """Register new employee, returns their API key"""
    api_key = str(uuid.uuid4())
    result = supabase.table("employees").insert({
        "name": name,
        "email": email,
        "slack_user_id": slack_user_id or None,
        "api_key": api_key,
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to register employee")
    return {"employee": result.data[0], "api_key": api_key}


# ============================================================
# DASHBOARD AUTH + LIVE STATUS ENDPOINTS
# ============================================================

@app.post("/auth/login")
def auth_login(email: str = Body(..., embed=True)):
    """Employee login by email. Returns profile + is_manager flag."""
    result = supabase.table("employees").select(
        "id, name, email, role, department, slack_user_id, api_key, active"
    ).eq("email", email).eq("active", True).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp = result.data[0]
    is_manager = emp["email"].lower() == ADMIN_EMAIL.lower()
    resp = {"employee": emp, "is_manager": is_manager}
    if is_manager:
        resp["admin_key"] = SERVER_API_KEY
    return resp


def _employee_live_status(employee_id: str) -> dict:
    """Shared helper — used by both employee and manager status endpoints."""
    now = datetime.utcnow()
    today = now.date().isoformat()

    last = supabase.table("screenshots").select(
        "captured_at, app_name, window_title_raw, activity_level"
    ).eq("employee_id", employee_id).order("captured_at", desc=True).limit(1).execute()

    today_rows = supabase.table("screenshots").select(
        "productivity, activity_level"
    ).eq("employee_id", employee_id).gte("captured_at", today).execute().data

    total_today = len(today_rows)
    active_mins = sum(1 for r in today_rows if
        r.get("productivity") in ("High", "Medium") or
        (not r.get("productivity") and r.get("activity_level") in ("high", "medium", "low")))

    if not last.data:
        return {"status": "offline", "last_seen": None, "current_app": "",
                "current_window": "", "activity_level": "",
                "screenshots_today": 0, "active_minutes_today": 0}

    ls = last.data[0]
    raw_ts = ls["captured_at"].split("+")[0].replace("Z", "")
    try:
        diff_min = (now - datetime.fromisoformat(raw_ts)).total_seconds() / 60
        status = "active" if diff_min < 3 else ("idle" if diff_min < 30 else "offline")
    except Exception:
        status = "offline"

    return {
        "status": status,
        "last_seen": ls["captured_at"],
        "current_app": ls.get("app_name") or "",
        "current_window": ls.get("window_title_raw") or "",
        "activity_level": ls.get("activity_level") or "",
        "screenshots_today": total_today,
        "active_minutes_today": active_mins,
    }


@app.get("/employee/{employee_id}/status")
def get_employee_status(employee_id: str, employee: dict = Depends(verify_employee_api_key)):
    if employee["id"] != employee_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _employee_live_status(employee_id)


@app.get("/employee/{employee_id}/dashboard")
def get_employee_dashboard(
    employee_id: str,
    date: Optional[str] = Query(default=None),
    employee: dict = Depends(verify_employee_api_key),
):
    if employee["id"] != employee_id:
        raise HTTPException(status_code=403, detail="Access denied")

    report_date = date or datetime.utcnow().date().isoformat()
    next_date = (datetime.fromisoformat(report_date) + timedelta(days=1)).date().isoformat()

    rows = supabase.table("screenshots").select(
        "captured_at, productivity, app_name, focus_score, time_wasted_pct, activity_level"
    ).eq("employee_id", employee_id).gte("captured_at", report_date).lt("captured_at", next_date).execute().data

    analyzed = [r for r in rows if r.get("productivity") and r.get("productivity") != "skipped (sampled)"]

    app_counts: dict = defaultdict(int)
    prod_counts: dict = defaultdict(int)
    hourly: dict = defaultdict(lambda: {"high": 0, "medium": 0, "low": 0, "idle": 0})

    for r in analyzed:
        if r.get("app_name"):
            app_counts[r["app_name"]] += 1
        prod = (r.get("productivity") or "").lower()
        prod_counts[prod] += 1
        try:
            hour = int(r["captured_at"][11:13])
            if prod in hourly[hour]:
                hourly[hour][prod] += 1
        except Exception:
            pass

    focus_vals = [r["focus_score"] for r in analyzed if r.get("focus_score") is not None]
    waste_vals = [r["time_wasted_pct"] for r in analyzed if r.get("time_wasted_pct") is not None]

    score = 0
    if analyzed:
        score = round((
            sum(2 for r in analyzed if r.get("productivity") == "High") +
            sum(1 for r in analyzed if r.get("productivity") == "Medium")
        ) / (len(analyzed) * 2) * 100, 1)

    return {
        "date": report_date,
        "total_screenshots": len(rows),
        "analyzed": len(analyzed),
        "productivity_score": score,
        "active_minutes": sum(1 for r in rows if
            r.get("productivity") in ("High", "Medium") or
            (not r.get("productivity") and r.get("activity_level") in ("high", "medium", "low"))),
        "avg_focus": round(sum(focus_vals) / len(focus_vals)) if focus_vals else 0,
        "avg_waste_pct": round(sum(waste_vals) / len(waste_vals)) if waste_vals else 0,
        "app_breakdown": [{"app": a, "minutes": m} for a, m in
                          sorted(app_counts.items(), key=lambda x: x[1], reverse=True)[:8]],
        "productivity_breakdown": dict(prod_counts),
        "hourly_activity": [{"hour": h, **v} for h, v in sorted(hourly.items())],
    }


@app.get("/manager/team-status")
def get_team_status(_admin=Depends(verify_admin_key)):
    """All employees with live status — manager view."""
    employees = supabase.table("employees").select(
        "id, name, email, role, department, slack_user_id"
    ).eq("active", True).execute().data

    return [{**emp, **_employee_live_status(emp["id"])} for emp in employees]


# ============================================================
# HTML REPORT ENDPOINT
# ============================================================

@app.get("/report/{report_date}", response_class=HTMLResponse)
def html_report(report_date: str, _admin=Depends(verify_admin_key)):
    """Template-based HTML daily report — no AI tokens consumed."""
    from datetime import date, timedelta
    try:
        rd = date.fromisoformat(report_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    next_date = (rd + timedelta(days=1)).isoformat()

    employees = supabase.table("employees").select(
        "id, name, role, department, slack_user_id"
    ).eq("active", True).execute().data

    rows = supabase.table("screenshots").select(
        "employee_id, productivity, app_name, activity_category, focus_score, time_wasted_pct, notes, captured_at"
    ).gte("captured_at", report_date).lt("captured_at", next_date).execute().data

    from collections import defaultdict
    emp_rows: dict[str, list] = defaultdict(list)
    for r in rows:
        if r.get("productivity") and r.get("notes") not in (None, "", "skipped (sampled)"):
            emp_rows[r["employee_id"]].append(r)

    def score(rs):
        if not rs:
            return 0
        return round((
            sum(2 for r in rs if r.get("productivity") == "High") +
            sum(1 for r in rs if r.get("productivity") == "Medium")
        ) / (len(rs) * 2) * 100, 1)

    def bar(pct):
        filled = round(pct / 10)
        return "█" * filled + "░" * (10 - filled)

    def fmt_mins(m):
        h, mn = divmod(int(m), 60)
        return f"{h}h {mn}m" if h else f"{mn}m"

    cards = ""
    for emp in sorted(employees, key=lambda e: score(emp_rows[e["id"]]), reverse=True):
        eid = emp["id"]
        rs = emp_rows[eid]
        sc = score(rs)
        total = len(rows_all := [r for r in rows if r["employee_id"] == eid])
        analyzed = len(rs)
        active = sum(1 for r in rs if r.get("productivity") in ("High", "Medium"))
        focus_vals = [r["focus_score"] for r in rs if r.get("focus_score") is not None]
        avg_focus = round(sum(focus_vals) / len(focus_vals)) if focus_vals else 0
        waste_vals = [r["time_wasted_pct"] for r in rs if r.get("time_wasted_pct") is not None]
        avg_waste = round(sum(waste_vals) / len(waste_vals)) if waste_vals else 0

        app_counts: dict[str, int] = defaultdict(int)
        for r in rs:
            if r.get("app_name"):
                app_counts[r["app_name"]] += 1
        top_apps = sorted(app_counts.items(), key=lambda x: x[1], reverse=True)[:6]

        color = "#22c55e" if sc >= 70 else "#f59e0b" if sc >= 45 else "#ef4444"

        app_rows_html = "".join(
            f'<tr><td>{a}</td><td>{fmt_mins(m)}</td></tr>' for a, m in top_apps
        )

        notes_html = "".join(
            f'<li>{r["notes"]}</li>' for r in rs[-8:][::-1] if r.get("notes")
        )

        cards += f"""
        <div class="card">
          <div class="card-header" style="border-left: 5px solid {color}">
            <div>
              <h2>{emp['name']}</h2>
              <span class="role">{emp.get('role') or 'Employee'} · {emp.get('department') or ''}</span>
            </div>
            <div class="score" style="color:{color}">{sc}%</div>
          </div>
          <div class="metrics">
            <div class="metric"><span class="label">Productivity</span><code>{bar(sc)}</code></div>
            <div class="metric"><span class="label">Active time</span>{fmt_mins(active)}</div>
            <div class="metric"><span class="label">Focus score</span>{avg_focus}/100</div>
            <div class="metric"><span class="label">Time wasted</span>{avg_waste}%</div>
            <div class="metric"><span class="label">Screenshots</span>{total} total · {analyzed} analyzed</div>
          </div>
          {'<table class="apps"><tr><th>App</th><th>Time</th></tr>' + app_rows_html + '</table>' if top_apps else ''}
          {'<div class="notes"><strong>Activity notes (latest):</strong><ul>' + notes_html + '</ul></div>' if notes_html else ''}
        </div>"""

    team_scores = [score(emp_rows[e["id"]]) for e in employees if emp_rows[e["id"]]]
    team_avg = round(sum(team_scores) / len(team_scores), 1) if team_scores else 0
    active_count = sum(1 for e in employees if emp_rows[e["id"]])

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Activity Report — {report_date}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }}
  h1 {{ font-size: 1.6rem; margin-bottom: 4px; }}
  .subtitle {{ color: #94a3b8; margin-bottom: 24px; font-size: 0.9rem; }}
  .summary {{ display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 32px; }}
  .stat {{ background: #1e293b; border-radius: 10px; padding: 16px 24px; min-width: 140px; }}
  .stat .val {{ font-size: 1.8rem; font-weight: 700; }}
  .stat .lbl {{ color: #94a3b8; font-size: 0.8rem; margin-top: 2px; }}
  .card {{ background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px; }}
  .card-header {{ display: flex; justify-content: space-between; align-items: flex-start; padding-left: 12px; margin-bottom: 16px; }}
  .card-header h2 {{ font-size: 1.15rem; margin-bottom: 2px; }}
  .role {{ color: #94a3b8; font-size: 0.82rem; }}
  .score {{ font-size: 2rem; font-weight: 800; }}
  .metrics {{ display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }}
  .metric {{ background: #0f172a; border-radius: 8px; padding: 8px 14px; font-size: 0.84rem; }}
  .metric .label {{ color: #94a3b8; display: block; font-size: 0.75rem; margin-bottom: 2px; }}
  code {{ font-family: monospace; letter-spacing: 1px; color: #38bdf8; }}
  table.apps {{ width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 0.84rem; }}
  table.apps th {{ text-align: left; color: #94a3b8; padding: 4px 8px; border-bottom: 1px solid #334155; }}
  table.apps td {{ padding: 4px 8px; border-bottom: 1px solid #1e293b; }}
  .notes {{ font-size: 0.82rem; color: #cbd5e1; }}
  .notes ul {{ padding-left: 16px; margin-top: 6px; }}
  .notes li {{ margin-bottom: 4px; line-height: 1.5; }}
</style>
</head>
<body>
<h1>📊 Activity Report — {rd.strftime('%B %d, %Y')}</h1>
<p class="subtitle">Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} · Employee Activity Tracker</p>
<div class="summary">
  <div class="stat"><div class="val">{team_avg}%</div><div class="lbl">Team Avg Productivity</div></div>
  <div class="stat"><div class="val">{active_count}/{len(employees)}</div><div class="lbl">Employees Active</div></div>
  <div class="stat"><div class="val">{len(rows)}</div><div class="lbl">Total Screenshots</div></div>
</div>
{cards}
</body>
</html>"""
    return html


# ============================================================
# ONBOARDING
# ============================================================

@app.post("/employees/onboard")
def onboard_employee(profile: OnboardingProfile):
    """Create new employee with full profile. Returns credentials."""
    # Check duplicate email
    existing = supabase.table("employees").select("id").eq("email", profile.email).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="Email already registered")

    employee_id = str(uuid.uuid4())
    api_key = str(uuid.uuid4()).replace("-", "")

    row = {
        "id": employee_id,
        "name": profile.name,
        "email": profile.email,
        "api_key": api_key,
        "active": True,
        "department": profile.department,
        "role": profile.role,
        "work_description": profile.work_description,
        "expected_apps": profile.expected_apps,
        "expected_sites": profile.expected_sites,
        "youtube_ok": profile.youtube_ok,
        "meeting_pct": profile.meeting_pct,
        "edge_cases": profile.edge_cases,
    }

    # Best-effort Slack user lookup
    if SLACK_BOT_TOKEN:
        try:
            import requests as _req
            r = _req.get("https://slack.com/api/users.lookupByEmail",
                         params={"email": profile.email},
                         headers={"Authorization": f"Bearer {SLACK_BOT_TOKEN}"}, timeout=5)
            data = r.json()
            if data.get("ok"):
                row["slack_user_id"] = data["user"]["id"]
        except Exception:
            pass

    supabase.table("employees").insert(row).execute()
    log.info(f"Onboarded: {profile.name} ({profile.email})")
    return {"employee_id": employee_id, "api_key": api_key, "name": profile.name, "email": profile.email}


@app.get("/auth/whoami")
def whoami(employee: dict = Depends(verify_employee_api_key)):
    """Return employee profile from api_key. Used by desktop app on startup."""
    return {
        "employee_id": employee["id"],
        "name": employee["name"],
        "email": employee["email"],
        "role": employee.get("role", ""),
    }


# ============================================================
# AGENT CONTROL (Phase 5)
# ============================================================

@app.get("/agent/{employee_id}/control")
def get_agent_control(
    employee_id: str,
    x_api_key: Optional[str] = Header(default=None),
    x_admin_key: Optional[str] = Header(default=None),
    key: Optional[str] = Query(default=None),
):
    # Accept either employee's own api_key OR admin key
    if (x_admin_key or key) == SERVER_API_KEY:
        pass  # manager access allowed
    elif x_api_key:
        result = supabase.table("employees").select("id").eq("api_key", x_api_key).eq("active", True).execute()
        if not result.data or result.data[0]["id"] != employee_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")
    return {"status": _agent_control[employee_id], "employee_id": employee_id}


@app.put("/agent/{employee_id}/control")
def set_agent_control(
    employee_id: str,
    status: str = Body(..., embed=True),
    _admin=Depends(verify_admin_key),
):
    if status not in ("running", "stopped"):
        raise HTTPException(status_code=400, detail="status must be 'running' or 'stopped'")
    _agent_control[employee_id] = status
    log.info(f"Agent control: {employee_id} → {status}")
    return {"status": status, "employee_id": employee_id}


@app.post("/admin/analyze-now")
def trigger_analysis(
    target_date: Optional[str] = Body(default=None, embed=True),
    _admin=Depends(verify_admin_key),
):
    """Manually trigger AI analysis + Slack report. Called from AdminDashboard."""
    date_str = target_date or datetime.utcnow().date().isoformat()
    _run_pipeline_async()
    log.info(f"Manual pipeline trigger for {date_str}")
    return {"status": "triggered", "date": date_str}


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api_server:app", host="0.0.0.0", port=port)
