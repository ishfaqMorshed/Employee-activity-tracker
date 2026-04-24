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

  const active    = team.filter(e => e.status === 'active').length
  const idle      = team.filter(e => e.status === 'idle').length
  const offline   = team.filter(e => e.status === 'offline').length
  const totalShots = team.reduce((s, e) => s + (e.screenshots_today || 0), 0)

  const statusOrder = { active: 0, idle: 1, offline: 2 }
  const sorted = [...filtered].sort((a, b) =>
    (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3) ||
    a.name.localeCompare(b.name)
  )

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
            <h1 className="text-lg font-bold text-slate-900">Activity Monitor</h1>
            <p className="text-slate-400 text-xs">
              Manager View · {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')}
                  className="text-sm font-medium transition-colors"
                  style={{ color: '#A855F7' }}>
            Admin
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
               style={{ background: 'linear-gradient(135deg, #A855F7 0%, #C084FC 100%)' }}>
            {initials}
          </div>
          <button onClick={logout} className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 dm-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Active Now"  value={active}     icon="👥" sub={`of ${team.length} employees`}
                    gradient="linear-gradient(135deg, #10B981 0%, #22C55E 100%)" />
          <StatCard label="Idle"        value={idle}       icon="😴"
                    gradient="linear-gradient(135deg, #F97316 0%, #FB923C 100%)" />
          <StatCard label="Offline"     value={offline}    icon="⚫"
                    gradient="linear-gradient(135deg, #64748B 0%, #94A3B8 100%)" />
          <StatCard label="Screenshots" value={totalShots} icon="📸" sub="today"
                    gradient="linear-gradient(135deg, #06B6D4 0%, #22D3EE 100%)" />
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or role…"
          className="w-full bg-white rounded-xl px-4 py-3 text-sm text-slate-800 outline-none mb-6 border"
          style={{ borderColor: 'rgba(168,85,247,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(168,85,247,0.15)'}
          onBlur={e => e.target.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'}
        />

        {loading ? (
          <div className="text-center py-16">
            <div className="dm-spinner mx-auto mb-3" style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '4px solid rgba(168,85,247,0.15)',
              borderTopColor: '#A855F7',
              animation: 'spin 1s linear infinite',
            }} />
            <p className="text-slate-400 text-sm">Loading team…</p>
          </div>
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
