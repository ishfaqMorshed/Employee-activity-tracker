import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import EmployeeCard from '../components/EmployeeCard'
import StatCard from '../components/StatCard'

const POLL_MS = 30000

export default function AdminDashboard() {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [lastTrigger, setLastTrigger] = useState(null)
  const [triggerMsg, setTriggerMsg] = useState('')
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
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': session.admin_key || '' },
          body: JSON.stringify({}),
        }
      )
      if (!res.ok) throw new Error(await res.text())
      setLastTrigger(new Date())
      setTriggerMsg('Pipeline triggered — Slack report will arrive in ~2 min')
    } catch (e) {
      setTriggerMsg(`Error: ${e.message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  const active  = team.filter(e => e.status === 'active').length
  const idle    = team.filter(e => e.status === 'idle').length
  const offline = team.filter(e => e.status === 'offline').length
  const initials = (session.employee?.name || 'AD').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10"
           style={{ borderBottomColor: 'rgba(168,85,247,0.2)', boxShadow: '0 1px 12px rgba(168,85,247,0.08)' }}>
        <div className="flex items-center gap-3">
          <img src="/images/dm-logo.png" alt="Design Musketeer" className="h-8 object-contain"
               onError={e => { e.target.style.display='none' }} />
          <div>
            <h1 className="text-lg font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-400 text-xs">
              {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/manager')}
                  className="text-sm font-medium transition-colors"
                  style={{ color: '#A855F7' }}>
            ← Team View
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
               style={{ background: 'linear-gradient(135deg, #A855F7 0%, #C084FC 100%)' }}>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Active Now" value={active}      icon="👥" sub={`of ${team.length}`}
                    gradient="linear-gradient(135deg, #10B981 0%, #22C55E 100%)" />
          <StatCard label="Idle"       value={idle}        icon="😴"
                    gradient="linear-gradient(135deg, #F97316 0%, #FB923C 100%)" />
          <StatCard label="Offline"    value={offline}     icon="⚫"
                    gradient="linear-gradient(135deg, #64748B 0%, #94A3B8 100%)" />
          <StatCard label="Employees"  value={team.length} icon="🏢"
                    gradient="linear-gradient(135deg, #A855F7 0%, #C084FC 100%)" />
        </div>

        {/* AI Analysis panel */}
        <div className="rounded-2xl p-6 mb-6 bg-white"
             style={{ border: '1px solid rgba(168,85,247,0.2)', boxShadow: '0 2px 12px rgba(168,85,247,0.06)' }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm"
                      style={{ background: 'linear-gradient(135deg, #A855F7 0%, #C084FC 100%)' }}>🤖</span>
                AI Analysis Pipeline
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Runs ai_analyzer.py + sends Slack report for today's screenshots
              </p>
              {lastTrigger && (
                <p className="text-slate-400 text-xs mt-1">Last triggered: {lastTrigger.toLocaleTimeString()}</p>
              )}
            </div>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #A855F7 0%, #C084FC 100%)',
                boxShadow: analyzing ? 'none' : '0 4px 12px rgba(168,85,247,0.35)',
              }}
            >
              {analyzing ? 'Triggering…' : '▶ Run AI Analysis Now'}
            </button>
          </div>
          {triggerMsg && (
            <p className={`mt-3 text-sm font-medium ${triggerMsg.startsWith('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
              {triggerMsg}
            </p>
          )}
        </div>

        {/* Team grid */}
        {loading ? (
          <p className="text-slate-400 text-center py-16">Loading team…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {team.map(emp => <EmployeeCard key={emp.id} emp={emp} />)}
          </div>
        )}
      </div>
    </div>
  )
}
