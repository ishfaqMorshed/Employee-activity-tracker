export default function StatCard({ label, value, sub, icon, gradient }) {
  const bg = gradient || 'linear-gradient(135deg, #A855F7 0%, #C084FC 100%)'
  return (
    <div className="relative rounded-2xl p-6 overflow-hidden text-white dm-fade-in"
         style={{ background: bg }}>
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.12) 0%, transparent 65%)' }} />
      <div className="relative">
        <div className="text-3xl mb-3">{icon}</div>
        <div className="text-4xl font-bold leading-none">{value}</div>
        <div className="text-sm font-medium opacity-90 mt-2">{label}</div>
        {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
      </div>
    </div>
  )
}
