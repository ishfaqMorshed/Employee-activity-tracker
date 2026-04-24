import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { getAppMeta, scoreColor, activityColor } from '../utils/appUtils'

function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

function ScoreRing({ score, size = 56 }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(score, 100) / 100) * circ
  const color = scoreColor(score)
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>{score}%</span>
      </div>
    </div>
  )
}

export default function EmployeeCard({ emp }) {
  const navigate = useNavigate()
  const score = emp.productivity_today ?? 0
  const [agentStatus, setAgentStatus] = useState(emp.agent_status || 'running')
  const [busy, setBusy] = useState(false)
  const appMeta = getAppMeta(emp.current_app)
  const initials = (emp.name || 'EM').slice(0, 2).toUpperCase()

  const statusDot = { active: '#10B981', idle: '#F59E0B', offline: '#94A3B8' }[emp.status] ?? '#94A3B8'
  const isTracking = emp.is_tracking

  async function toggleControl(e) {
    e.stopPropagation()
    const next = agentStatus === 'running' ? 'stopped' : 'running'
    setBusy(true)
    try { await api.setAgentControl(emp.id, next); setAgentStatus(next) } catch (_) {}
    setBusy(false)
  }

  return (
    <div
      className="bg-white rounded-xl overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
      style={{ border: '1px solid #E2E8F0' }}
      onClick={() => navigate(`/employee/${emp.id}`)}
    >
      {/* Tracking indicator bar */}
      <div className="h-0.5 w-full" style={{
        background: isTracking ? '#10B981' : '#E2E8F0'
      }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold bg-slate-700">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                  style={{ background: statusDot }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{emp.name}</p>
            <p className="text-slate-400 text-xs truncate">{emp.role || 'Employee'}</p>
          </div>
          <ScoreRing score={score} />
        </div>

        {/* Tracking badge */}
        <div className="flex items-center gap-1.5 mb-3">
          <span className={`text-xs font-medium ${isTracking ? 'text-emerald-600' : 'text-slate-400'}`}>
            {isTracking ? '● Tracking' : '○ Not tracking'}
          </span>
          {isTracking && emp.activity_level && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{ background: activityColor(emp.activity_level) + '20', color: activityColor(emp.activity_level) }}>
              {emp.activity_level}
            </span>
          )}
        </div>

        {/* Current app */}
        {emp.current_app ? (
          <div className="flex items-center gap-2 p-2 rounded-lg mb-3 text-xs"
               style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <span className="text-base leading-none">{appMeta.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-700">{appMeta.name}</div>
              {emp.current_window && (
                <div className="text-slate-400 truncate">{emp.current_window}</div>
              )}
            </div>
            {emp.status === 'active' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            )}
          </div>
        ) : (
          <div className="p-2 rounded-lg mb-3 text-xs text-slate-400 text-center"
               style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            No recent activity
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-1 text-center mb-3">
          {[
            { label: 'Active', value: fmt(emp.active_minutes_today || 0) },
            { label: 'Shots',  value: emp.screenshots_today || 0 },
            { label: 'Keys',   value: (emp.keyboard_today || 0) > 999 ? `${((emp.keyboard_today||0)/1000).toFixed(1)}k` : (emp.keyboard_today || 0) },
            { label: 'Clicks', value: emp.mouse_today || 0 },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg py-1.5" style={{ background: '#F8FAFC' }}>
              <div className="text-xs font-semibold text-slate-700">{value}</div>
              <div className="text-slate-400" style={{ fontSize: 10 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* App breakdown mini bars */}
        {emp.app_breakdown?.slice(0, 3).length > 0 && (
          <div className="space-y-1 mb-3">
            {emp.app_breakdown.slice(0, 3).map((a) => {
              const meta = getAppMeta(a.app)
              return (
                <div key={a.app} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-center">{meta.icon}</span>
                  <span className="text-slate-600 w-16 truncate">{meta.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-1.5 rounded-full" style={{ width: `${a.percentage}%`, background: meta.color }} />
                  </div>
                  <span className="text-slate-400 w-8 text-right">{a.minutes}m</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Pause/Resume */}
        <button
          onClick={toggleControl}
          disabled={busy}
          className="w-full py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
          style={{
            borderColor: agentStatus === 'running' ? '#FCA5A5' : '#6EE7B7',
            color: agentStatus === 'running' ? '#EF4444' : '#10B981',
            background: agentStatus === 'running' ? '#FEF2F2' : '#F0FDF4',
          }}
        >
          {busy ? '…' : agentStatus === 'running' ? '⏸ Pause Agent' : '▶ Resume Agent'}
        </button>
      </div>
    </div>
  )
}
