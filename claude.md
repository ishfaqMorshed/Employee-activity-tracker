# Employee Activity Monitoring System - Development Guide

**Project Owner:** Ishfak (ishfakeraz@gmail.com)  
**Current Version:** v3.1.0 (Partially Complete)  
**Target:** Production-ready role-based productivity monitoring system  
**AI Agent:** This file guides Antigravity Claude Code to complete the system

---

## 🎯 Project Vision

Transform a basic screenshot monitoring system into an **intelligent productivity platform** that judges employees fairly based on their specific role, not just raw activity data.

**Core Philosophy:** Same app + same activity level = **different productivity** depending on employee's role.
- Developer in VS Code (high activity) = High productivity ✓
- Developer in Photoshop (high activity) = Low productivity ✗
- Designer in Photoshop (high activity) = High productivity ✓
- Designer in VS Code (high activity) = Low productivity ✗

---

## 📊 Current System State

### ✅ What Exists (Built & Working)

**Desktop Agent** (`screenshot_agent_COMPLETE.py` v3.1.0)
- Captures screenshots every 60 seconds using `mss`
- Captures window title using `win32gui.GetForegroundWindow()`
- Captures process name using `win32process` + `psutil`
- Uploads screenshots to Supabase Storage
- Inserts metadata to Supabase `screenshots` table
- Offline queue (saves locally, uploads when connection restored)
- Logging to `C:\ProgramData\ScreenshotAgent\logs\`
- Status: Working on 2 PCs (Ishfak + 1 colleague)

**Central API Server** (`api_server.py`)
- FastAPI + Uvicorn backend
- `POST /screenshot` - receives screenshots from agents
- `GET /health` - health check
- `GET /employees` - list all employees
- `POST /employees/register` - register new employee
- `GET /report/{date}` - HTML report (no AI, pure template)
- Supabase integration for storage & database
- Status: Running locally (not cloud-deployed)

**Database** (Supabase PostgreSQL)
- `employees` table: id, name, email, slack_user_id, api_key, active, created_at
- `screenshots` table: employee_id, captured_at, storage_path, storage_url, process_name, window_title_raw, analyzed, productivity, focus_score, notes, analyzed_at
- `daily_summaries` table: employee_id, summary_date, total_screenshots, productivity_score, top_app
- Storage bucket: `screenshots/{employee_id}/{date}/{timestamp}.jpg`
- Status: Tables created, 1 employee registered (Ishfak)

**AI Analyzer** (`ai_analyzer.py` v4.0.0)
- Claude API integration (claude-sonnet-4-20250514)
- Analyzes screenshots with context
- Already coded for role-based analysis
- Batch processing with `ANALYZE_EVERY_N` config
- Status: Code ready, but using fallback defaults (profile columns don't exist in DB yet)

**Slack Reporter** (`slack_reporter.py` v2.0.0)
- Slack Block Kit formatting
- @mentions with real avatars
- Progress bars for productivity
- App breakdown
- Claude-written narratives
- Posts to Slack webhook
- Status: Working, tested

**Employee Registration** (`register_employee.py`)
- CLI questionnaire
- Collects profile data
- Inserts to Supabase
- Generates API keys
- Status: CLI working, only 1 employee onboarded

### ⚠️ What's Partially Done

**Database Schema:**
- Profile columns defined in `supabase_schema.sql`
- Columns: role, department, work_description, expected_apps, expected_sites, youtube_ok, meeting_pct, edge_cases
- **NOT YET RUN** - these columns don't exist in production DB
- Activity columns (keyboard_count, mouse_count, activity_level) also not added yet

**Employee Profiles:**
- Only Ishfak registered
- 19+ other employees need onboarding
- AI analyzer falls back to generic defaults without profiles

### ❌ What Doesn't Exist Yet

1. **Keyboard/mouse activity monitoring** (Phase 1)
2. **Web dashboard** for employees/managers (Phase 2)
3. **Role-based profiles in database** (Phase 3 - SQL ready, not executed)
4. **Web-based onboarding UI** (Phase 4 - CLI exists, web version needed)
5. **Remote agent control** (start/stop from dashboard) (Phase 5)
6. **One-click installer** (.exe package)
7. **Automated scheduling** (Task Scheduler setup)
8. **Cloud deployment** (Railway/Render)
9. **Morning status report** (11 AM attendance check)

---

## 🔄 Complete Data Flow Architecture

### The Journey of Data (From Onboarding to Report)

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: EMPLOYEE ONBOARDING (Phase 4 - TO BE BUILT)         │
└─────────────────────────────────────────────────────────────┘
Employee logs into dashboard → Fills questionnaire:
  ├─ Name, Email, Department
  ├─ Role (Frontend Developer, UI Designer, etc.)
  ├─ Daily work description
  ├─ Expected apps (VS Code, Figma, Chrome, etc.)
  ├─ Expected websites (github.com, stackoverflow.com, etc.)
  ├─ YouTube policy (allowed for tutorials?)
  └─ Meeting percentage (0-100%)

↓ Stored in Supabase

employees table:
{
  id: "emp_123",
  name: "John Smith",
  email: "john@company.com",
  role: "Frontend Developer",
  expected_apps: ["VS Code", "Chrome", "Figma", "Slack"],
  expected_sites: ["github.com", "stackoverflow.com"],
  youtube_ok: true,
  meeting_pct: 20
}

↓ Profile becomes the CONTEXT for all future analysis

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: AGENT CAPTURES DATA (Phase 1 - TO BE ENHANCED)      │
└─────────────────────────────────────────────────────────────┘
Every 60 seconds, desktop agent captures:

Current Data (Existing):
├─ Screenshot (JPEG, 60% quality)
├─ Process name: "Code.exe" (via psutil)
├─ Window title: "dashboard.jsx - Visual Studio Code" (via win32gui)
└─ Timestamp

New Data (Phase 1 - TO ADD):
├─ Keyboard count: 145 keystrokes in last 60s (via pynput)
├─ Mouse count: 28 clicks in last 60s (via pynput)
└─ Activity level: "high" (calculated from keyboard+mouse)

Activity Level Calculation:
  if keyboard > 100 OR mouse > 20: "high"
  elif keyboard > 30 OR mouse > 10: "medium"
  elif keyboard > 5 OR mouse > 2: "low"
  else: "idle"

↓ All data uploaded to Supabase

screenshots table:
{
  employee_id: "emp_123",
  captured_at: "2026-04-20 14:30:00",
  storage_url: "https://supabase.co/.../screenshot.jpg",
  process_name: "Code.exe",
  window_title_raw: "dashboard.jsx - Visual Studio Code",
  keyboard_count: 145,          // NEW
  mouse_count: 28,              // NEW
  activity_level: "high",       // NEW
  analyzed: false               // Will be updated by AI
}

┌─────────────────────────────────────────────────────────────┐
│ STEP 3: AI ANALYZES WITH ROLE CONTEXT (Phase 3 + Existing)  │
└─────────────────────────────────────────────────────────────┘
Nightly at 9 PM, ai_analyzer.py runs:

For each unanalyzed screenshot:
1. Fetch employee profile from database
2. Fetch screenshot metadata + image
3. Build role-aware prompt
4. Send to Claude API

AI Prompt Structure:
"""
EMPLOYEE CONTEXT:
Role: {role}
Expected apps: {expected_apps}
Expected sites: {expected_sites}
YouTube allowed: {youtube_ok}

CURRENT ACTIVITY:
App: {process_name}
Window: {window_title_raw}
Keyboard activity: {keyboard_count} keystrokes
Mouse activity: {mouse_count} clicks
Activity level: {activity_level}

SCREENSHOT: [image]

JUDGE PRODUCTIVITY FOR THIS SPECIFIC ROLE:
- Is this app expected for their role?
- Is activity level appropriate?
- What specific task are they doing?

Return JSON with:
- productivity_score (0-100)
- app_relevance (high/medium/low)
- activity_assessment (high/medium/low/idle)
- specific_task (what they're doing)
- category (coding/design/communication/research/distraction)
- notes (2-3 sentences)
"""

AI Analysis Combines Three Factors:

1. ROLE-BASED RELEVANCE (40%):
   App in expected_apps[] → HIGH relevance
   App not in expected_apps[] → LOW relevance
   
   Example: Frontend Developer
   - VS Code → HIGH (40%)
   - Photoshop → LOW (5%)

2. ACTIVITY LEVEL (30%):
   High activity (145 keys) → 30%
   Medium activity (50 keys) → 20%
   Low activity (10 keys) → 10%
   Idle (0 keys) → 0%

3. SCREENSHOT CONTENT (30%):
   Writing code → HIGH (30%)
   Watching tutorials → MEDIUM (15%)
   Playing games → LOW (0%)

Final Score = Sum of three factors

Example Result:
{
  productivity_score: 95,
  productivity: "High",
  app_relevance: "high",
  app_explanation: "VS Code is primary tool for Frontend Developer",
  activity_assessment: "high",
  activity_explanation: "145 keystrokes indicate active coding",
  specific_task: "Writing React component for dashboard",
  category: "coding",
  notes: "Developer actively coding in VS Code on dashboard.jsx. High keystroke count confirms engagement. Expected behavior for role.",
  relevant_to_role: true
}

↓ Results stored back to database

screenshots table updated:
{
  analyzed: true,
  productivity: "High",
  focus_score: 95,
  time_wasted_pct: 5,
  activity_category: "coding",
  app_name: "VS Code",
  window_title: "dashboard.jsx",
  notes: "Developer actively coding..."
}

┌─────────────────────────────────────────────────────────────┐
│ STEP 4: DAILY REPORT GENERATION (Existing + Enhancements)   │
└─────────────────────────────────────────────────────────────┘
At 9:15 PM, slack_reporter.py runs:

For each employee:
1. Fetch their profile (role, expected_apps)
2. Fetch all analyzed screenshots from today
3. Aggregate metrics

Aggregation Logic:
├─ App Time Breakdown:
│  ├─ Count screenshots per app
│  ├─ Convert to hours (screenshot count × 1 minute)
│  └─ Tag as expected/unexpected based on profile
│
├─ Activity Analysis:
│  ├─ Sum keyboard/mouse counts
│  ├─ Calculate % in each activity level
│  └─ Identify idle periods
│
├─ Productivity Score:
│  ├─ Weight by AI scores (High=2, Medium=1, Low=0.5)
│  ├─ Calculate average
│  └─ Convert to percentage
│
└─ Category Breakdown:
   ├─ Time in coding/design/communication
   ├─ Time in meetings
   └─ Time wasted

Report Structure:
"""
# Daily Report - John Smith
Role: Frontend Developer
Date: April 20, 2026

## Productivity Summary
Overall Score: 85% (High)
Active Time: 7h 23m

## App Usage (Role-Based)
✓ Expected Apps:
  - VS Code: 4h 35m (62%) - Primary work
  - Chrome (GitHub): 2h 10m (30%) - Code reviews
  - Slack: 38m (8%) - Communication

✗ Unexpected Apps:
  - None detected

## Activity Breakdown
High: 6h 12m (84%)
Medium: 45m (10%)
Low: 26m (6%)
Idle: 0m (0%)

## Keyboard/Mouse Activity
Total Keystrokes: 12,450
Total Clicks: 3,280
Engagement Level: Very High

## AI Analysis
John had a highly productive day focused on React development.
He spent 4.5 hours in VS Code working on dashboard components
(expected for his role). Chrome usage was primarily on GitHub
and Stack Overflow - appropriate research activities. One 15-minute
YouTube video watched: "React 18 New Features" - relevant to 
current project. No significant distractions detected.
"""

↓ Posted to Slack with Block Kit formatting
```

---

## 🚀 Implementation Phases

### Phase 1: Add Activity Monitoring to Desktop Agent

**Goal:** Enhance agent to track keyboard/mouse activity alongside screenshots

**Files to Modify:**
- `screenshot_agent_COMPLETE.py` (v3.1.0 → v4.0.0)
- `requirements_agent.txt` (add pynput)
- Create: `migrations/001_add_activity_columns.sql`

**Technical Requirements:**

1. **Add Activity Tracking:**
```python
# Use pynput to monitor keyboard/mouse
from pynput import keyboard, mouse

class ActivityMonitor:
    def __init__(self):
        self.keyboard_count = 0
        self.mouse_count = 0
        self.start_listeners()
    
    def start_listeners(self):
        keyboard.Listener(on_press=self.on_key).start()
        mouse.Listener(on_click=self.on_click).start()
    
    def on_key(self, key):
        self.keyboard_count += 1
    
    def on_click(self, x, y, button, pressed):
        if pressed:
            self.mouse_count += 1
    
    def calculate_activity_level(self):
        k = self.keyboard_count
        m = self.mouse_count
        
        if k > 100 or m > 20:
            level = "high"
        elif k > 30 or m > 10:
            level = "medium"
        elif k > 5 or m > 2:
            level = "low"
        else:
            level = "idle"
        
        result = {
            "keyboard_count": k,
            "mouse_count": m,
            "activity_level": level
        }
        
        # Reset counters
        self.keyboard_count = 0
        self.mouse_count = 0
        
        return result
```

2. **Update Upload Payload:**
Existing payload:
```python
{
  "employee_id": self.employee_id,
  "timestamp": datetime.now().isoformat(),
  "screenshot": base64_image,
  "process_name": "Code.exe",
  "window_title_raw": "dashboard.jsx - VS Code"
}
```

Add to payload:
```python
{
  ... existing fields ...,
  "keyboard_count": 145,
  "mouse_count": 28,
  "activity_level": "high"
}
```

3. **Database Migration:**
```sql
-- File: migrations/001_add_activity_columns.sql

ALTER TABLE screenshots
ADD COLUMN IF NOT EXISTS keyboard_count INTEGER,
ADD COLUMN IF NOT EXISTS mouse_count INTEGER,
ADD COLUMN IF NOT EXISTS activity_level TEXT;

CREATE INDEX IF NOT EXISTS idx_screenshots_activity 
ON screenshots(activity_level);
```

4. **Update API Server:**
Modify `api_server.py` to accept new fields in POST /screenshot:
```python
class ScreenshotUpload(BaseModel):
    employee_id: str
    timestamp: str
    screenshot: str
    process_name: str
    window_title_raw: str
    keyboard_count: int  # NEW
    mouse_count: int     # NEW
    activity_level: str  # NEW
```

**Dependencies:**
- Add to `requirements_agent.txt`: `pynput==1.7.6`

**Testing:**
- Run agent for 5 minutes
- Verify keyboard/mouse counts in database
- Verify activity level calculation
- Test offline queue still works

**Success Criteria:**
- ✅ Activity data captured every 60 seconds
- ✅ Data stored in Supabase
- ✅ Existing screenshot functionality unchanged
- ✅ No performance degradation

---

### Phase 2: Build Web Dashboard

**Goal:** Create React dashboard for employees & managers with live status

**Files to Create:**
```
frontend/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── api/
│   │   └── client.js
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── EmployeeDashboard.jsx
│   │   ├── ManagerDashboard.jsx
│   │   └── Onboarding.jsx (placeholder)
│   ├── components/
│   │   ├── StatusIndicator.jsx
│   │   ├── LiveTimer.jsx
│   │   ├── ActivityChart.jsx
│   │   ├── EmployeeCard.jsx
│   │   └── ProgressBar.jsx
│   └── styles/
│       └── global.css
```

**Files to Modify:**
- `api_server.py` (add dashboard endpoints)

**Technical Requirements:**

1. **Employee Dashboard Features:**
```jsx
// EmployeeDashboard.jsx
- Live status indicator (🟢 Running / ⚫ Stopped)
- Active time today counter (updates every 10s)
- Start/Stop monitoring button
- Today's activity summary:
  * Productivity score with progress bar
  * Top 3 apps with time spent
  * Activity level chart (high/medium/low/idle)
  * Screenshot count
- "View My Reports" button
```

2. **Manager Dashboard Features:**
```jsx
// ManagerDashboard.jsx
- Team overview grid
- Each employee card shows:
  * Name + avatar
  * Status (🟢 Active / 🔴 Idle / ⚫ Offline)
  * Productivity % with visual bar
  * Active time today
  * Last activity timestamp
  * [View Details] button
- Filters: date picker, search, department
- Export report button
- Sorting: by productivity, by time, by name
```

3. **API Endpoints to Add:**

```python
# Add to api_server.py

@app.post("/auth/login")
async def login(email: str, password: str):
    """
    Simple authentication
    For MVP, check if email exists in employees table
    Return JWT token
    """
    pass

@app.get("/employee/{id}/status")
async def get_employee_status(id: str):
    """
    Return:
    - current agent status (running/stopped)
    - active time today
    - last screenshot timestamp
    - current app
    """
    pass

@app.get("/employee/{id}/dashboard")
async def get_employee_dashboard(id: str, date: str = None):
    """
    Return today's (or specified date) summary:
    - productivity_score
    - app_breakdown [{app, duration, expected}]
    - activity_timeline [{hour, level}]
    - screenshot_count
    - top_category
    """
    pass

@app.get("/manager/team-status")
async def get_team_status():
    """
    Return all employees with:
    - current status
    - today's productivity
    - active time
    - last seen
    """
    pass
```

4. **Real-Time Updates:**
```javascript
// Use polling every 10 seconds for MVP
// WebSocket implementation in Phase 5

const EmployeeDashboard = () => {
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    // Initial fetch
    fetchStatus();
    
    // Poll every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);
  
  const fetchStatus = async () => {
    const data = await fetch(`/employee/${employeeId}/status`);
    setStatus(data);
  };
};
```

5. **Styling:**
- Dark theme (match existing HTML report)
- Tailwind CSS for utility classes
- Recharts for visualizations
- Responsive design
- Mobile-friendly

**Dependencies:**
```json
// package.json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "recharts": "^2.10.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0"
  }
}
```

**Success Criteria:**
- ✅ Employee can view their own status
- ✅ Manager can view all employees
- ✅ Live updates every 10 seconds
- ✅ Charts render correctly
- ✅ Responsive on mobile
- ✅ Dark theme consistent

---

### Phase 3: Add Role-Based Profiles to Database

**Goal:** Run migration to add profile columns, enable role-aware AI analysis

**Files to Create:**
- `migrations/002_add_employee_profiles.sql`
- `scripts/update_ishfak_profile.py` (set default profile)

**Files to Modify:**
- `register_employee.py` (already supports profiles, just verify)

**Technical Requirements:**

1. **Database Migration:**
```sql
-- File: migrations/002_add_employee_profiles.sql

BEGIN;

-- Add profile columns to employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS role TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS work_description TEXT,
ADD COLUMN IF NOT EXISTS expected_apps TEXT[],
ADD COLUMN IF NOT EXISTS expected_sites TEXT[],
ADD COLUMN IF NOT EXISTS youtube_ok BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS meeting_pct INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS edge_cases TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);

-- Set Ishfak's profile (default for testing)
UPDATE employees
SET
  role = 'Full Stack Developer',
  department = 'Engineering',
  work_description = 'Building employee monitoring system with Python, React, and AI. Full-stack development including desktop agent, backend API, web dashboard, and AI analysis.',
  expected_apps = ARRAY['Visual Studio Code', 'PyCharm', 'Google Chrome', 'Slack', 'Git Bash', 'Postman'],
  expected_sites = ARRAY['github.com', 'stackoverflow.com', 'supabase.com', 'anthropic.com', 'react.dev', 'python.org'],
  youtube_ok = true,
  meeting_pct = 10,
  edge_cases = 'Works late at night. Sometimes tests on multiple machines. Uses both VS Code and PyCharm depending on project.'
WHERE email = 'ishfakeraz@gmail.com';

COMMIT;
```

2. **Verify AI Analyzer Integration:**
No code changes needed - `ai_analyzer.py` v4.0.0 is already written to use these columns!

Just verify the profile fetching works:
```python
# In ai_analyzer.py (already exists)
def fetch_employee_profile(employee_id):
    response = supabase.table('employees').select('*').eq('id', employee_id).execute()
    profile = response.data[0]
    
    # These fields now exist:
    # profile['role']
    # profile['expected_apps']
    # profile['expected_sites']
    # profile['youtube_ok']
    # etc.
    
    return profile
```

3. **Test Profile Loading:**
```python
# scripts/test_profile_query.py
import os
from supabase import create_client

supabase = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_KEY']
)

# Fetch Ishfak's profile
response = supabase.table('employees').select('*').eq('email', 'ishfakeraz@gmail.com').execute()
profile = response.data[0]

print("Profile loaded successfully:")
print(f"Role: {profile['role']}")
print(f"Expected apps: {profile['expected_apps']}")
print(f"YouTube allowed: {profile['youtube_ok']}")
```

**Execution Steps:**
1. Run migration in Supabase SQL Editor
2. Verify columns exist
3. Run test script to confirm profile loading
4. Run ai_analyzer.py on one screenshot to verify role-based analysis works

**Success Criteria:**
- ✅ Profile columns exist in database
- ✅ Ishfak's profile populated
- ✅ AI analyzer loads profile correctly
- ✅ AI analysis uses role context
- ✅ No errors in ai_analyzer.py

---

### Phase 4: Build Web-Based Employee Onboarding

**Goal:** Convert CLI onboarding to beautiful web wizard, generate custom installers

**Files to Create:**
- `frontend/src/pages/Onboarding.jsx` (multi-step wizard)
- `backend/installer_builder.py` (package agent with config)

**Files to Modify:**
- `api_server.py` (add onboarding endpoints)
- `screenshot_agent_COMPLETE.py` (read config.json on startup)

**Technical Requirements:**

1. **Onboarding Wizard (5 Steps):**

**Step 1: Basic Info**
```jsx
<form>
  <input placeholder="Full Name" />
  <input placeholder="Email" />
  <select>
    <option>Engineering</option>
    <option>Design</option>
    <option>Marketing</option>
    <option>Sales</option>
    <option>Support</option>
  </select>
</form>
```

**Step 2: Role Definition**
```jsx
<form>
  <select name="role">
    <option>Frontend Developer</option>
    <option>Backend Developer</option>
    <option>Full Stack Developer</option>
    <option>UI/UX Designer</option>
    <option>Product Manager</option>
    <option>Marketing Manager</option>
    <option>Sales Representative</option>
  </select>
  
  <textarea 
    placeholder="Describe what you do daily..."
    name="work_description"
  />
</form>
```

**Step 3: Tools & Apps**
```jsx
<div className="app-grid">
  {/* Development */}
  <label><input type="checkbox" value="VS Code" /> VS Code</label>
  <label><input type="checkbox" value="PyCharm" /> PyCharm</label>
  
  {/* Design */}
  <label><input type="checkbox" value="Figma" /> Figma</label>
  <label><input type="checkbox" value="Photoshop" /> Photoshop</label>
  
  {/* Browsers */}
  <label><input type="checkbox" value="Chrome" /> Chrome</label>
  
  {/* Communication */}
  <label><input type="checkbox" value="Slack" /> Slack</label>
  <label><input type="checkbox" value="Teams" /> Teams</label>
  
  {/* Office */}
  <label><input type="checkbox" value="Excel" /> Excel</label>
</div>

<input 
  placeholder="Work websites (comma-separated): github.com, stackoverflow.com"
  name="expected_sites"
/>
```

**Step 4: Work Patterns**
```jsx
<form>
  <label>
    <input type="checkbox" name="youtube_ok" />
    I watch YouTube tutorials for work
  </label>
  
  <label>
    What % of your day is spent in meetings?
    <input 
      type="range" 
      min="0" 
      max="100" 
      name="meeting_pct"
    />
    <span>{value}%</span>
  </label>
  
  <textarea 
    placeholder="Special cases (optional): e.g., 'I sometimes use Photoshop even though I'm a developer'"
    name="edge_cases"
  />
</form>
```

**Step 5: Download Agent**
```jsx
<div className="completion">
  <div className="success-icon">✓</div>
  <h2>Profile Complete!</h2>
  
  <div className="credentials">
    <p>Your API Key (keep this safe):</p>
    <code>{apiKey}</code>
  </div>
  
  <button onClick={downloadInstaller}>
    Download EmployeeMonitor.exe
  </button>
  
  <div className="instructions">
    <h3>Installation:</h3>
    <ol>
      <li>Run EmployeeMonitor.exe</li>
      <li>Agent will start automatically</li>
      <li>Check your dashboard for live status</li>
    </ol>
  </div>
</div>
```

2. **API Endpoints:**

```python
# Add to api_server.py

@app.post("/employees/onboard")
async def onboard_employee(profile: EmployeeProfile):
    """
    Create employee record with full profile
    Generate API key
    Lookup Slack user ID
    Return credentials
    """
    # Insert to database
    employee_id = str(uuid.uuid4())
    api_key = str(uuid.uuid4())
    
    supabase.table('employees').insert({
        'id': employee_id,
        'api_key': api_key,
        'name': profile.name,
        'email': profile.email,
        'role': profile.role,
        'department': profile.department,
        'work_description': profile.work_description,
        'expected_apps': profile.expected_apps,
        'expected_sites': profile.expected_sites,
        'youtube_ok': profile.youtube_ok,
        'meeting_pct': profile.meeting_pct,
        'edge_cases': profile.edge_cases,
        'active': True
    }).execute()
    
    # Lookup Slack user
    slack_user = slack_client.users_lookupByEmail(email=profile.email)
    slack_user_id = slack_user['user']['id']
    
    supabase.table('employees').update({
        'slack_user_id': slack_user_id
    }).eq('id', employee_id).execute()
    
    return {
        'employee_id': employee_id,
        'api_key': api_key,
        'slack_user_id': slack_user_id
    }

@app.get("/employees/{id}/installer")
async def download_installer(id: str):
    """
    Generate custom installer with pre-configured credentials
    """
    # Fetch employee details
    employee = supabase.table('employees').select('*').eq('id', id).execute().data[0]
    
    # Create config.json
    config = {
        'employee_id': employee['id'],
        'api_key': employee['api_key'],
        'name': employee['name'],
        'email': employee['email'],
        'server_url': os.environ['SERVER_URL'],
        'screenshot_interval': 60,
        'compression_quality': 60
    }
    
    # Package with agent executable
    installer_path = build_installer(config)
    
    return FileResponse(
        installer_path,
        filename=f'EmployeeMonitor_{employee["name"].replace(" ", "_")}.exe'
    )
```

3. **Installer Builder:**

```python
# installer_builder.py
import os
import shutil
import json

def build_installer(config):
    """
    Package agent with custom config
    """
    # Create temp directory
    temp_dir = f'/tmp/installer_{config["employee_id"]}'
    os.makedirs(temp_dir, exist_ok=True)
    
    # Copy agent executable
    shutil.copy('dist/screenshot_agent.exe', f'{temp_dir}/EmployeeMonitor.exe')
    
    # Create config.json
    with open(f'{temp_dir}/config.json', 'w') as f:
        json.dump(config, f, indent=2)
    
    # Create installer script (optional)
    # For MVP, just zip the files
    import zipfile
    zip_path = f'{temp_dir}/EmployeeMonitor_Setup.zip'
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        zipf.write(f'{temp_dir}/EmployeeMonitor.exe', 'EmployeeMonitor.exe')
        zipf.write(f'{temp_dir}/config.json', 'config.json')
    
    return zip_path
```

4. **Agent Auto-Configuration:**

```python
# Update screenshot_agent_COMPLETE.py

def load_config():
    """
    Load config.json if exists, otherwise prompt user
    """
    config_path = 'config.json'
    
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
        print(f"Loaded config for {config['name']}")
        return config
    else:
        # First run - prompt for credentials
        print("First run setup...")
        # ... existing setup code ...
```

**Success Criteria:**
- ✅ 5-step wizard works smoothly
- ✅ All profile data saved to database
- ✅ Custom installer downloads
- ✅ Agent auto-configures on first run
- ✅ Slack user ID lookup works
- ✅ Can onboard 20 employees in < 1 hour

---

### Phase 5: Remote Agent Control & Live Sync

**Goal:** Enable dashboard to start/stop agent, show real-time status

**Files to Create:**
- `migrations/003_add_agent_control.sql`

**Files to Modify:**
- `screenshot_agent_COMPLETE.py` (add control polling)
- `api_server.py` (add control endpoints)
- `frontend/src/pages/EmployeeDashboard.jsx` (add control UI)

**Technical Requirements:**

1. **Control Database Table:**

```sql
-- migrations/003_add_agent_control.sql

CREATE TABLE IF NOT EXISTS agent_control (
  employee_id UUID PRIMARY KEY REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'running',
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by TEXT
);

-- Insert default records for all employees
INSERT INTO agent_control (employee_id, status)
SELECT id, 'running' FROM employees
ON CONFLICT (employee_id) DO NOTHING;
```

2. **Agent Control Mechanism:**

```python
# Add to screenshot_agent_COMPLETE.py

class AgentController:
    def __init__(self, employee_id, server_url, api_key):
        self.employee_id = employee_id
        self.server_url = server_url
        self.api_key = api_key
        self.is_running = True
        
        # Start control polling thread
        threading.Thread(target=self.poll_control, daemon=True).start()
    
    def poll_control(self):
        """Check control status every 10 seconds"""
        while True:
            try:
                response = requests.get(
                    f"{self.server_url}/agent/{self.employee_id}/control",
                    headers={"X-API-Key": self.api_key}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    new_status = data['status']
                    
                    if new_status != ('running' if self.is_running else 'stopped'):
                        print(f"Status changed to: {new_status}")
                        self.is_running = (new_status == 'running')
                
            except Exception as e:
                print(f"Control polling error: {e}")
            
            time.sleep(10)
    
    def should_capture(self):
        """Check if we should capture this cycle"""
        return self.is_running

# In main loop:
controller = AgentController(employee_id, server_url, api_key)

while True:
    if controller.should_capture():
        capture_and_upload()
    
    time.sleep(60)
```

3. **Backend Control Endpoints:**

```python
# Add to api_server.py

@app.get("/agent/{employee_id}/control")
async def get_agent_control(employee_id: str):
    """
    Get current control status
    Agent polls this every 10 seconds
    """
    result = supabase.table('agent_control').select('status').eq('employee_id', employee_id).execute()
    
    if not result.data:
        return {'status': 'running'}
    
    return {'status': result.data[0]['status']}

@app.put("/agent/{employee_id}/control")
async def update_agent_control(employee_id: str, status: str, updated_by: str):
    """
    Update control status
    Called from dashboard when user clicks Start/Stop
    """
    supabase.table('agent_control').upsert({
        'employee_id': employee_id,
        'status': status,
        'updated_at': 'now()',
        'updated_by': updated_by
    }).execute()
    
    return {'success': True, 'status': status}

@app.post("/agent/{employee_id}/heartbeat")
async def agent_heartbeat(employee_id: str, current_app: str = None):
    """
    Agent sends heartbeat every 60s
    Used to track last_seen and current activity
    """
    # Update Redis or database with last seen
    # For MVP, just return OK
    return {'received': True}
```

4. **Dashboard Control UI:**

```jsx
// Update EmployeeDashboard.jsx

const EmployeeDashboard = () => {
  const [status, setStatus] = useState('running');
  const [activeTime, setActiveTime] = useState(0);
  
  useEffect(() => {
    // Poll status every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchStatus = async () => {
    const response = await fetch(`/agent/${employeeId}/control`);
    const data = await response.json();
    setStatus(data.status);
  };
  
  const handleToggle = async () => {
    const newStatus = status === 'running' ? 'stopped' : 'running';
    
    await fetch(`/agent/${employeeId}/control`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        status: newStatus,
        updated_by: 'employee'
      })
    });
    
    setStatus(newStatus);
  };
  
  return (
    <div className="dashboard">
      <div className="status-section">
        <div className={`status-indicator ${status}`}>
          {status === 'running' ? '🟢 RUNNING' : '⚫ STOPPED'}
        </div>
        
        <div className="active-time">
          Active Time Today: {formatTime(activeTime)}
        </div>
        
        <button 
          className={`control-button ${status}`}
          onClick={handleToggle}
        >
          {status === 'running' ? '⏸ Pause Monitoring' : '▶ Start Monitoring'}
        </button>
      </div>
      
      {/* Rest of dashboard */}
    </div>
  );
};
```

5. **Live Status Indicator:**

```jsx
// components/StatusIndicator.jsx
const StatusIndicator = ({ status, lastSeen }) => {
  const getStatusColor = () => {
    if (status === 'running') return 'green';
    if (status === 'stopped') return 'gray';
    return 'red';
  };
  
  const getStatusText = () => {
    if (status === 'running') return 'Active';
    if (status === 'stopped') return 'Paused';
    return 'Offline';
  };
  
  return (
    <div className={`status-badge ${getStatusColor()}`}>
      <div className="status-dot" />
      <span>{getStatusText()}</span>
      <span className="last-seen">
        {formatDistanceToNow(lastSeen)} ago
      </span>
    </div>
  );
};
```

**Success Criteria:**
- ✅ Employee can stop agent from dashboard
- ✅ Agent stops capturing within 10 seconds
- ✅ Employee can restart agent from dashboard
- ✅ Status updates in real-time
- ✅ Last seen timestamp accurate
- ✅ No missed screenshots during transitions

---

## 📁 Complete File Structure

```
project-root/
├── CLAUDE.md                          # This file
├── .env                               # Environment variables
├── README.md                          # Project overview
│
├── backend/
│   ├── screenshot_agent_COMPLETE.py   # v3.1.0 → v5.0.0
│   ├── api_server.py                  # FastAPI backend
│   ├── ai_analyzer.py                 # v4.0.0 (role-aware)
│   ├── slack_reporter.py              # v2.0.0
│   ├── register_employee.py           # CLI onboarding
│   ├── installer_builder.py           # NEW (Phase 4)
│   ├── requirements_agent.txt         # Agent dependencies
│   ├── requirements.txt               # Backend dependencies
│   └── supabase_schema.sql            # Initial schema
│
├── migrations/
│   ├── 001_add_activity_columns.sql   # Phase 1
│   ├── 002_add_employee_profiles.sql  # Phase 3
│   └── 003_add_agent_control.sql      # Phase 5
│
├── frontend/                          # NEW (Phase 2)
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── api/
│       │   └── client.js
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── EmployeeDashboard.jsx
│       │   ├── ManagerDashboard.jsx
│       │   └── Onboarding.jsx
│       ├── components/
│       │   ├── StatusIndicator.jsx
│       │   ├── LiveTimer.jsx
│       │   ├── ActivityChart.jsx
│       │   ├── EmployeeCard.jsx
│       │   └── ProgressBar.jsx
│       └── styles/
│           └── global.css
│
├── scripts/
│   ├── test_profile_query.py         # Verify Phase 3
│   └── deploy_agent.ps1               # Future: mass deployment
│
└── dist/                              # Built files
    └── screenshot_agent.exe           # Packaged agent
```

---

## 🔑 Environment Variables

```bash
# .env file

# Supabase
SUPABASE_URL=https://ymzqrjjmeimwfgvyrqdx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJI...  # Service role key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_BOT_TOKEN=xoxb-...

# Server
SERVER_URL=http://localhost:8000  # Change to production URL
SERVER_API_KEY=admin-ishfak-2026

# AI Configuration
ANALYZE_EVERY_N=1  # Analyze every Nth screenshot (1=all, 5=every 5th)
```

---

## 🎯 Dependencies Between Phases

```
Phase 1 (Activity Monitoring)
  ↓ Can be done independently
  ↓ 
  → Phase 2 (Dashboard) displays activity data
  → Phase 3 (Profiles) uses activity in AI scoring

Phase 3 (Database Profiles)
  ↓ Must be done before Phase 4
  ↓
  → Phase 4 (Onboarding) writes to profile columns

Phase 2 (Dashboard)
  ↓ Must exist before Phase 4 & 5
  ↓
  → Phase 4 (Onboarding) is part of dashboard
  → Phase 5 (Control) uses dashboard UI

Phase 4 (Onboarding)
  ↓ Can be done after Phase 2 & 3
  ↓
  → Enables proper role-based AI analysis

Phase 5 (Control)
  ↓ Requires Phase 2 (dashboard UI)
  ↓
  → Enhances but not blocks other phases
```

**Recommended Order:**
1. Phase 1 (Activity) - Independent, high value
2. Phase 3 (Profiles) - Quick, enables AI
3. Phase 2 (Dashboard) - Foundational for 4 & 5
4. Phase 4 (Onboarding) - Depends on 2 & 3
5. Phase 5 (Control) - Polish feature

---

## ✅ Testing Strategy

### Phase 1 Testing:
```bash
# Run agent
python screenshot_agent_COMPLETE.py

# Type and click for 60 seconds
# Verify data in Supabase:
SELECT keyboard_count, mouse_count, activity_level 
FROM screenshots 
ORDER BY captured_at DESC 
LIMIT 5;
```

### Phase 2 Testing:
```bash
# Start backend
python api_server.py

# Start frontend
cd frontend && npm run dev

# Open http://localhost:5173
# Login as Ishfak
# Verify live status updates
```

### Phase 3 Testing:
```sql
-- Run migration
\i migrations/002_add_employee_profiles.sql

-- Verify columns exist
\d employees

-- Verify Ishfak's profile
SELECT role, expected_apps, youtube_ok FROM employees WHERE email = 'ishfakeraz@gmail.com';
```

### Phase 4 Testing:
```
1. Open http://localhost:5173/onboarding
2. Fill out all 5 steps
3. Download installer
4. Extract and run on test machine
5. Verify agent starts and uploads
```

### Phase 5 Testing:
```
1. Start agent
2. Open dashboard
3. Click "Pause Monitoring"
4. Wait 10 seconds
5. Verify agent stops capturing
6. Click "Start Monitoring"
7. Verify agent resumes
```

---

## 📊 Success Metrics

### Technical Metrics:
- ✅ 0 errors in agent logs
- ✅ < 2% CPU usage by agent
- ✅ < 100MB RAM usage by agent
- ✅ 100% screenshot upload success rate
- ✅ < 10s dashboard load time
- ✅ < 1s API response time

### Business Metrics:
- ✅ 20 employees onboarded
- ✅ 100% agent uptime
- ✅ Daily reports delivered to Slack
- ✅ < 5 minutes for manager to review team status
- ✅ 0 employee complaints about privacy

---

## 🚨 Common Issues & Solutions

### Issue: Agent not uploading
**Solution:** Check internet connection, verify Supabase credentials, check logs

### Issue: Activity detection not working
**Solution:** Verify pynput installed, check permissions on Windows

### Issue: AI analyzer using fallback defaults
**Solution:** Run Phase 3 migration, verify profile columns exist

### Issue: Dashboard not showing live updates
**Solution:** Check polling interval, verify API endpoints return data

### Issue: Installer not working on employee PC
**Solution:** Check Windows Defender, verify config.json in same folder

---

## 🎓 Development Guidelines for Antigravity

### Code Style:
- Python: Follow PEP 8
- JavaScript: Use ES6+ features
- React: Functional components with hooks
- SQL: Use explicit column names, no SELECT *

### Error Handling:
- Always use try-catch in agent
- Log errors to file
- Never crash silently
- Provide user-friendly error messages

### Performance:
- Agent must be lightweight (< 2% CPU)
- Database queries must use indexes
- Dashboard must load in < 2 seconds
- AI analysis can take time (nightly batch)

### Security:
- Never log API keys
- Use environment variables
- Validate all inputs
- Use prepared statements for SQL
- Store credentials in secure location

---

## 🚀 Next Steps After All Phases Complete

1. **Deploy to Cloud:** Railway/Render for api_server.py
2. **Automated Scheduling:** Windows Task Scheduler for nightly jobs
3. **Morning Status Report:** 11 AM Slack attendance check
4. **Mass Deployment:** PowerShell script to push agent to all PCs
5. **Mobile App:** React Native for manager mobile view
6. **Advanced Analytics:** Trends, predictions, anomaly detection
7. **Integrations:** Google Calendar (meeting detection), Jira (task correlation)

---

## 📝 Notes for Antigravity

- This system is currently at v3.1.0 with 2 employees
- Target is production-ready v5.0.0 with 20 employees
- Each phase builds on previous phases
- Testing is critical - verify each phase before moving to next
- The data flow diagram above shows how everything connects
- When in doubt, refer to existing code in screenshot_agent_COMPLETE.py, api_server.py, ai_analyzer.py
- Ask for clarification if any requirement is ambiguous

---

**Last Updated:** April 20, 2026  
**Status:** Ready for Phase 1 implementation  
**Next Action:** Begin Phase 1 - Add Activity Monitoring