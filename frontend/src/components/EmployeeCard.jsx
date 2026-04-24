import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import StatusBadge from './StatusBadge'
import ProgressBar from './ProgressBar'

function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

function timeAgo(ts) {
  if (!ts) return 'Never'
  const diff = Math.round((Date.now() - new Date(ts)) / 60000)
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  return `${Math.floor(diff / 60)}h ago`
}

function CircleScore({ score }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 70 ? '#10B981' : score >= 45 ? '#F97316' : '#EF4444'
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-24 h-24" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.7s ease', filter: `drop-shadow(0 0 6px ${color}80)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-800">{score}%</span>
        <span className="text-xs text-slate-500">score</span>
      </div>
    </div>
  )
}

export default function EmployeeCard({ emp }) {
  const navigate = useNavigate()
  const score = emp.productivity_today ?? 0
  const [agentStatus, setAgentStatus] = useState(emp.agent_status || 'running')
  const [busy, setBusy] = useState(false)

  async function toggleControl(e) {
    e.stopPropagation()
    const next = agentStatus === 'running' ? 'stopped' : 'running'
    setBusy(true)
    try {
      await api.setAgentControl(emp.id, next)
      setAgentStatus(next)
    } catch (_) {}
    setBusy(false)
  }

  const initials = (emp.name || 'EM').slice(0, 2).toUpperCase()

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 bg-white"
      style={{
        border: '1px solid rgba(168,85,247,0.15)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 24px rgba(168,85,247,0.2)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
      onClick={() => navigate(`/employee/${emp.id}`)}
    >
      {/* Top gradient stripe */}
      <div className="absolute top-0 left-0 right-0 h-1"
           style={{ background: 'linear-gradient(90deg, #A855F7 0%, #F97316 50%, #06B6D4 100%)' }} />

      <div className="pt-5 px-5 pb-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #A855F7 0%, #C084FC 100%)' }}>
              {initials}
            </div>
            <div>
              <p className="font-semibold text-slate-900 leading-tight">{emp.name}</p>
              <p className="text-slate-500 text-xs mt-0.5">{emp.role || 'Employee'}</p>
            </div>
          </div>
          <StatusBadge status={emp.status} />
        </div>

        {/* Score + quick stats */}
        <div className="flex items-center gap-4 mb-4">
          <CircleScore score={score} />
          <div className="flex-1 space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-base"
                    style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.12),rgba(192,132,252,0.12))' }}>⏱</span>
              <span>{fmt(emp.active_minutes_today || 0)} active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-base"
                    style={{ background: 'linear-gradient(135deg,rgba(6,182,212,0.12),rgba(34,211,238,0.12))' }}>📸</span>
              <span>{emp.screenshots_today || 0} screenshots</span>
            </div>
            {emp.current_app && (
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-base"
                      style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(251,146,60,0.12))' }}>💻</span>
                <span className="truncate max-w-[100px]">{emp.current_app}</span>
              </div>
            )}
          </div>
        </div>

        {/* Last seen */}
        <div className="text-xs text-slate-400 mb-3">🕐 {timeAgo(emp.last_seen)}</div>

        {/* Agent control button */}
        <button
          onClick={toggleControl}
          disabled={busy}
          className="w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-50"
          style={{
            background: agentStatus === 'running'
              ? 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)'
              : 'linear-gradient(135deg, #10B981 0%, #22C55E 100%)',
            color: 'white',
          }}
        >
          {busy ? '…' : agentStatus === 'running' ? '⏸ Pause Agent' : '▶ Resume Agent'}
        </button>
      </div>
    </div>
  )
}
