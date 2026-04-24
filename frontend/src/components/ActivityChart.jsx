import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function ActivityChart({ hourly = [] }) {
  if (!hourly.length) return (
    <p className="text-slate-400 text-sm text-center py-8">No hourly data yet</p>
  )

  const data = hourly.map(h => ({
    hour: `${h.hour}:00`,
    High:   h.high,
    Medium: h.medium,
    Low:    h.low,
    Idle:   h.idle,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid rgba(168,85,247,0.25)',
            borderRadius: 10,
            boxShadow: '0 4px 12px rgba(168,85,247,0.1)',
          }}
          labelStyle={{ color: '#1E293B', fontWeight: 600 }}
          itemStyle={{ color: '#475569' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        <Bar dataKey="High"   stackId="a" fill="#A855F7" />
        <Bar dataKey="Medium" stackId="a" fill="#F97316" />
        <Bar dataKey="Low"    stackId="a" fill="#06B6D4" />
        <Bar dataKey="Idle"   stackId="a" fill="#CBD5E1" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
