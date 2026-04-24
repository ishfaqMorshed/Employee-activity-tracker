# Employee Activity Tracker - System Update Guide

**Version:** v3.1.0 → v4.0.0  
**Backend:** https://employee-activity-tracker-production-ff6f.up.railway.app  
**Purpose:** Role-based employee monitoring with real-time tracking

---

## CURRENT STATE (What Exists)

### Backend (Railway - DEPLOYED)
- ✅ FastAPI server running on Railway
- ✅ Supabase database connected
- ✅ Endpoints: /health, /screenshot, /employees
- ✅ CORS enabled
- ✅ Screenshot storage to Supabase

### Database (Supabase)
```sql
employees table:
- id, name, email, api_key, slack_user_id, active, created_at

screenshots table:
- employee_id, captured_at, storage_path, storage_url
- process_name, window_title_raw
- analyzed, productivity, focus_score, notes
```

### Desktop Agent
- ✅ screenshot_agent_GUI.py with tkinter interface
- ✅ Captures screenshots every 60s
- ✅ Shows "Open Setup" button
- ⚠️ Currently opens browser to Vercel login (WRONG)

### AI Analyzer
- ✅ ai_analyzer.py exists with Claude API integration
- ⚠️ Not scheduled, runs manually only

### Slack Reporter
- ✅ slack_reporter.py generates reports
- ⚠️ Not automated

---

## WHAT'S MISSING/BROKEN

❌ No web-based onboarding flow  
❌ Agent doesn't auto-sync after onboarding  
❌ No employee profile data (role, expected_apps)  
❌ No real-time tracking dashboard  
❌ No employee dashboard (separate from admin)  
❌ No admin dashboard  
❌ No authentication system  
❌ No manual AI analysis trigger  
❌ No activity tracking (keyboard/mouse counts)  
❌ Dashboard shows all zeros (no real data display)

---

## REQUIRED UPDATES

### UPDATE 1: Database Schema - Add Missing Columns

**File:** `migrations/add_profile_and_activity.sql`

```sql
-- Add profile columns to employees
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS role TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS work_description TEXT,
ADD COLUMN IF NOT EXISTS expected_apps TEXT[],
ADD COLUMN IF NOT EXISTS expected_sites TEXT[],
ADD COLUMN IF NOT EXISTS youtube_ok BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS meeting_pct INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add activity columns to screenshots
ALTER TABLE screenshots
ADD COLUMN IF NOT EXISTS keyboard_count INTEGER,
ADD COLUMN IF NOT EXISTS mouse_count INTEGER,
ADD COLUMN IF NOT EXISTS activity_level TEXT,
ADD COLUMN IF NOT EXISTS app_name TEXT,
ADD COLUMN IF NOT EXISTS window_title TEXT;

-- Create admin table
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default admin (password: admin123 - change after first login)
INSERT INTO admins (username, password_hash) 
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5ux8F9Kq/f7S2')
ON CONFLICT DO NOTHING;

-- Create device_registration table for onboarding flow
CREATE TABLE IF NOT EXISTS device_registrations (
  device_id TEXT PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  registered BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Run this in Supabase SQL Editor.

---

### UPDATE 2: Agent Flow - Browser Onboarding

**File:** `screenshot_agent_GUI.py`

**Changes:**

1. When "Open Setup" clicked:
```python
def open_setup():
    device_id = get_device_id()  # Generate unique ID from MAC address
    url = f"https://YOUR-FRONTEND.vercel.app/onboard?device={device_id}"
    webbrowser.open(url)
    
    # Start polling for registration
    self.check_registration_thread = threading.Thread(
        target=self.poll_registration, 
        args=(device_id,),
        daemon=True
    )
    self.check_registration_thread.start()

def poll_registration(device_id):
    """Check every 5s if onboarding complete"""
    while True:
        try:
            response = requests.get(
                f"{SERVER_URL}/agent/registration-status",
                params={"device_id": device_id}
            )
            if response.status_code == 200:
                data = response.json()
                if data['registered']:
                    # Save credentials
                    save_config({
                        'employee_id': data['employee_id'],
                        'api_key': data['api_key'],
                        'device_id': device_id
                    })
                    # Update UI
                    self.show_synced_status()
                    break
        except:
            pass
        time.sleep(5)

def get_device_id():
    """Generate unique device ID from MAC address"""
    import uuid
    mac = ':'.join(['{:02x}'.format((uuid.getnode() >> i) & 0xff) 
                    for i in range(0,8*6,8)][::-1])
    return hashlib.md5(mac.encode()).hexdigest()[:16]
```

2. Update screenshot upload to include activity data:
```python
payload = {
    "employee_id": self.employee_id,
    "timestamp": datetime.now().isoformat(),
    "screenshot": base64_screenshot,
    "process_name": process_name,
    "window_title_raw": window_title,
    "keyboard_count": self.keyboard_count,  # ADD
    "mouse_count": self.mouse_count,        # ADD
    "activity_level": self.calculate_activity_level()  # ADD
}
```

3. Add activity tracking:
```python
from pynput import keyboard, mouse

def __init__(self):
    self.keyboard_count = 0
    self.mouse_count = 0
    self.start_activity_listeners()

def start_activity_listeners(self):
    keyboard.Listener(on_press=lambda k: self.on_key()).start()
    mouse.Listener(on_click=lambda x,y,b,p: self.on_click()).start()

def on_key(self):
    self.keyboard_count += 1

def on_click(self):
    self.mouse_count += 1

def calculate_activity_level(self):
    if self.keyboard_count > 100 or self.mouse_count > 20:
        return "high"
    elif self.keyboard_count > 30 or self.mouse_count > 10:
        return "medium"
    elif self.keyboard_count > 5 or self.mouse_count > 2:
        return "low"
    return "idle"

def reset_activity_counters(self):
    self.keyboard_count = 0
    self.mouse_count = 0
```

---

### UPDATE 3: Backend - New Endpoints

**File:** `api_server.py`

**Add these endpoints:**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import bcrypt

security = HTTPBasic()

# 1. Onboarding endpoint
@app.post("/employees/onboard")
async def onboard_employee(data: dict):
    """Receive onboarding data from frontend"""
    password_hash = bcrypt.hashpw(data['password'].encode(), bcrypt.gensalt()).decode()
    
    employee = {
        'id': str(uuid.uuid4()),
        'name': data['name'],
        'email': data['email'],
        'department': data['department'],
        'role': data['role'],
        'work_description': data['work_description'],
        'expected_apps': data['expected_apps'],
        'expected_sites': data['expected_sites'],
        'youtube_ok': data['youtube_ok'],
        'meeting_pct': data['meeting_pct'],
        'password_hash': password_hash,
        'api_key': str(uuid.uuid4()),
        'active': True
    }
    
    supabase.table('employees').insert(employee).execute()
    
    supabase.table('device_registrations').insert({
        'device_id': data['device_id'],
        'employee_id': employee['id'],
        'registered': True
    }).execute()
    
    return {'employee_id': employee['id'], 'api_key': employee['api_key']}

# 2. Agent registration check
@app.get("/agent/registration-status")
async def check_registration(device_id: str):
    """Agent polls this to check if onboarding complete"""
    result = supabase.table('device_registrations')\
        .select('*, employees(*)')\
        .eq('device_id', device_id)\
        .execute()
    
    if result.data and result.data[0]['registered']:
        emp = result.data[0]['employees']
        return {
            'registered': True,
            'employee_id': emp['id'],
            'api_key': emp['api_key']
        }
    
    return {'registered': False}

# 3. Real-time status endpoint
@app.get("/employee/{employee_id}/live-status")
async def get_live_status(employee_id: str):
    """Get current activity for employee dashboard"""
    latest = supabase.table('screenshots')\
        .select('*')\
        .eq('employee_id', employee_id)\
        .order('captured_at', desc=True)\
        .limit(1)\
        .execute()
    
    if not latest.data:
        return {'status': 'offline'}
    
    screenshot = latest.data[0]
    time_diff = (datetime.now() - datetime.fromisoformat(screenshot['captured_at'])).seconds
    
    return {
        'status': 'active' if time_diff < 120 else 'idle',
        'current_app': screenshot['process_name'],
        'current_window': screenshot['window_title_raw'],
        'last_activity': screenshot['captured_at'],
        'activity_level': screenshot.get('activity_level', 'unknown')
    }

# 4. Today's summary
@app.get("/employee/{employee_id}/today-summary")
async def get_today_summary(employee_id: str):
    """Aggregate today's data for dashboard"""
    today = datetime.now().date()
    
    screenshots = supabase.table('screenshots')\
        .select('*')\
        .eq('employee_id', employee_id)\
        .gte('captured_at', today.isoformat())\
        .execute()
    
    data = screenshots.data
    total_time_minutes = len(data)
    
    # App breakdown
    app_time = {}
    for s in data:
        app = s.get('process_name', 'Unknown')
        app_time[app] = app_time.get(app, 0) + 1
    
    total_keyboard = sum(s.get('keyboard_count', 0) for s in data)
    total_mouse = sum(s.get('mouse_count', 0) for s in data)
    
    # Activity timeline
    timeline = {}
    for s in data:
        hour = datetime.fromisoformat(s['captured_at']).hour
        timeline[hour] = timeline.get(hour, 0) + 1
    
    return {
        'total_time_minutes': total_time_minutes,
        'app_breakdown': [
            {'app': app, 'minutes': mins} 
            for app, mins in sorted(app_time.items(), key=lambda x: x[1], reverse=True)
        ],
        'total_keyboard': total_keyboard,
        'total_mouse': total_mouse,
        'timeline': [{'hour': h, 'count': c} for h, c in sorted(timeline.items())]
    }

# 5. Admin team status
@app.get("/admin/team-status")
async def get_team_status(credentials: HTTPBasicCredentials = Depends(security)):
    """Get all employees' current status"""
    verify_admin(credentials)
    
    employees = supabase.table('employees').select('*').eq('active', True).execute()
    
    team_status = []
    for emp in employees.data:
        latest = supabase.table('screenshots')\
            .select('*')\
            .eq('employee_id', emp['id'])\
            .order('captured_at', desc=True)\
            .limit(1)\
            .execute()
        
        if latest.data:
            s = latest.data[0]
            time_diff = (datetime.now() - datetime.fromisoformat(s['captured_at'])).seconds
            status = 'active' if time_diff < 120 else 'idle'
        else:
            s = None
            status = 'offline'
        
        team_status.append({
            'employee_id': emp['id'],
            'name': emp['name'],
            'role': emp.get('role'),
            'status': status,
            'current_app': s['process_name'] if s else None,
            'last_seen': s['captured_at'] if s else None
        })
    
    return team_status

# 6. Manual AI trigger
@app.post("/admin/analyze-now")
async def trigger_analysis(
    date: str = None,
    credentials: HTTPBasicCredentials = Depends(security)
):
    """Manually trigger AI analysis"""
    verify_admin(credentials)
    
    target_date = date or datetime.now().date().isoformat()
    
    import subprocess
    subprocess.run(['python', 'ai_analyzer.py', '--date', target_date])
    subprocess.run(['python', 'slack_reporter.py', '--date', target_date])
    
    return {'status': 'completed', 'date': target_date}

# 7. Employee login
@app.post("/auth/employee-login")
async def employee_login(email: str, password: str):
    """Employee authentication"""
    emp = supabase.table('employees').select('*').eq('email', email).execute()
    
    if not emp.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    employee = emp.data[0]
    
    if not bcrypt.checkpw(password.encode(), employee['password_hash'].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        'employee_id': employee['id'],
        'name': employee['name'],
        'role': employee['role']
    }

def verify_admin(credentials: HTTPBasicCredentials):
    admin = supabase.table('admins')\
        .select('*')\
        .eq('username', credentials.username)\
        .execute()
    
    if not admin.data:
        raise HTTPException(status_code=401)
    
    if not bcrypt.checkpw(credentials.password.encode(), admin.data[0]['password_hash'].encode()):
        raise HTTPException(status_code=401)
```

---

### UPDATE 4: Frontend - Onboarding Flow

**File:** `frontend/src/pages/Onboarding.jsx`

5-step wizard collecting: name, email, password, department, role, expected_apps, expected_sites, youtube_ok, meeting_pct.

On submit: POST /employees/onboard → redirect to /dashboard

---

### UPDATE 5: Frontend - Employee Dashboard

**File:** `frontend/src/pages/EmployeeDashboard.jsx`

Poll every 10s: GET /employee/{id}/live-status
Poll every 30s: GET /employee/{id}/today-summary

Display:
- Live status (current app, activity level)
- Today's total time
- App breakdown chart
- Activity timeline
- Keyboard/mouse counts

---

### UPDATE 6: Frontend - Admin Dashboard

**File:** `frontend/src/pages/AdminDashboard.jsx`

Poll every 15s: GET /admin/team-status

Display:
- Team grid (all employees)
- Each card shows: name, role, status, current app, last seen
- Button: "Run AI Analysis Now" → POST /admin/analyze-now

---

### UPDATE 7: AI Analyzer - Accept Date Parameter

**File:** `ai_analyzer.py`

```python
import sys
from datetime import datetime

def main():
    target_date = None
    if '--date' in sys.argv:
        idx = sys.argv.index('--date')
        target_date = sys.argv[idx + 1]
    else:
        target_date = datetime.now().date().isoformat()
    
    print(f"Analyzing screenshots for {target_date}")
    
    screenshots = supabase.table('screenshots')\
        .select('*')\
        .eq('analyzed', False)\
        .gte('captured_at', target_date)\
        .execute()
    
    # Run analysis...
```

---

## IMPLEMENTATION ORDER

1. Database Migration (run SQL)
2. Backend Updates (add all endpoints)
3. Agent Updates (browser onboarding + activity tracking)
4. Frontend Onboarding
5. Frontend Employee Dashboard
6. Frontend Admin Dashboard
7. AI Analyzer Update
8. Deploy & Test

---

## TESTING CHECKLIST

- [ ] Agent opens browser to onboarding
- [ ] Onboarding saves to database
- [ ] Agent auto-syncs after onboarding
- [ ] Employee can login and see dashboard
- [ ] Dashboard shows live data
- [ ] Admin can see all employees
- [ ] Admin can trigger AI analysis
- [ ] AI analysis updates database
- [ ] Slack report sends after analysis

---

## ENVIRONMENT VARIABLES

Railway:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

Vercel:
```
VITE_API_BASE=https://employee-activity-tracker-production-ff6f.up.railway.app
```