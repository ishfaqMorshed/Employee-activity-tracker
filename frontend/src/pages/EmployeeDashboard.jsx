import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import ProgressBar from '../components/ProgressBar'
import StatCard from '../components/StatCard'
import ActivityChart from '../components/ActivityChart'

const POLL_MS = 30000

function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export default function EmployeeDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = JSON.parse(localStorage.getItem('session') || '{}')
  const isManager = session.is_manager

  const [status, setStatus]     = useState(null)
  const [dash, setDash]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [agentStatus, setAgentStatus] = useState('running')
  const [controlLoading, setControlLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([api.employeeStatus(id), api.employeeDashboard(id)])
      setStatus(s)
      setDash(d)
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, POLL_MS)
    return () => clearInterval(t)
  }, [fetchAll])

  useEffect(() => {
    if (!isManager) return
    // fetch current agent control state using admin key
    fetch(`/agent/${id}/control`, {
      headers: { 'x-admin-key': session.admin_key || '' }
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (d) setAgentStatus(d.status)
    }).catch(() => {})
  }, [id, isManager])

  async function toggleAgentControl() {
    const next = agentStatus === 'running' ? 'stopped' : 'running'
    setControlLoading(true)
    try {
      await api.setAgentControl(id, next)
      setAgentStatus(next)
    } catch (e) {
      console.error('Control failed:', e)
    } finally {
      setControlLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('session')
    navigate('/login')
  }

  const emp = session.employee || {}

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isManager && (
            <button onClick={() => navigate('/manager')} className="text-slate-400 hover:text-white text-sm transition-colors">
              ← Team
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-white">{emp.name || 'My Dashboard'}</h1>
            <p className="text-slate-400 text-xs">
              {emp.role || 'Employee'} · {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status && <StatusBadge status={status.status} />}
          {isManager && (
            <button
              onClick={toggleAgentControl}
              disabled={controlLoading}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50
                ${agentStatus === 'running'
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-green-600 hover:bg-green-500 text-white'}`}
            >
              {controlLoading ? '…' : agentStatus === 'running' ? '⏸ Pause Agent' : '▶ Resume Agent'}
            </button>
          )}
          {!isManager && (
            <button onClick={logout} className="text-xs text-slate-500 hover:text-white transition-colors">
              Sign out
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {loading ? (
          <p className="text-slate-400 text-center py-16">Loading…</p>
        ) : (
          <>
            {/* Live status bar */}
            {status && (
              <div className="bg-slate-800 rounded-xl p-4 mb-5 flex items-center justify-between border border-slate-700">
                <div>
                  <p className="text-sm text-slate-400">Current App</p>
                  <p className="text-white font-medium">{status.current_app || '—'}</p>
                  {status.current_window && (
                    <p className="text-slate-400 text-xs truncate max-w-xs">{status.current_window}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Activity</p>
                  <p className={`font-semibold capitalize ${
                    status.activity_level === 'high' ? 'text-green-400' :
                    status.activity_level === 'medium' ? 'text-yellow-400' :
                    status.activity_level === 'low' ? 'text-orange-400' : 'text-slate-400'
                  }`}>
                    {status.activity_level || '—'}
                  </p>
                </div>
              </div>
            )}

            {/* Stats */}
            {dash && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Productivity"  value={`${dash.productivity_score}%`} icon="📈" />
                <StatCard label="Active Time"   value={fmt(dash.active_minutes)}       icon="⏱" />
                <StatCard label="Focus Score"   value={`${dash.avg_focus}/100`}        icon="🎯" />
                <StatCard label="Screenshots"   value={dash.total_screenshots}          icon="📸" sub={`${dash.analyzed} analyzed`} />
              </div>
            )}

            {/* Productivity bar */}
            {dash && (
              <div className="bg-slate-800 rounded-xl p-5 mb-5 border border-slate-700">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Today's Productivity</span>
                  <span className="font-bold text-white">{dash.productivity_score}%</span>
                </div>
                <ProgressBar value={dash.productivity_score} />
                <div className="flex gap-4 mt-3 text-xs text-slate-400">
                  {Object.entries(dash.productivity_breakdown || {}).map(([k, v]) => (
                    <span key={k}>{k}: {v}</span>
                  ))}
                </div>
              </div>
            )}

            {/* App breakdown */}
            {dash?.app_breakdown?.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-5 mb-5 border border-slate-700">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">App Breakdown</h2>
                <div className="space-y-3">
                  {dash.app_breakdown.map(({ app, minutes }) => {
                    const maxMins = dash.app_breakdown[0].minutes
                    return (
                      <div key={app}>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span className="font-medium text-white">{app}</span>
                          <span>{fmt(minutes)}</span>
                        </div>
                        <ProgressBar value={minutes} max={maxMins} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Hourly chart */}
            {dash?.hourly_activity?.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Hourly Activity</h2>
                <ActivityChart hourly={dash.hourly_activity} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
