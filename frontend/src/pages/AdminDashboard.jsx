import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import EmployeeCard from '../components/EmployeeCard'

const POLL_MS = 4000

export default function AdminDashboard() {
  const [team, setTeam]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState('')
  const [search, setSearch]       = useState('')
  const navigate = useNavigate()
  const session = JSON.parse(localStorage.getItem('session') || '{}')

  const fetchTeam = useCallback(async () => {
    try {
      const data = await api.teamStatus()
      setTeam(data)
      setLastUpdate(new Date())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchTeam()
    const t = setInterval(fetchTeam, POLL_MS)
    return () => clearInterval(t)
  }, [fetchTeam])

  async function runAnalysis() {
    setAnalyzing(true); setTriggerMsg('')
    try {
      const res = await fetch(
        (import.meta.env.VITE_API_BASE || '') + '/admin/analyze-now',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': session.admin_key || '' }, body: '{}' }
      )
      if (!res.ok) throw new Error(await res.text())
      setTriggerMsg('Pipeline triggered — Slack report in ~2 min')
    } catch (e) { setTriggerMsg(`Error: ${e.message}`) }
    finally { setAnalyzing(false) }
  }

  const filtered = team.filter(e =>
    (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.role || '').toLowerCase().includes(search.toLowerCase())
  )
  const sorted = [...filtered].sort((a, b) => {
    const o = { active: 0, idle: 1, offline: 2 }
    return (o[a.status] ?? 3) - (o[b.status] ?? 3) || (a.name || '').localeCompare(b.name || '')
  })

  const active    = team.filter(e => e.status === 'active').length
  const idle      = team.filter(e => e.status === 'idle').length
  const offline   = team.filter(e => e.status === 'offline').length
  const tracking  = team.filter(e => e.is_tracking).length
  const avgScore  = team.length ? Math.round(team.reduce((s, e) => s + (e.productivity_today || 0), 0) / team.length) : 0
  const totalShots = team.reduce((s, e) => s + (e.screenshots_today || 0), 0)
  const initials  = (session.employee?.name || 'AD').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10"
           style={{ borderColor: '#E2E8F0' }}>
        <div className="flex items-center gap-3">
          <img src="/images/dm-logo.png" alt="DM" className="h-7 object-contain"
               onError={e => { e.target.style.display='none' }} />
          <div>
            <h1 className="text-base font-semibold text-slate-800">Activity Monitor</h1>
            <p className="text-slate-400 text-xs">
              {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading…'} · refreshes every 4s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={runAnalysis} disabled={analyzing}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
                  style={{ background: '#A855F7' }}>
            {analyzing ? 'Running…' : 'Run AI Analysis'}
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          <button onClick={() => { localStorage.removeItem('session'); navigate('/login') }}
                  className="text-xs text-slate-400 hover:text-slate-600">Sign out</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Stats strip */}
        <div className="bg-white rounded-xl border p-4 mb-5 grid grid-cols-3 md:grid-cols-6 gap-4"
             style={{ borderColor: '#E2E8F0' }}>
          {[
            { label: 'Tracking Now', value: tracking, color: '#10B981' },
            { label: 'Active',       value: active,   color: '#A855F7' },
            { label: 'Idle',         value: idle,     color: '#F59E0B' },
            { label: 'Offline',      value: offline,  color: '#94A3B8' },
            { label: 'Avg Score',    value: `${avgScore}%`, color: '#6366F1' },
            { label: 'Shots Today',  value: totalShots, color: '#06B6D4' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {triggerMsg && (
          <div className="rounded-lg px-4 py-2 mb-4 text-sm"
               style={{ background: triggerMsg.startsWith('Error') ? '#FEF2F2' : '#F0FDF4',
                        color: triggerMsg.startsWith('Error') ? '#EF4444' : '#059669',
                        border: `1px solid ${triggerMsg.startsWith('Error') ? '#FECACA' : '#6EE7B7'}` }}>
            {triggerMsg}
          </div>
        )}

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)}
               placeholder="Search by name or role…"
               className="w-full bg-white rounded-lg px-4 py-2.5 text-sm text-slate-700 mb-5 outline-none border"
               style={{ borderColor: '#E2E8F0' }}
               onFocus={e => e.target.style.borderColor='#A855F7'}
               onBlur={e => e.target.style.borderColor='#E2E8F0'} />

        {loading ? (
          <p className="text-slate-400 text-center py-16 text-sm">Loading team…</p>
        ) : sorted.length === 0 ? (
          <p className="text-slate-400 text-center py-16 text-sm">No employees found</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map(emp => <EmployeeCard key={emp.id} emp={emp} />)}
          </div>
        )}
      </div>
    </div>
  )
}
