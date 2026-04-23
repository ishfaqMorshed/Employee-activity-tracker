import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import EmployeeCard from '../components/EmployeeCard'
import StatCard from '../components/StatCard'

const POLL_MS = 30000

export default function ManagerDashboard() {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const session = JSON.parse(localStorage.getItem('session') || '{}')

  const fetchTeam = useCallback(async () => {
    try {
      const data = await api.teamStatus()
      // merge productivity_today from daily_summaries not yet available — compute from active_minutes
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

  function logout() {
    localStorage.removeItem('session')
    navigate('/login')
  }

  const filtered = team.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.role || '').toLowerCase().includes(search.toLowerCase())
  )

  const active = team.filter(e => e.status === 'active').length
  const idle = team.filter(e => e.status === 'idle').length
  const offline = team.filter(e => e.status === 'offline').length
  const totalShots = team.reduce((s, e) => s + (e.screenshots_today || 0), 0)

  // Sort: active first, then idle, then offline; within each group by name
  const statusOrder = { active: 0, idle: 1, offline: 2 }
  const sorted = [...filtered].sort((a, b) =>
    (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3) ||
    a.name.localeCompare(b.name)
  )

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">📊 Activity Monitor</h1>
          <p className="text-slate-400 text-xs">
            Manager View · {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm">{session.employee?.name}</span>
          <button onClick={logout} className="text-xs text-slate-500 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Active Now"   value={active}   icon="🟢" sub={`of ${team.length} employees`} />
          <StatCard label="Idle"         value={idle}     icon="🟡" />
          <StatCard label="Offline"      value={offline}  icon="⚫" />
          <StatCard label="Screenshots"  value={totalShots} icon="📸" sub="today" />
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or role…"
          className="w-full bg-slate-800 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-6 border border-slate-700"
        />

        {loading ? (
          <p className="text-slate-400 text-center py-16">Loading team…</p>
        ) : sorted.length === 0 ? (
          <p className="text-slate-400 text-center py-16">No employees found</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map(emp => <EmployeeCard key={emp.id} emp={emp} />)}
          </div>
        )}
      </div>
    </div>
  )
}
