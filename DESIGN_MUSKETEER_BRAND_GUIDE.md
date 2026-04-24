# Design Musketeer - Frontend Brand Guidelines

**Product:** Activity Monitor Dashboard  
**Brand:** Design Musketeer  
**Style:** Modern, Creative, Professional SaaS

---

## BRAND COLORS (Exact Values)

### Primary Colors
```css
--dm-purple-primary: #A855F7;      /* Main brand purple */
--dm-purple-light: #C084FC;        /* Light purple */
--dm-purple-dark: #7E22CE;         /* Dark purple */
--dm-purple-gradient: linear-gradient(135deg, #A855F7 0%, #C084FC 100%);
```

### Secondary Colors
```css
--dm-orange-primary: #F97316;      /* Main orange */
--dm-orange-light: #FB923C;        /* Light orange */
--dm-orange-dark: #EA580C;         /* Dark orange */
--dm-orange-gradient: linear-gradient(135deg, #F97316 0%, #FB923C 100%);
```

### Accent Colors
```css
--dm-cyan-primary: #06B6D4;        /* Cyan accent */
--dm-cyan-light: #22D3EE;          /* Light cyan */
--dm-cyan-dark: #0891B2;           /* Dark cyan */
```

### Neutral Colors
```css
--dm-dark-bg: #0F172A;             /* Primary dark background */
--dm-dark-surface: #1E293B;        /* Card/surface background */
--dm-dark-border: #334155;         /* Border color */
--dm-light-bg: #F3E8FF;            /* Light purple background */
--dm-text-dark: #1E293B;           /* Dark text on light bg */
--dm-text-light: #F8FAFC;          /* Light text on dark bg */
--dm-text-muted: #94A3B8;          /* Muted text */
```

### Status Colors (Brand-Aligned)
```css
--dm-success: #10B981;             /* Green */
--dm-warning: #F97316;             /* Use brand orange */
--dm-error: #EF4444;               /* Red */
--dm-info: #06B6D4;                /* Use brand cyan */
```

---

## TYPOGRAPHY

### Font Family
```css
@font-face {
  font-family: 'Greater Neue';
  src: url('/fonts/greaterneue-regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Greater Neue';
  src: url('/fonts/greaterneue-medium.otf') format('opentype');
  font-weight: 500;
}

@font-face {
  font-family: 'Greater Neue';
  src: url('/fonts/greaterneue-semibold.otf') format('opentype');
  font-weight: 600;
}

@font-face {
  font-family: 'Greater Neue';
  src: url('/fonts/greaterneue-bold.otf') format('opentype');
  font-weight: 700;
}

body {
  font-family: 'Greater Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

### Typography Scale
```css
--dm-font-h1: 600 48px/1.2 'Greater Neue';
--dm-font-h2: 600 36px/1.3 'Greater Neue';
--dm-font-h3: 600 24px/1.4 'Greater Neue';
--dm-font-h4: 600 20px/1.4 'Greater Neue';
--dm-font-body: 400 16px/1.6 'Greater Neue';
--dm-font-small: 400 14px/1.5 'Greater Neue';
--dm-font-xs: 400 12px/1.4 'Greater Neue';
```

---

## DESIGN TOKENS

### Spacing
```css
--dm-space-xs: 4px;
--dm-space-sm: 8px;
--dm-space-md: 16px;
--dm-space-lg: 24px;
--dm-space-xl: 32px;
--dm-space-2xl: 48px;
```

### Border Radius
```css
--dm-radius-sm: 8px;
--dm-radius-md: 12px;
--dm-radius-lg: 16px;
--dm-radius-xl: 24px;
--dm-radius-full: 9999px;
```

### Shadows
```css
--dm-shadow-sm: 0 1px 2px rgba(168, 85, 247, 0.05);
--dm-shadow-md: 0 4px 6px rgba(168, 85, 247, 0.1);
--dm-shadow-lg: 0 10px 15px rgba(168, 85, 247, 0.15);
--dm-shadow-xl: 0 20px 25px rgba(168, 85, 247, 0.2);
--dm-shadow-glow: 0 0 20px rgba(168, 85, 247, 0.4);
```

---

## COMPONENT STYLING

### Buttons
```css
/* Primary Button - Purple Gradient */
.btn-primary {
  background: linear-gradient(135deg, #A855F7 0%, #C084FC 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  border: none;
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(168, 85, 247, 0.4);
}

/* Secondary Button - Orange Gradient */
.btn-secondary {
  background: linear-gradient(135deg, #F97316 0%, #FB923C 100%);
  color: white;
  /* Same other styles as primary */
}

/* Outline Button */
.btn-outline {
  background: transparent;
  border: 2px solid #A855F7;
  color: #A855F7;
  /* Same other styles */
}
```

### Cards
```css
.dm-card {
  background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
  border: 1px solid rgba(168, 85, 247, 0.2);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.dm-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.5);
}

.dm-card-header {
  border-bottom: 1px solid rgba(168, 85, 247, 0.1);
  padding-bottom: 16px;
  margin-bottom: 16px;
}
```

### Progress Bars
```css
.dm-progress {
  background: rgba(148, 163, 184, 0.2);
  border-radius: 9999px;
  height: 12px;
  overflow: hidden;
}

.dm-progress-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.6s ease;
}

/* Gradient based on score */
.dm-progress-high {
  background: linear-gradient(90deg, #10B981 0%, #22C55E 100%);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
}

.dm-progress-medium {
  background: linear-gradient(90deg, #F97316 0%, #FB923C 100%);
  box-shadow: 0 0 12px rgba(249, 115, 22, 0.5);
}

.dm-progress-low {
  background: linear-gradient(90deg, #EF4444 0%, #F87171 100%);
}
```

### Status Badges
```css
.dm-badge-active {
  background: linear-gradient(135deg, #10B981 0%, #22C55E 100%);
  color: white;
  padding: 6px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dm-badge-active::before {
  content: '';
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.dm-badge-idle {
  background: linear-gradient(135deg, #F97316 0%, #FB923C 100%);
  /* Same other styles */
}

.dm-badge-offline {
  background: linear-gradient(135deg, #64748B 0%, #94A3B8 100%);
  /* Same other styles */
}
```

---

## PAGE LAYOUTS

### Header/Navigation
```jsx
<header className="dm-header">
  <div className="container">
    <img src="/dm-logo-horizontal.png" alt="Design Musketeer" className="logo" />
    <nav className="dm-nav">
      <a href="/dashboard">Dashboard</a>
      <a href="/employees">Employees</a>
      <a href="/reports">Reports</a>
    </nav>
    <div className="user-menu">
      <span className="user-name">ishfak</span>
      <div className="avatar">IS</div>
    </div>
  </div>
</header>

<style>
.dm-header {
  background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
  border-bottom: 2px solid rgba(168, 85, 247, 0.3);
  padding: 16px 0;
}

.dm-nav a {
  color: #94A3B8;
  font-weight: 500;
  transition: color 0.3s;
}

.dm-nav a:hover,
.dm-nav a.active {
  color: #A855F7;
}

.avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #A855F7 0%, #C084FC 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: white;
}
</style>
```

### Dashboard Stats Grid
```jsx
<div className="dm-stats-grid">
  <StatCard 
    gradient="linear-gradient(135deg, #10B981 0%, #22C55E 100%)"
    icon="👥"
    value="3"
    label="Active Now"
    subtext="of 4 employees"
  />
  <StatCard 
    gradient="linear-gradient(135deg, #F97316 0%, #FB923C 100%)"
    icon="😴"
    value="0"
    label="Idle"
  />
  <StatCard 
    gradient="linear-gradient(135deg, #64748B 0%, #94A3B8 100%)"
    icon="⚫"
    value="1"
    label="Offline"
  />
  <StatCard 
    gradient="linear-gradient(135deg, #06B6D4 0%, #22D3EE 100%)"
    icon="📸"
    value="127"
    label="Screenshots"
    subtext="today"
  />
</div>

<style>
.dm-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--gradient);
  border-radius: 16px;
  padding: 24px;
  color: white;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
}

.stat-value {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 8px;
}
</style>
```

### Employee Cards (Branded)
```jsx
<div className="dm-employee-card">
  {/* Header with Avatar */}
  <div className="card-header">
    <div className="employee-info">
      <div className="dm-avatar">
        <span>IS</span>
        <div className="avatar-ring"></div>
      </div>
      <div>
        <h3 className="employee-name">ishfak</h3>
        <p className="employee-role">Full Stack Developer</p>
      </div>
    </div>
    <div className="dm-badge-active">
      <span className="pulse-dot"></span>
      Active
    </div>
  </div>
  
  {/* Productivity Section */}
  <div className="productivity-showcase">
    <div className="productivity-circle">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" className="track" />
        <circle cx="50" cy="50" r="40" className="progress" 
                style="stroke-dashoffset: 25" />
      </svg>
      <div className="score">78%</div>
    </div>
    <div className="productivity-details">
      <h4>Productivity Score</h4>
      <p className="trend">↗ +5% vs yesterday</p>
    </div>
  </div>
  
  {/* Quick Stats */}
  <div className="dm-quick-stats">
    <div className="stat-item">
      <div className="stat-icon purple">⏱️</div>
      <div>
        <div className="stat-value">20m</div>
        <div className="stat-label">Active</div>
      </div>
    </div>
    <div className="stat-item">
      <div className="stat-icon orange">📸</div>
      <div>
        <div className="stat-value">47</div>
        <div className="stat-label">Shots</div>
      </div>
    </div>
    <div className="stat-item">
      <div className="stat-icon cyan">⌨️</div>
      <div>
        <div className="stat-value">3.4k</div>
        <div className="stat-label">Keys</div>
      </div>
    </div>
  </div>
  
  {/* Current Activity */}
  <div className="current-activity-banner">
    <div className="app-icon">💻</div>
    <div className="activity-info">
      <div className="app-name">VS Code</div>
      <div className="activity-time">Active now</div>
    </div>
    <div className="activity-pulse"></div>
  </div>
  
  {/* Action Button */}
  <button className="dm-btn-expand">
    View Details
    <span className="arrow">→</span>
  </button>
</div>

<style>
.dm-employee-card {
  background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
  border: 1px solid rgba(168, 85, 247, 0.2);
  border-radius: 20px;
  padding: 28px;
  position: relative;
  overflow: hidden;
}

.dm-employee-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #A855F7 0%, #F97316 50%, #06B6D4 100%);
}

.dm-avatar {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #A855F7 0%, #C084FC 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: white;
  position: relative;
}

.avatar-ring {
  position: absolute;
  inset: -4px;
  border: 2px solid #A855F7;
  border-radius: 50%;
  animation: rotate 3s linear infinite;
  opacity: 0.5;
}

.productivity-circle {
  position: relative;
  width: 120px;
  height: 120px;
}

.productivity-circle svg {
  transform: rotate(-90deg);
}

.productivity-circle .track {
  fill: none;
  stroke: rgba(168, 85, 247, 0.1);
  stroke-width: 8;
}

.productivity-circle .progress {
  fill: none;
  stroke: url(#gradient);
  stroke-width: 8;
  stroke-dasharray: 251.2;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
}

.score {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, #A855F7 0%, #F97316 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.stat-icon.purple {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(192, 132, 252, 0.2) 100%);
}

.stat-icon.orange {
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(251, 146, 60, 0.2) 100%);
}

.stat-icon.cyan {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(34, 211, 238, 0.2) 100%);
}

.current-activity-banner {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%);
  border-left: 3px solid #A855F7;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
}

.activity-pulse {
  width: 12px;
  height: 12px;
  background: #10B981;
  border-radius: 50%;
  animation: pulse 2s infinite;
  margin-left: auto;
}

.dm-btn-expand {
  width: 100%;
  background: linear-gradient(135deg, #A855F7 0%, #C084FC 100%);
  color: white;
  padding: 14px;
  border-radius: 12px;
  border: none;
  font-weight: 600;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.dm-btn-expand:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(168, 85, 247, 0.4);
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.1); }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
```

---

## CHARTS & VISUALIZATIONS

### Pie Chart Colors (For App Breakdown)
```javascript
const DM_CHART_COLORS = [
  '#A855F7',  // Purple - Primary app
  '#F97316',  // Orange - Secondary app
  '#06B6D4',  // Cyan - Third app
  '#10B981',  // Green - Fourth app
  '#EF4444',  // Red - Other/Unexpected apps
];
```

### Bar Chart Styling
```css
.dm-bar-chart {
  background: rgba(168, 85, 247, 0.05);
  border-radius: 12px;
  padding: 20px;
}

.dm-bar {
  background: linear-gradient(180deg, #A855F7 0%, #F97316 100%);
  border-radius: 4px;
  transition: all 0.3s ease;
}

.dm-bar:hover {
  filter: brightness(1.2);
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4);
}
```

---

## ANIMATIONS

```css
/* Page Transitions */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dm-fade-in {
  animation: fadeInUp 0.6s ease;
}

/* Gradient Animation */
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.dm-gradient-animated {
  background-size: 200% 200%;
  animation: gradientShift 3s ease infinite;
}

/* Loading Spinner */
.dm-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(168, 85, 247, 0.2);
  border-top-color: #A855F7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Brand Assets
- [ ] Add Design Musketeer logo to /public/
- [ ] Install Greater Neue font files in /public/fonts/
- [ ] Create brand color CSS variables
- [ ] Set up design token system

### Phase 2: Core Components
- [ ] Redesign buttons with purple gradients
- [ ] Update card components with brand styling
- [ ] Create branded progress bars
- [ ] Build status badges with animations

### Phase 3: Layouts
- [ ] Redesign header with DM logo
- [ ] Update stats grid with gradient cards
- [ ] Rebuild employee cards with brand identity
- [ ] Add purple accent borders throughout

### Phase 4: Charts
- [ ] Apply DM colors to pie charts
- [ ] Style bar charts with gradients
- [ ] Add hover effects with brand colors

### Phase 5: Polish
- [ ] Add gradient animations
- [ ] Implement loading states with brand colors
- [ ] Test dark mode with DM colors
- [ ] Add subtle glow effects on interactive elements

---

## BRAND VOICE

**Design Musketeer Tagline:** "We are, All you Need"

**Services:**
- Visual & Motion Studio
- Growth & Strategy
- Web & SaaS Dev
- Brand & Creative
- Comprehensive POD Service
- AI Automation

**Tone:** Modern, creative, confident, professional with a playful edge.

Use this brand identity to make the Activity Monitor feel like a premium Design Musketeer product.
