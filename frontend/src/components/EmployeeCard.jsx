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

export default function EmployeeCard({ emp }) {
  const navigate = useNavigate()
  const score = emp.productivity_today ?? 0
  const scoreColor = score >= 70 ? 'text-green-400' : score >= 45 ? 'text-yellow-400' : 'text-red-400'
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

  return (
    <div
      className="bg-slate-800 rounded-xl p-4 cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700 hover:border-slate-500"
      onClick={() => navigate(`/employee/${emp.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-white">{emp.name}</p>
          <p className="text-slate-400 text-xs">{emp.role || 'Employee'}</p>
        </div>
        <StatusBadge status={emp.status} />
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Productivity</span>
          <span className={`font-bold ${scoreColor}`}>{score}%</span>
        </div>
        <ProgressBar value={score} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mt-3">
        <span>⏱ {fmt(emp.active_minutes_today || 0)} active</span>
        <span>📸 {emp.screenshots_today || 0} shots</span>
        {emp.current_app && <span className="col-span-2 truncate">💻 {emp.current_app}</span>}
        <span className="col-span-2">🕐 {timeAgo(emp.last_seen)}</span>
      </div>

      <button
        onClick={toggleControl}
        disabled={busy}
        className={`mt-3 w-full py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50
          ${agentStatus === 'running'
            ? 'bg-slate-700 hover:bg-red-900/50 text-slate-300 hover:text-red-300'
            : 'bg-slate-700 hover:bg-green-900/50 text-slate-300 hover:text-green-300'}`}
      >
        {busy ? '…' : agentStatus === 'running' ? '⏸ Pause Agent' : '▶ Resume Agent'}
      </button>
    </div>
  )
}
