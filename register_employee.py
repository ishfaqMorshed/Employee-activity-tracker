"""
Employee Activity Tracker - Employee Registration CLI
Version: 1.0.0

Run this for each new employee. Walks through 10-question questionnaire,
registers employee in Supabase, and looks up their Slack user ID.

Usage:
  python register_employee.py
  python register_employee.py --update john@company.com   # update existing
"""

import os
import sys
import json
import argparse
import requests
from supabase import create_client, Client

# ============================================================
# CONFIG
# ============================================================

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ============================================================
# SLACK LOOKUP
# ============================================================

def lookup_slack_user_id(email: str) -> str:
    """Look up Slack user ID by email using bot token."""
    if not SLACK_BOT_TOKEN:
        return ""
    try:
        resp = requests.get(
            "https://slack.com/api/users.lookupByEmail",
            headers={"Authorization": f"Bearer {SLACK_BOT_TOKEN}"},
            params={"email": email},
            timeout=10,
        )
        data = resp.json()
        if data.get("ok"):
            uid = data["user"]["id"]
            print(f"  Slack user ID found: {uid}")
            return uid
        else:
            print(f"  Slack lookup failed: {data.get('error', 'unknown')} — skipping")
            return ""
    except Exception as e:
        print(f"  Slack lookup error: {e} — skipping")
        return ""


# ============================================================
# QUESTIONNAIRE
# ============================================================

def ask(prompt: str, required: bool = True) -> str:
    while True:
        val = input(f"  {prompt}: ").strip()
        if val or not required:
            return val
        print("  (required — please answer)")


def ask_list(prompt: str, count: int = 5) -> list[str]:
    print(f"  {prompt}")
    items = []
    for i in range(1, count + 1):
        val = input(f"    {i}. ").strip()
        if val:
            items.append(val)
    return items


def ask_yn(prompt: str) -> bool:
    while True:
        val = input(f"  {prompt} (y/n): ").strip().lower()
        if val in ("y", "yes"):
            return True
        if val in ("n", "no"):
            return False
        print("  Enter y or n")


def run_questionnaire() -> dict:
    print()
    print("=" * 60)
    print("EMPLOYEE ONBOARDING QUESTIONNAIRE")
    print("=" * 60)
    print()

    print("--- BASIC INFO ---")
    name = ask("1. Full name")
    email = ask("2. Work email")
    role = ask("3. Job title / role  (e.g. 'Senior Graphic Designer')")
    department = ask("4. Department / team  (e.g. Marketing, Engineering)")
    print()

    print("--- DAILY TOOLS ---")
    print("5. Top 5 software/apps you use for work daily:")
    print("   (e.g. Photoshop, Figma, VS Code, Excel, Zoom)")
    expected_apps = ask_list("", count=5)
    print()

    print("6. Work-related websites you visit regularly:")
    print("   (e.g. github.com, dribbble.com, salesforce.com)")
    expected_sites = ask_list("", count=5)
    print()

    print("--- WORK PATTERNS ---")
    work_description = ask(
        "7. Describe a typical productive day in 1-2 sentences\n     "
    )
    print()

    youtube_ok = ask_yn("8. Do you watch YouTube for work? (tutorials, references, demos?)")
    youtube_topics = ""
    if youtube_ok:
        youtube_topics = ask("   What topics/channels?", required=False)
    print()

    while True:
        try:
            meeting_pct = int(ask("9. What % of your day is typically in meetings? (0-100)"))
            if 0 <= meeting_pct <= 100:
                break
        except ValueError:
            pass
        print("  Enter a number 0-100")
    print()

    ok_activities = ask(
        "10. Any activities that look unproductive but are work-related?\n"
        "    (e.g. browsing Behance for design inspiration, Reddit for tech news)\n"
        "    Leave blank if none\n     ",
        required=False,
    )
    print()

    if work_description and ok_activities:
        full_description = f"{work_description} Note: {ok_activities}"
    elif ok_activities:
        full_description = ok_activities
    else:
        full_description = work_description

    if youtube_ok and youtube_topics:
        full_description += f" YouTube allowed for work (topics: {youtube_topics})."

    return {
        "name": name,
        "email": email,
        "role": role,
        "department": department,
        "work_description": full_description,
        "expected_apps": expected_apps,
        "expected_sites": [s for s in expected_sites if s],
        "youtube_ok": youtube_ok,
        "meeting_pct": meeting_pct,
    }


# ============================================================
# REGISTER / UPDATE
# ============================================================

def register_employee(data: dict) -> dict:
    """Insert new employee, return full record including api_key."""
    import uuid
    api_key = str(uuid.uuid4()).replace("-", "")

    slack_user_id = lookup_slack_user_id(data["email"])

    result = supabase.table("employees").insert({
        "name": data["name"],
        "email": data["email"],
        "api_key": api_key,
        "slack_user_id": slack_user_id or None,
        "role": data["role"],
        "department": data["department"],
        "work_description": data["work_description"],
        "expected_apps": data["expected_apps"],
        "expected_sites": data["expected_sites"],
        "youtube_ok": data["youtube_ok"],
        "meeting_pct": data["meeting_pct"],
    }).execute()

    if not result.data:
        raise RuntimeError("DB insert failed")
    return result.data[0]


def update_employee_profile(email: str, data: dict):
    """Update profile fields for existing employee."""
    slack_user_id = lookup_slack_user_id(email)
    update = {
        "role": data["role"],
        "department": data["department"],
        "work_description": data["work_description"],
        "expected_apps": data["expected_apps"],
        "expected_sites": data["expected_sites"],
        "youtube_ok": data["youtube_ok"],
        "meeting_pct": data["meeting_pct"],
    }
    if slack_user_id:
        update["slack_user_id"] = slack_user_id

    supabase.table("employees").update(update).eq("email", email).execute()
    print(f"Profile updated for {email}")


# ============================================================
# CONFIG FILE OUTPUT
# ============================================================

def save_agent_config(employee: dict, server_url: str):
    """Print config.json content to copy to employee PC."""
    config = {
        "username": employee["name"],
        "email": employee["email"],
        "server_url": server_url,
        "api_key": employee["api_key"],
        "version": "3.0.0",
        "screenshot_interval": 60,
        "compression_quality": 60,
        "max_retries": 3,
        "retry_delay": 10,
    }
    print()
    print("=" * 60)
    print("AGENT CONFIG — copy this to employee's PC:")
    print(f"  Path: C:\\ProgramData\\ScreenshotAgent\\config.json")
    print("=" * 60)
    print(json.dumps(config, indent=2))
    print("=" * 60)

    # Also save locally
    fname = f"config_{employee['name'].lower().replace(' ', '_')}.json"
    with open(fname, "w") as f:
        json.dump(config, f, indent=2)
    print(f"Saved locally as: {fname}")


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Employee registration CLI")
    parser.add_argument("--update", type=str, default=None, help="Update profile for existing employee (email)")
    parser.add_argument("--server-url", type=str, default="http://localhost:8000", help="API server URL")
    args = parser.parse_args()

    if args.update:
        # Update mode: just update profile for existing employee
        existing = supabase.table("employees").select("*").eq("email", args.update).execute()
        if not existing.data:
            print(f"No employee found with email: {args.update}")
            sys.exit(1)
        print(f"Updating profile for: {existing.data[0]['name']}")
        data = run_questionnaire()
        update_employee_profile(args.update, data)
        return

    # Registration mode
    data = run_questionnaire()

    # Check if already exists
    existing = supabase.table("employees").select("id,email").eq("email", data["email"]).execute()
    if existing.data:
        print(f"\nEmployee {data['email']} already exists. Updating profile instead...")
        update_employee_profile(data["email"], data)
        emp = supabase.table("employees").select("*").eq("email", data["email"]).execute().data[0]
    else:
        emp = register_employee(data)
        print(f"\nEmployee registered: {emp['name']} (id: {emp['id']})")
        print(f"API key: {emp['api_key']}")

    save_agent_config(emp, args.server_url)
    print("\nDone. Give the employee their config.json to place in C:\\ProgramData\\ScreenshotAgent\\")


if __name__ == "__main__":
    main()
