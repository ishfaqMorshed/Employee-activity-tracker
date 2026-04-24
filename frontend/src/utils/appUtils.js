export const APP_META = {
  'chrome':      { name: 'Chrome',      icon: '🌐', color: '#4285F4' },
  'firefox':     { name: 'Firefox',     icon: '🦊', color: '#FF6611' },
  'edge':        { name: 'Edge',        icon: '🔵', color: '#0078D7' },
  'code':        { name: 'VS Code',     icon: '💙', color: '#007ACC' },
  'vscode':      { name: 'VS Code',     icon: '💙', color: '#007ACC' },
  'pycharm':     { name: 'PyCharm',     icon: '🐍', color: '#21D789' },
  'pycharm64':   { name: 'PyCharm',     icon: '🐍', color: '#21D789' },
  'slack':       { name: 'Slack',       icon: '💬', color: '#4A154B' },
  'teams':       { name: 'Teams',       icon: '🟣', color: '#6264A7' },
  'zoom':        { name: 'Zoom',        icon: '📹', color: '#2D8CFF' },
  'figma':       { name: 'Figma',       icon: '🎨', color: '#F24E1E' },
  'photoshop':   { name: 'Photoshop',   icon: '🖼️', color: '#31A8FF' },
  'illustrator': { name: 'Illustrator', icon: '🔶', color: '#FF9A00' },
  'sketch':      { name: 'Sketch',      icon: '💎', color: '#F7B500' },
  'winword':     { name: 'Word',        icon: '📝', color: '#2B579A' },
  'excel':       { name: 'Excel',       icon: '📊', color: '#217346' },
  'powerpnt':    { name: 'PowerPoint',  icon: '📋', color: '#D24726' },
  'outlook':     { name: 'Outlook',     icon: '📧', color: '#0072C6' },
  'postman':     { name: 'Postman',     icon: '📮', color: '#FF6C37' },
  'terminal':    { name: 'Terminal',    icon: '⬛', color: '#2D2D2D' },
  'cmd':         { name: 'CMD',         icon: '⬛', color: '#2D2D2D' },
  'powershell':  { name: 'PowerShell',  icon: '🔷', color: '#012456' },
  'explorer':    { name: 'Explorer',    icon: '📁', color: '#FFC107' },
  'notepad':     { name: 'Notepad',     icon: '📄', color: '#94A3B8' },
  'employeemonitor': { name: 'Activity Monitor', icon: '👁️', color: '#A855F7' },
  'lockapp':     { name: 'Lock Screen', icon: '🔒', color: '#94A3B8' },
  'taskmgr':     { name: 'Task Mgr',   icon: '⚙️', color: '#64748B' },
}

export function getAppMeta(processName) {
  if (!processName) return { name: 'Unknown', icon: '⬜', color: '#94A3B8' }
  const key = processName.toLowerCase().replace(/\.exe$/, '')
  return APP_META[key] || { name: processName.replace(/\.exe$/i, ''), icon: '⬜', color: '#94A3B8' }
}

export function scoreColor(score) {
  if (score >= 70) return '#10B981'
  if (score >= 45) return '#F59E0B'
  return '#EF4444'
}

export function activityColor(level) {
  return { high: '#10B981', medium: '#F59E0B', low: '#94A3B8', idle: '#CBD5E1' }[level] ?? '#CBD5E1'
}
