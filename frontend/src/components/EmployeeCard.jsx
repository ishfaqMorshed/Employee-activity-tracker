import { useState } from 'react'
import { api } from '../api/client'
import StatusBadge from './StatusBadge'
import EmployeeDetailModal from './EmployeeDetailModal'

function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

function CircleRing({ score, size = 110 }) {
  const r = (size - 14) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(score, 100) / 100) * circ
  const color = score >= 70 ? '#10B981' : score >= 45 ? '#F97316' : '#EF4444'
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
                stroke="rgba(148,163,184,0.15)" strokeWidth="7" />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
                stroke={color} strokeWidth="7"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 5px ${color}80)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold leading-none" style={{ fontSize: size * 0.22, color }}>{score}%</span>
        <span className="text-slate-400 leading-none mt-0.5" style={{ fontSize: size * 0.1 }}>score</span>
      </div>
    </div>
  )
}

export default function EmployeeCard({ emp }) {
  const score = emp.productivity_today ?? 0
  const [agentStatus, setAgentStatus] = useState(emp.agent_status || 'running')
  const [busy, setBusy] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const initials = (emp.name || 'EM').slice(0, 2).toUpperCase()

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

  return (
    <>
      <div
        className="relative rounded-2xl overflow-hidden bg-white cursor-pointer transition-all duration-300 hover:-translate-y-1 flex flex-col"
        style={{ border: '1px solid rgba(168,85,247,0.15)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 12px 32px rgba(168,85,247,0.18)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'}
        onClick={() => setModalOpen(true)}
      >
        {/* Top stripe */}
        <div className="h-1 w-full"
             style={{ background: 'linear-gradient(90deg,#A855F7 0%,#F97316 50%,#06B6D4 100%)' }} />

        <div className="p-5 flex flex-col flex-1 gap-4">
          {/* Row 1: avatar + name + status */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg,#A855F7,#C084FC)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 leading-tight truncate">{emp.name}</p>
              <p className="text-slate-500 text-xs truncate">{emp.role || 'Employee'}</p>
            </div>
            <StatusBadge status={emp.status} />
          </div>

          {/* Row 2: circle + quick stats */}
          <div className="flex items-center gap-4">
            <CircleRing score={score} size={100} />
            <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              {[
                { icon: '⏱', label: 'Active',  value: fmt(emp.active_minutes_today || 0) },
                { icon: '📸', label: 'Shots',   value: emp.screenshots_today || 0 },
                { icon: '⌨️', label: 'Keys',    value: (emp.keyboard_today || 0) > 999 ? `${((emp.keyboard_today||0)/1000).toFixed(1)}k` : (emp.keyboard_today || 0) },
                { icon: '🖱️', label: 'Clicks',  value: emp.mouse_today || 0 },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span>{icon}</span>
                  <div>
                    <div className="font-semibold text-slate-800 leading-tight">{value}</div>
                    <div className="text-slate-400 leading-tight">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 3: current app */}
          {emp.current_app ? (
            <div className="rounded-xl p-3 flex items-start gap-2"
                 style={{ background: 'rgba(168,85,247,0.05)', borderLeft: '3px solid #A855F7' }}>
              <span className="text-lg leading-none">💻</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 leading-tight">{emp.current_app}</div>
                {emp.current_window && (
                  <div className="text-xs text-slate-400 truncate mt-0.5">{emp.current_window}</div>
                )}
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE
              </span>
            </div>
          ) : (
            <div className="rounded-xl p-3 text-center text-slate-400 text-xs"
                 style={{ background: '#F8FAFC' }}>No recent activity</div>
          )}

          {/* Row 4: action buttons */}
          <div className="flex gap-2 mt-auto">
            <button
              onClick={e => { e.stopPropagation(); setModalOpen(true) }}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg,#A855F7,#C084FC)', boxShadow: '0 2px 8px rgba(168,85,247,0.25)' }}
            >
              View Details →
            </button>
            <button
              onClick={toggleControl}
              disabled={busy}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
              style={{
                background: agentStatus === 'running'
                  ? 'linear-gradient(135deg,#EF4444,#F87171)'
                  : 'linear-gradient(135deg,#10B981,#22C55E)',
              }}
            >
              {busy ? '…' : agentStatus === 'running' ? '⏸' : '▶'}
            </button>
          </div>
        </div>
      </div>

      {modalOpen && <EmployeeDetailModal emp={emp} onClose={() => setModalOpen(false)} />}
    </>
  )
}
