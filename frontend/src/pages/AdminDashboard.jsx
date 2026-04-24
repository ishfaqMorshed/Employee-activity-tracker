import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import EmployeeCard from '../components/EmployeeCard'
import StatCard from '../components/StatCard'

const POLL_MS = 30000

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
    } catch (err) {
      console.error('Team fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeam()
    const t = setInterval(fetchTeam, POLL_MS)
    return () => clearInterval(t)
  }, [fetchTeam])

  async function runAnalysis() {
    setAnalyzing(true)
    setTriggerMsg('')
    try {
      const res = await fetch(
        (import.meta.env.VITE_API_BASE || '') + '/admin/analyze-now',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': session.admin_key || '' }, body: '{}' }
      )
      if (!res.ok) throw new Error(await res.text())
      setTriggerMsg('✓ Pipeline triggered — Slack report arriving in ~2 min')
    } catch (e) {
      setTriggerMsg(`✗ ${e.message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  const filtered = team.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    (e.role || '').toLowerCase().includes(search.toLowerCase())
  )
  const statusOrder = { active: 0, idle: 1, offline: 2 }
  const sorted = [...filtered].sort((a, b) =>
    (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3) || (a.name || '').localeCompare(b.name || '')
  )

  const active  = team.filter(e => e.status === 'active').length
  const idle    = team.filter(e => e.status === 'idle').length
  const offline = team.filter(e => e.status === 'offline').length
  const totalShots = team.reduce((s, e) => s + (e.screenshots_today || 0), 0)
  const avgScore   = team.length ? Math.round(team.reduce((s, e) => s + (e.productivity_today || 0), 0) / team.length) : 0
  const initials   = (session.employee?.name || 'AD').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
           style={{ borderBottom: '1px solid rgba(168,85,247,0.15)', boxShadow: '0 1px 12px rgba(168,85,247,0.07)' }}>
        <div className="flex items-center gap-3">
          <img src="/images/dm-logo.png" alt="DM" className="h-8 object-contain"
               onError={e => { e.target.style.display='none' }} />
          <div>
            <h1 className="text-lg font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-400 text-xs">
              {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading…'} · {team.length} employees
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#A855F7,#C084FC)', boxShadow: '0 3px 10px rgba(168,85,247,0.3)' }}
          >
            {analyzing ? 'Running…' : '🤖 Run AI Now'}
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
               style={{ background: 'linear-gradient(135deg,#A855F7,#C084FC)' }}>
            {initials}
          </div>
          <button onClick={() => { localStorage.removeItem('session'); navigate('/login') }}
                  className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 dm-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Active"      value={active}      icon="👥" sub={`of ${team.length}`}
                    gradient="linear-gradient(135deg,#10B981,#22C55E)" />
          <StatCard label="Idle"        value={idle}        icon="😴"
                    gradient="linear-gradient(135deg,#F97316,#FB923C)" />
          <StatCard label="Offline"     value={offline}     icon="⚫"
                    gradient="linear-gradient(135deg,#64748B,#94A3B8)" />
          <StatCard label="Screenshots" value={totalShots}  icon="📸" sub="today"
                    gradient="linear-gradient(135deg,#06B6D4,#22D3EE)" />
          <StatCard label="Avg Score"   value={`${avgScore}%`} icon="📊"
                    gradient="linear-gradient(135deg,#A855F7,#C084FC)" />
        </div>

        {/* AI trigger message */}
        {triggerMsg && (
          <div className={`rounded-xl px-4 py-3 mb-5 text-sm font-medium ${triggerMsg.startsWith('✓') ? 'text-emerald-700' : 'text-red-600'}`}
               style={{ background: triggerMsg.startsWith('✓') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${triggerMsg.startsWith('✓') ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
            {triggerMsg}
          </div>
        )}

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or role…"
          className="w-full bg-white rounded-xl px-4 py-3 text-sm text-slate-800 outline-none mb-6 border"
          style={{ borderColor: 'rgba(168,85,247,0.2)' }}
          onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(168,85,247,0.12)'}
          onBlur={e => e.target.style.boxShadow='none'}
        />

        {/* Team grid */}
        {loading ? (
          <p className="text-slate-400 text-center py-16">Loading team…</p>
        ) : sorted.length === 0 ? (
          <p className="text-slate-400 text-center py-16">No employees found</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sorted.map(emp => <EmployeeCard key={emp.id} emp={emp} />)}
          </div>
        )}
      </div>
    </div>
  )
}
