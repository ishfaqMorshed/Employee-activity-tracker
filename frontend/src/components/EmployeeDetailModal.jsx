import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { api } from '../api/client'

const DM_COLORS = ['#A855F7', '#F97316', '#06B6D4', '#10B981', '#EF4444', '#F59E0B']

function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

function fmtTime(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}

function ActivityBadge({ level }) {
  const cfg = {
    high:   { bg: '#10B981', label: 'High' },
    medium: { bg: '#F97316', label: 'Medium' },
    low:    { bg: '#06B6D4', label: 'Low' },
    idle:   { bg: '#94A3B8', label: 'Idle' },
  }[level] ?? { bg: '#94A3B8', label: level || '—' }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
          style={{ background: cfg.bg }}>{cfg.label}</span>
  )
}

function Stat({ icon, value, label, color }) {
  return (
    <div className="rounded-2xl p-4 text-center"
         style={{ border: '1px solid rgba(168,85,247,0.12)', background: '#FAFAFA' }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

export default function EmployeeDetailModal({ emp, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.employeeDetail(emp.id)
      .then(d => setDetail(d))
      .catch(console.error)
      .finally(() => setLoading(false))

    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [emp.id])

  const score = emp.productivity_today ?? 0
  const scoreColor = score >= 70 ? '#10B981' : score >= 45 ? '#F97316' : '#EF4444'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto dm-fade-in"
           style={{ border: '1px solid rgba(168,85,247,0.15)', boxShadow: '0 24px 64px rgba(168,85,247,0.2)' }}>

        {/* Header */}
        <div className="sticky top-0 bg-white px-8 py-5 border-b flex items-center justify-between z-10"
             style={{ borderColor: 'rgba(168,85,247,0.15)' }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg"
                 style={{ background: 'linear-gradient(135deg,#A855F7,#C084FC)' }}>
              {(emp.name || 'EM').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{emp.name}</h2>
              <p className="text-slate-500 text-sm">{emp.role || 'Employee'}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white ml-2"
                  style={{ background: emp.status === 'active' ? 'linear-gradient(135deg,#10B981,#22C55E)' : 'linear-gradient(135deg,#64748B,#94A3B8)' }}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full bg-white/80 mr-1.5 ${emp.status === 'active' ? 'animate-pulse' : ''}`} />
              {emp.status === 'active' ? 'Active' : emp.status === 'idle' ? 'Idle' : 'Offline'}
            </span>
          </div>
          <button onClick={onClose}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-xl">
            ×
          </button>
        </div>

        <div className="px-8 py-6">
          {/* Top metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat icon="📊" value={`${score}%`}                   label="Productivity"  color={scoreColor} />
            <Stat icon="⏱"  value={fmt(emp.active_minutes_today || 0)} label="Active Time"   color="#A855F7" />
            <Stat icon="⌨️" value={(emp.keyboard_today || 0).toLocaleString()} label="Keystrokes"  color="#F97316" />
            <Stat icon="🖱️" value={(emp.mouse_today    || 0).toLocaleString()} label="Clicks"       color="#06B6D4" />
          </div>

          {/* Current app */}
          {emp.current_app && (
            <div className="rounded-2xl p-4 mb-6 flex items-center gap-4"
                 style={{ background: 'rgba(168,85,247,0.05)', borderLeft: '4px solid #A855F7', border: '1px solid rgba(168,85,247,0.15)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                   style={{ background: 'linear-gradient(135deg,#A855F7,#F97316)' }}>💻</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900">{emp.current_app}</div>
                <div className="text-slate-500 text-sm truncate">{emp.current_window || '—'}</div>
              </div>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg,#10B981,#22C55E)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
              </span>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading detail data…</div>
          ) : (
            <>
              {/* Charts row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Donut chart */}
                <div className="rounded-2xl p-5 bg-white"
                     style={{ border: '1px solid rgba(168,85,247,0.12)' }}>
                  <h3 className="font-semibold text-slate-800 mb-4">App Usage</h3>
                  {emp.app_breakdown?.length > 0 ? (
                    <>
                      <div className="relative h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={emp.app_breakdown} dataKey="minutes" cx="50%" cy="50%"
                                 innerRadius={60} outerRadius={90}>
                              {emp.app_breakdown.map((_, i) => (
                                <Cell key={i} fill={DM_COLORS[i % DM_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => [`${v}m`, 'Time']}
                                     contentStyle={{ background: '#fff', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl font-bold" style={{ color: '#A855F7' }}>
                            {emp.screenshots_today || 0}
                          </span>
                          <span className="text-xs text-slate-400">screenshots</span>
                        </div>
                      </div>
                      <div className="space-y-2 mt-3">
                        {emp.app_breakdown.map((a, i) => (
                          <div key={a.app} className="flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ background: DM_COLORS[i % DM_COLORS.length] }} />
                            <span className="flex-1 text-slate-700 truncate">{a.app}</span>
                            <span className="text-slate-500 text-xs">{a.minutes}m</span>
                            <span className="text-slate-400 text-xs w-9 text-right">{a.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-slate-400 text-sm text-center py-8">No app data today</p>}
                </div>

                {/* Hourly activity */}
                <div className="rounded-2xl p-5 bg-white"
                     style={{ border: '1px solid rgba(168,85,247,0.12)' }}>
                  <h3 className="font-semibold text-slate-800 mb-4">Hourly Activity</h3>
                  {detail?.hourly_activity?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={detail.hourly_activity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }}
                               tickFormatter={h => `${h}h`} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 8 }} />
                        <Bar dataKey="high"   fill="#A855F7" stackId="a" />
                        <Bar dataKey="medium" fill="#F97316" stackId="a" />
                        <Bar dataKey="low"    fill="#06B6D4" stackId="a" />
                        <Bar dataKey="idle"   fill="#CBD5E1" stackId="a" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-slate-400 text-sm text-center py-8">No hourly data today</p>}

                  {/* Activity distribution */}
                  {emp.activity_summary && (
                    <div className="mt-4 space-y-2">
                      {[
                        { key: 'high',   label: 'High',   color: '#10B981' },
                        { key: 'medium', label: 'Medium', color: '#F97316' },
                        { key: 'low',    label: 'Low',    color: '#06B6D4' },
                        { key: 'idle',   label: 'Idle',   color: '#CBD5E1' },
                      ].map(({ key, label, color }) => {
                        const val = emp.activity_summary[key] || 0
                        const total = Object.values(emp.activity_summary).reduce((s, v) => s + v, 0) || 1
                        return (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <span className="w-16 text-slate-500">{label}</span>
                            <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-100">
                              <div className="h-2 rounded-full transition-all"
                                   style={{ width: `${(val / total) * 100}%`, background: color }} />
                            </div>
                            <span className="text-slate-400 w-8 text-right">{val}m</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Activity log table */}
              {detail?.recent_screenshots?.length > 0 && (
                <div className="rounded-2xl overflow-hidden"
                     style={{ border: '1px solid rgba(168,85,247,0.12)' }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(168,85,247,0.12)', background: 'rgba(168,85,247,0.04)' }}>
                    <h3 className="font-semibold text-slate-800">Recent Activity Log</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'rgba(168,85,247,0.05)' }}>
                          {['Time', 'Application', 'Window Title', 'Activity', 'Keys / Clicks'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.recent_screenshots.map((s, i) => (
                          <tr key={i} className="border-t hover:bg-slate-50 transition-colors"
                              style={{ borderColor: 'rgba(168,85,247,0.06)' }}>
                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtTime(s.captured_at)}</td>
                            <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap">
                              {s.app_name || s.process_name || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">
                              {s.window_title_raw || '—'}
                            </td>
                            <td className="px-4 py-3"><ActivityBadge level={s.activity_level} /></td>
                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                              {s.keyboard_count ?? 0} / {s.mouse_count ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
