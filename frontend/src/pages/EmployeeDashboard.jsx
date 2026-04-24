import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import ActivityChart from '../components/ActivityChart'
import { getAppMeta, scoreColor, activityColor } from '../utils/appUtils'

const POLL_MS = 4000

function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

function ScoreRing({ score, size = 72 }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(score, 100) / 100) * circ
  const color = scoreColor(score)
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{score}%</span>
        <span className="text-slate-400" style={{ fontSize: 9 }}>score</span>
      </div>
    </div>
  )
}

export default function EmployeeDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = JSON.parse(localStorage.getItem('session') || '{}')
  const isAdmin = session.is_manager

  const [status, setStatus]         = useState(null)
  const [dash, setDash]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

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

  function logout() {
    localStorage.removeItem('session')
    navigate('/login')
  }

  const emp = session.employee || {}
  const initials = (emp.name || 'EM').slice(0, 2).toUpperCase()
  const currentAppMeta = getAppMeta(status?.current_app)
  const statusDot = { active: '#10B981', idle: '#F59E0B', offline: '#94A3B8' }[status?.status] ?? '#94A3B8'
  const statusLabel = { active: 'Active', idle: 'Idle', offline: 'Offline' }[status?.status] ?? '—'
  const score = status?.productivity_today ?? 0

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10"
           style={{ borderColor: '#E2E8F0' }}>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button onClick={() => navigate('/admin')}
                    className="text-sm font-medium transition-colors"
                    style={{ color: '#A855F7' }}>
              ← Team
            </button>
          )}
          <img src="/images/dm-logo.png" alt="DM" className="h-7 object-contain"
               onError={e => { e.target.style.display='none' }} />
          <div>
            <h1 className="text-base font-semibold text-slate-800">{emp.name || 'My Dashboard'}</h1>
            <p className="text-slate-400 text-xs">
              {emp.role || 'Employee'} · {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading…'} · refreshes every 4s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          {!isAdmin && (
            <button onClick={logout} className="text-xs text-slate-400 hover:text-slate-600">Sign out</button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-5">
        {loading ? (
          <p className="text-slate-400 text-center py-16 text-sm">Loading…</p>
        ) : (
          <>
            {/* Profile + score summary */}
            <div className="bg-white rounded-xl border p-5 mb-5 flex items-center gap-5"
                 style={{ borderColor: '#E2E8F0' }}>
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-white text-lg font-semibold">
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
                      style={{ background: statusDot }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-base">{emp.name}</p>
                <p className="text-slate-400 text-sm">{emp.role || 'Employee'}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: statusDot }} />
                  <span className="text-xs font-medium text-slate-600">{statusLabel}</span>
                  {status?.activity_level && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium ml-1"
                          style={{ background: activityColor(status.activity_level) + '20', color: activityColor(status.activity_level) }}>
                      {status.activity_level}
                    </span>
                  )}
                </div>
              </div>
              <ScoreRing score={score} />
            </div>

            {/* Stats strip */}
            <div className="bg-white rounded-xl border p-4 mb-5 grid grid-cols-2 md:grid-cols-5 gap-4"
                 style={{ borderColor: '#E2E8F0' }}>
              {[
                { label: 'Active Today', value: fmt(status?.active_minutes_today || 0), color: '#10B981' },
                { label: 'Screenshots',  value: status?.screenshots_today || 0, color: '#A855F7' },
                { label: 'Keystrokes',   value: (status?.keyboard_today || 0) > 999
                    ? `${((status?.keyboard_today||0)/1000).toFixed(1)}k`
                    : (status?.keyboard_today || 0), color: '#6366F1' },
                { label: 'Clicks',       value: status?.mouse_today || 0, color: '#06B6D4' },
                { label: 'Productivity', value: `${score}%`, color: scoreColor(score) },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <div className="text-xl font-bold" style={{ color }}>{value}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Current activity */}
            {status && (
              <div className="bg-white rounded-xl border p-4 mb-5"
                   style={{ borderColor: '#E2E8F0' }}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Current Activity</p>
                {status.current_app ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                         style={{ background: currentAppMeta.color + '15' }}>
                      {currentAppMeta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{currentAppMeta.name}</p>
                      {status.current_window && (
                        <p className="text-slate-400 text-xs truncate">{status.current_window}</p>
                      )}
                    </div>
                    {status.status === 'active' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">No recent activity</p>
                )}
              </div>
            )}

            {/* App breakdown */}
            {status?.app_breakdown?.length > 0 && (
              <div className="bg-white rounded-xl border p-4 mb-5"
                   style={{ borderColor: '#E2E8F0' }}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">App Breakdown Today</p>
                <div className="space-y-2.5">
                  {status.app_breakdown.map((a) => {
                    const meta = getAppMeta(a.app)
                    return (
                      <div key={a.app} className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-center text-base leading-none flex-shrink-0">{meta.icon}</span>
                        <span className="text-slate-700 w-24 truncate flex-shrink-0">{meta.name}</span>
                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-2 rounded-full transition-all duration-500"
                               style={{ width: `${a.percentage}%`, background: meta.color }} />
                        </div>
                        <span className="text-slate-400 text-xs w-8 text-right flex-shrink-0">{a.minutes}m</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Hourly chart */}
            {dash?.hourly_activity?.length > 0 && (
              <div className="bg-white rounded-xl border p-4"
                   style={{ borderColor: '#E2E8F0' }}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Hourly Activity</p>
                <ActivityChart hourly={dash.hourly_activity} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
