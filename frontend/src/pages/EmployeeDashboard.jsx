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

  const [status, setStatus]           = useState(null)
  const [dash, setDash]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [lastUpdate, setLastUpdate]   = useState(null)
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
    fetch(`/agent/${id}/control`, { headers: { 'x-admin-key': session.admin_key || '' } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAgentStatus(d.status) })
      .catch(() => {})
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
  const initials = (emp.name || 'EM').slice(0, 2).toUpperCase()

  const activityColor =
    status?.activity_level === 'high'   ? '#10B981' :
    status?.activity_level === 'medium' ? '#F97316' :
    status?.activity_level === 'low'    ? '#06B6D4' : '#94A3B8'

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10"
           style={{ borderBottomColor: 'rgba(168,85,247,0.2)', boxShadow: '0 1px 12px rgba(168,85,247,0.08)' }}>
        <div className="flex items-center gap-3">
          {isManager && (
            <button onClick={() => navigate('/admin')}
                    className="text-sm font-medium transition-colors"
                    style={{ color: '#A855F7' }}>
              ← Team
            </button>
          )}
          <img src="/images/dm-logo.png" alt="DM" className="h-7 object-contain"
               onError={e => { e.target.style.display='none' }} />
          <div>
            <h1 className="text-lg font-bold text-slate-900">{emp.name || 'My Dashboard'}</h1>
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
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
              style={{
                background: agentStatus === 'running'
                  ? 'linear-gradient(135deg,#EF4444,#F87171)'
                  : 'linear-gradient(135deg,#10B981,#22C55E)',
              }}
            >
              {controlLoading ? '…' : agentStatus === 'running' ? '⏸ Pause' : '▶ Resume'}
            </button>
          )}
          {!isManager && (
            <>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                   style={{ background: 'linear-gradient(135deg, #A855F7 0%, #C084FC 100%)' }}>
                {initials}
              </div>
              <button onClick={logout} className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
                Sign out
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 dm-fade-in">
        {loading ? (
          <p className="text-slate-400 text-center py-16">Loading…</p>
        ) : (
          <>
            {/* Live status card */}
            {status && (
              <div className="rounded-2xl p-5 mb-5 bg-white"
                   style={{
                     borderLeft: '4px solid #A855F7',
                     border: '1px solid rgba(168,85,247,0.15)',
                     boxShadow: '0 2px 12px rgba(168,85,247,0.06)',
                   }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Current App</p>
                    <p className="text-slate-900 font-semibold text-lg">{status.current_app || '—'}</p>
                    {status.current_window && (
                      <p className="text-slate-400 text-xs truncate max-w-xs mt-0.5">{status.current_window}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Activity</p>
                    <p className="font-bold capitalize text-lg" style={{ color: activityColor }}>
                      {status.activity_level || '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            {dash && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Productivity" value={`${dash.productivity_score}%`} icon="📈"
                          gradient="linear-gradient(135deg, #A855F7 0%, #C084FC 100%)" />
                <StatCard label="Active Time"  value={fmt(dash.active_minutes)} icon="⏱"
                          gradient="linear-gradient(135deg, #10B981 0%, #22C55E 100%)" />
                <StatCard label="Focus Score"  value={`${dash.avg_focus}/100`} icon="🎯"
                          gradient="linear-gradient(135deg, #06B6D4 0%, #22D3EE 100%)" />
                <StatCard label="Screenshots"  value={dash.total_screenshots} icon="📸"
                          sub={`${dash.analyzed} analyzed`}
                          gradient="linear-gradient(135deg, #F97316 0%, #FB923C 100%)" />
              </div>
            )}

            {/* Productivity bar */}
            {dash && (
              <div className="rounded-2xl p-5 mb-5 bg-white"
                   style={{ border: '1px solid rgba(168,85,247,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div className="flex justify-between text-sm mb-3">
                  <span className="font-semibold text-slate-700">Today's Productivity</span>
                  <span className="font-bold text-slate-900">{dash.productivity_score}%</span>
                </div>
                <ProgressBar value={dash.productivity_score} />
                {Object.keys(dash.productivity_breakdown || {}).length > 0 && (
                  <div className="flex gap-4 mt-3 text-xs text-slate-500">
                    {Object.entries(dash.productivity_breakdown).map(([k, v]) => (
                      <span key={k}>{k}: {v}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* App breakdown */}
            {dash?.app_breakdown?.length > 0 && (
              <div className="rounded-2xl p-5 mb-5 bg-white"
                   style={{ border: '1px solid rgba(168,85,247,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <h2 className="text-sm font-semibold text-slate-700 mb-4">App Breakdown</h2>
                <div className="space-y-4">
                  {dash.app_breakdown.map(({ app, minutes }) => {
                    const maxMins = dash.app_breakdown[0].minutes
                    return (
                      <div key={app}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-medium text-slate-800">{app}</span>
                          <span className="text-slate-500">{fmt(minutes)}</span>
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
              <div className="rounded-2xl p-5 bg-white"
                   style={{ border: '1px solid rgba(168,85,247,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Hourly Activity</h2>
                <ActivityChart hourly={dash.hourly_activity} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
