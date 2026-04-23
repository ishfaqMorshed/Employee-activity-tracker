"""
Employee Activity Tracker - Slack Reporter
Version: 2.0.0 (Personalized — app breakdown + Claude narrative)

Generates daily report per employee with:
- Time breakdown by exact app
- Claude-written narrative summary (specific, not generic)
- Role-relative productivity scoring
- @mention via slack_user_id

Usage:
  python slack_reporter.py              # report for today
  python slack_reporter.py --date 2026-04-20
  python slack_reporter.py --test
"""

import os
import sys
import logging
import argparse
from datetime import date, datetime, timedelta
from collections import defaultdict

import requests
import anthropic
from supabase import create_client, Client

# ============================================================
# CONFIG
# ============================================================

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
SLACK_WEBHOOK_URL = os.environ["SLACK_WEBHOOK_URL"]
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
SERVER_URL = os.environ.get("SERVER_URL", "http://localhost:8000")
SERVER_API_KEY = os.environ.get("SERVER_API_KEY", "")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

# ============================================================
# DATA AGGREGATION
# ============================================================

def get_employee_stats(employee: dict, report_date: date) -> dict:
    date_str = report_date.isoformat()
    next_date_str = (report_date + timedelta(days=1)).isoformat()

    result = (
        supabase.table("screenshots")
        .select("captured_at, analyzed, productivity, activity_category, app_name, focus_score, time_wasted_pct, notes, window_title")
        .eq("employee_id", employee["id"])
        .gte("captured_at", date_str)
        .lt("captured_at", next_date_str)
        .execute()
    )
    rows = result.data
    total = len(rows)

    analyzed_rows = [
        r for r in rows
        if r.get("analyzed") and r.get("productivity") not in (None, "", "skipped (sampled)")
        and r.get("notes") != "skipped (sampled)"
    ]

    if total == 0:
        return {
            "total_screenshots": 0,
            "active_minutes": 0,
            "idle_minutes": 0,
            "offline_minutes": 480,
            "productivity_score": 0,
            "avg_focus": 0,
            "avg_waste_pct": 0,
            "top_app": "N/A",
            "top_category": "N/A",
            "app_breakdown": {},
            "productivity_breakdown": {},
            "productivity_pct": 0,
            "notes_sample": [],
            "narrative": "",
        }

    # Minutes per app (each screenshot ≈ 1 minute)
    app_counts: dict[str, int] = defaultdict(int)
    cat_counts: dict[str, int] = defaultdict(int)
    prod_breakdown: dict[str, int] = defaultdict(int)
    notes_sample = []

    for r in analyzed_rows:
        app = r.get("app_name") or "Unknown"
        cat = r.get("activity_category") or "other"
        prod = r.get("productivity") or "Unknown"
        app_counts[app] += 1
        cat_counts[cat] += 1
        prod_breakdown[prod] += 1
        if r.get("notes") and r["notes"] not in ("skipped (sampled)",) and len(notes_sample) < 15:
            notes_sample.append(r["notes"])

    active = sum(1 for r in analyzed_rows if r.get("productivity") in ("High", "Medium"))
    idle = sum(1 for r in analyzed_rows if r.get("productivity") == "Idle")

    focus_scores = [r["focus_score"] for r in analyzed_rows if r.get("focus_score") is not None]
    waste_pcts = [r["time_wasted_pct"] for r in analyzed_rows if r.get("time_wasted_pct") is not None]
    avg_focus = round(sum(focus_scores) / len(focus_scores)) if focus_scores else 0
    avg_waste = round(sum(waste_pcts) / len(waste_pcts)) if waste_pcts else 0

    if analyzed_rows:
        score = (
            sum(2 for r in analyzed_rows if r.get("productivity") == "High") +
            sum(1 for r in analyzed_rows if r.get("productivity") == "Medium")
        ) / (len(analyzed_rows) * 2) * 100
    else:
        score = 0

    top_app = max(app_counts, key=app_counts.get) if app_counts else "N/A"
    top_cat = max(cat_counts, key=cat_counts.get) if cat_counts else "N/A"

    return {
        "total_screenshots": total,
        "active_minutes": active,
        "idle_minutes": idle,
        "offline_minutes": max(0, 480 - total),
        "productivity_score": round(score, 1),
        "avg_focus": avg_focus,
        "avg_waste_pct": avg_waste,
        "top_app": top_app,
        "top_category": top_cat,
        "app_breakdown": dict(sorted(app_counts.items(), key=lambda x: x[1], reverse=True)),
        "productivity_breakdown": dict(prod_breakdown),
        "productivity_pct": round((active / total) * 100) if total else 0,
        "notes_sample": notes_sample,
        "narrative": "",  # filled below
    }


def get_all_employees() -> list[dict]:
    result = supabase.table("employees").select("*").eq("active", True).execute()
    return result.data

# ============================================================
# CLAUDE NARRATIVE GENERATOR
# ============================================================

def generate_narrative(employee: dict, stats: dict) -> str:
    """Ask Claude to write a specific 2-3 sentence daily summary."""
    if not claude or not stats["notes_sample"]:
        return ""

    role = employee.get("role") or "Employee"
    app_breakdown_str = ", ".join(
        f"{app} ({mins}m)" for app, mins in list(stats["app_breakdown"].items())[:6]
    )
    notes_str = "\n".join(f"- {n}" for n in stats["notes_sample"][:10])

    prompt = f"""Write a 2-3 sentence factual daily work summary for {employee['name']} ({role}).

App time today: {app_breakdown_str}
Sample activity notes:
{notes_str}

Rules:
- Be specific: mention exact app names, file types, website names, video titles
- State whether activities are relevant to their role ({role})
- No fluff, no "it appears that", no hedging
- Example: "John spent 3h in Figma working on UI screens and 1h in Photoshop. He also reviewed design references on Dribbble (15m). All activity was relevant to his role as a designer."

Write only the summary paragraph, nothing else."""

    try:
        resp = claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()
    except Exception as e:
        log.error(f"Narrative generation failed: {e}")
        return ""

# ============================================================
# SLACK MESSAGE BUILDERS
# ============================================================

APP_EMOJI = {
    "figma": ":art:",
    "photoshop": ":art:",
    "illustrator": ":art:",
    "vs code": ":computer:",
    "visual studio code": ":computer:",
    "pycharm": ":computer:",
    "zoom": ":busts_in_silhouette:",
    "teams": ":busts_in_silhouette:",
    "slack": ":speech_balloon:",
    "gmail": ":email:",
    "outlook": ":email:",
    "excel": ":bar_chart:",
    "youtube": ":tv:",
    "chrome": ":globe_with_meridians:",
    "firefox": ":globe_with_meridians:",
    "supabase": ":floppy_disk:",
    "coding": ":computer:",
}

_avatar_cache: dict[str, str] = {}

def get_slack_avatar(slack_user_id: str, name: str) -> str:
    if not slack_user_id or not SLACK_BOT_TOKEN:
        return f"https://api.dicebear.com/7.x/initials/png?seed={name}&size=192"
    if slack_user_id in _avatar_cache:
        return _avatar_cache[slack_user_id]
    try:
        resp = requests.get(
            "https://slack.com/api/users.info",
            headers={"Authorization": f"Bearer {SLACK_BOT_TOKEN}"},
            params={"user": slack_user_id},
            timeout=10,
        )
        data = resp.json()
        if data.get("ok"):
            url = data["user"]["profile"].get("image_192") or data["user"]["profile"].get("image_72", "")
            if url:
                _avatar_cache[slack_user_id] = url
                return url
    except Exception as e:
        log.warning(f"Avatar fetch failed for {slack_user_id}: {e}")
    fallback = f"https://api.dicebear.com/7.x/initials/png?seed={name}&size=192"
    _avatar_cache[slack_user_id] = fallback
    return fallback


def get_app_emoji(app_name: str) -> str:
    lower = app_name.lower()
    for key, emoji in APP_EMOJI.items():
        if key in lower:
            return emoji
    return ":desktop_computer:"


def format_minutes(total_mins: int) -> str:
    h, m = divmod(int(total_mins), 60)
    return f"{h}h {m}m" if h else f"{m}m"


def format_app_breakdown(app_breakdown: dict, max_apps: int = 5) -> str:
    lines = []
    for app, mins in list(app_breakdown.items())[:max_apps]:
        emoji = get_app_emoji(app)
        lines.append(f"{emoji} {app}: {format_minutes(mins)}")
    return "\n".join(lines)


def prod_label(score: float) -> str:
    if score >= 70:
        return "High"
    if score >= 50:
        return "Medium"
    if score >= 30:
        return "Low"
    return "Critical"


def generate_action_items(team_avg: float, active_count: int, total_count: int, employees_stats: list) -> list[str]:
    items = []
    pct_active = round(active_count / total_count * 100) if total_count else 0

    if pct_active < 50:
        items.append(f":red_circle: Only {active_count}/{total_count} employees active")
    if team_avg < 50:
        items.append(f":red_circle: Low productivity ({team_avg}%)")

    offline_heavy = [emp.get("name") for emp, s in employees_stats if s["offline_minutes"] > 240 and s["total_screenshots"] > 0]
    if offline_heavy:
        items.append(f":large_yellow_circle: High offline time: {', '.join(offline_heavy[:3])}")

    low_focus = [emp.get("name") for emp, s in employees_stats if s["avg_focus"] < 40 and s["total_screenshots"] > 0]
    if low_focus:
        items.append(f":large_yellow_circle: Low focus scores: {', '.join(low_focus[:3])}")

    if not items:
        items.append(":large_green_circle: All metrics look healthy today")

    return items


def build_employee_detail_block(employee: dict, stats: dict) -> list[dict]:
    name = employee.get("name", "Unknown")
    role = employee.get("role") or "Employee"
    slack_uid = employee.get("slack_user_id")
    mention = f"<@{slack_uid}>" if slack_uid else f"*{name}*"

    score = stats["productivity_score"]
    waste = stats["avg_waste_pct"]
    total_ss = stats["total_screenshots"]
    active_min = stats["active_minutes"]
    narrative = stats.get("narrative", "")
    app_breakdown = stats["app_breakdown"]

    prod_bar_filled = round(score / 10)
    prod_bar = "█" * prod_bar_filled + "░" * (10 - prod_bar_filled)
    prod_emoji = "🟢" if score >= 70 else "🟡" if score >= 45 else "🔴"

    avatar_url = get_slack_avatar(slack_uid or "", name)

    # Top app lines
    app_lines = ""
    for app, mins in list(app_breakdown.items())[:5]:
        emoji = get_app_emoji(app)
        app_lines += f"\n    {emoji} {app} — {format_minutes(mins)}"

    header_text = (
        f"{mention}  ·  _{role}_\n"
        f"{prod_emoji} *{score}%* productivity  `{prod_bar}`\n"
        f"⏱ Active: *{format_minutes(active_min)}*  |  📸 {total_ss} screenshots  |  🗑 {waste}% wasted"
    )
    if app_lines:
        header_text += f"\n*Top apps:*{app_lines}"
    if narrative:
        header_text += f"\n\n_{narrative}_"

    blocks = [
        {"type": "divider"},
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": header_text},
            "accessory": {
                "type": "image",
                "image_url": avatar_url,
                "alt_text": name,
            },
        },
    ]
    return blocks


def build_daily_report(report_date: date, employees_stats: list[tuple[dict, dict]]) -> list[dict]:
    date_str = report_date.strftime("%B %d, %Y")
    sorted_stats = sorted(employees_stats, key=lambda x: x[1]["productivity_score"], reverse=True)

    team_scores = [s["productivity_score"] for _, s in sorted_stats if s["total_screenshots"] > 0]
    team_avg = round(sum(team_scores) / len(team_scores), 1) if team_scores else 0
    active_today = sum(1 for _, s in sorted_stats if s["total_screenshots"] > 0)
    total_employees = len(sorted_stats)
    total_screenshots = sum(s["total_screenshots"] for _, s in sorted_stats)
    total_active_mins = sum(s["active_minutes"] for _, s in sorted_stats)
    pct_active = round(active_today / total_employees * 100) if total_employees else 0

    prod_status = prod_label(team_avg)
    prod_emoji = "🟢" if team_avg >= 70 else "⚠️" if team_avg >= 40 else "🔴"
    active_emoji = "🟢" if pct_active >= 70 else "🟡" if pct_active >= 40 else "🔴"

    # ── SUMMARY CARD ──────────────────────────────────────────
    blocks: list[dict] = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"📊 Daily Activity Report - {date_str}"},
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Team Status*\n{active_emoji} {active_today}/{total_employees} Active ({pct_active}%)"},
                {"type": "mrkdwn", "text": f"*Avg Productivity*\n{prod_emoji} {team_avg}% ({prod_status})"},
                {"type": "mrkdwn", "text": f"*Total Hours*\n⏱️ {format_minutes(total_active_mins)}"},
                {"type": "mrkdwn", "text": f"*Screenshots*\n📸 {total_screenshots} analyzed"},
            ],
        },
        {"type": "divider"},
    ]

    # ── TOP PERFORMER ─────────────────────────────────────────
    if sorted_stats and sorted_stats[0][1]["total_screenshots"] > 0:
        top_emp, top_stats = sorted_stats[0]
        top_name = top_emp.get("name", "Unknown")
        top_cat = top_stats.get("top_category") or top_stats.get("top_app") or "N/A"
        avatar_url = f"https://api.dicebear.com/7.x/initials/png?seed={top_name}&size=64"

        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f"*🏆 Top Performer: {top_name}*\n"
                    f"• Productivity: {top_stats['productivity_score']}%\n"
                    f"• Focus Score: {top_stats['avg_focus']}/100\n"
                    f"• Top Activity: {top_cat.title()}\n"
                    f"• Work Time: {format_minutes(top_stats['active_minutes'])}"
                ),
            },
            "accessory": {
                "type": "image",
                "image_url": avatar_url,
                "alt_text": top_name,
            },
        })

    # ── ACTION ITEMS ──────────────────────────────────────────
    action_items = generate_action_items(team_avg, active_today, total_employees, sorted_stats)
    blocks.append({
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": "*💡 Action Items*\n" + "\n".join(action_items),
        },
    })

    # ── PER-EMPLOYEE DETAILS ───────────────────────────────────
    blocks.append({"type": "divider"})
    blocks.append({
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*👥 Employee Breakdown*"},
    })

    for employee, stats in sorted_stats:
        if stats["total_screenshots"] == 0:
            slack_uid = employee.get("slack_user_id")
            mention = f"<@{slack_uid}>" if slack_uid else f"*{employee.get('name', 'Unknown')}*"
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"{mention} — :black_circle: No activity recorded"},
            })
        else:
            blocks.extend(build_employee_detail_block(employee, stats))

    # ── BUTTONS ───────────────────────────────────────────────
    report_url = f"{SERVER_URL}/report/{report_date.isoformat()}?key={SERVER_API_KEY}"
    blocks.append({
        "type": "actions",
        "elements": [
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "📊 View Full Report"},
                "url": report_url,
                "style": "primary",
            },
        ],
    })

    # ── FOOTER ────────────────────────────────────────────────
    blocks.append({
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": f"Generated at {datetime.now().strftime('%I:%M %p')} | Employee Activity Tracker v2.0"}],
    })

    return blocks

# ============================================================
# SLACK SEND
# ============================================================

def post_to_slack(blocks: list[dict], text: str = "Daily Activity Report") -> bool:
    payload = {"text": text, "blocks": blocks}
    try:
        resp = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=15)
        if resp.status_code == 200 and resp.text == "ok":
            log.info("Slack message posted successfully")
            return True
        log.error(f"Slack post failed: {resp.status_code} {resp.text}")
        return False
    except Exception as e:
        log.error(f"Slack post error: {e}")
        return False


def save_daily_summaries(report_date: date, employees_stats: list[tuple]):
    for employee, stats in employees_stats:
        emp_id = employee["id"]
        try:
            supabase.table("daily_summaries").upsert({
                "employee_id": emp_id,
                "summary_date": report_date.isoformat(),
                "total_screenshots": stats["total_screenshots"],
                "analyzed_screenshots": stats["total_screenshots"],
                "active_minutes": stats["active_minutes"],
                "idle_minutes": stats["idle_minutes"],
                "offline_minutes": stats["offline_minutes"],
                "productivity_score": stats["productivity_score"],
                "top_app": stats["top_app"],
                "top_category": stats["top_category"],
                "time_wasted_minutes": round(stats["avg_waste_pct"] / 100 * stats["active_minutes"]),
                "slack_posted": True,
            }, on_conflict="employee_id,summary_date").execute()
        except Exception as e:
            log.error(f"Failed to save summary for {employee.get('name')}: {e}")

# ============================================================
# MAIN
# ============================================================

def run(report_date: date):
    log.info(f"Generating report for {report_date}")

    employees = get_all_employees()
    if not employees:
        log.warning("No active employees found")
        return

    employees_stats = []
    for emp in employees:
        stats = get_employee_stats(emp, report_date)

        # Generate Claude narrative (specific summary)
        if stats["total_screenshots"] > 0 and claude:
            log.info(f"  Generating narrative for {emp['name']}...")
            stats["narrative"] = generate_narrative(emp, stats)

        employees_stats.append((emp, stats))
        log.info(f"  {emp['name']}: score={stats['productivity_score']}% screenshots={stats['total_screenshots']} top_app={stats['top_app']}")

    blocks = build_daily_report(report_date, employees_stats)
    success = post_to_slack(blocks, text=f"Daily Activity Report — {report_date}")

    if success:
        save_daily_summaries(report_date, employees_stats)
        log.info("Summaries saved to DB")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Slack daily reporter v2.0")
    parser.add_argument("--date", type=str, default=None)
    parser.add_argument("--test", action="store_true")
    args = parser.parse_args()

    if args.test:
        ok = post_to_slack(
            blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": ":white_check_mark: Slack reporter v2.0 connected!"}}],
            text="Test",
        )
        sys.exit(0 if ok else 1)

    report_date = date.fromisoformat(args.date) if args.date else date.today()
    run(report_date)
