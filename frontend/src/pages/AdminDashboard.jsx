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
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': session.admin_key || '',
          },
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

  const active = team.filter(e => e.status === 'active').length
  const idle   = team.filter(e => e.status === 'idle').length
  const offline = team.filter(e => e.status === 'offline').length

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">⚙️ Admin Dashboard</h1>
          <p className="text-slate-400 text-xs">
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/manager')}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            Team View
          </button>
          <button
            onClick={() => { localStorage.removeItem('session'); navigate('/login') }}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Active Now"  value={active}       icon="🟢" sub={`of ${team.length}`} />
          <StatCard label="Idle"        value={idle}         icon="🟡" />
          <StatCard label="Offline"     value={offline}      icon="⚫" />
          <StatCard label="Employees"   value={team.length}  icon="👥" />
        </div>

        {/* AI Analysis trigger */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold text-sm">AI Analysis Pipeline</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Runs ai_analyzer.py + sends Slack report for today
              </p>
              {lastTrigger && (
                <p className="text-slate-500 text-xs mt-1">
                  Last triggered: {lastTrigger.toLocaleTimeString()}
                </p>
              )}
            </div>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {analyzing ? 'Triggering…' : '▶ Run AI Analysis Now'}
            </button>
          </div>
          {triggerMsg && (
            <p className={`mt-3 text-sm ${triggerMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
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
