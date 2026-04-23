import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function ActivityChart({ hourly = [] }) {
  if (!hourly.length) return <p className="text-slate-500 text-sm text-center py-8">No hourly data yet</p>

  const data = hourly.map(h => ({
    hour: `${h.hour}:00`,
    High: h.high,
    Medium: h.medium,
    Low: h.low,
    Idle: h.idle,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
          labelStyle={{ color: '#e2e8f0' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        <Bar dataKey="High"   stackId="a" fill="#22c55e" />
        <Bar dataKey="Medium" stackId="a" fill="#f59e0b" />
        <Bar dataKey="Low"    stackId="a" fill="#ef4444" />
        <Bar dataKey="Idle"   stackId="a" fill="#475569" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
