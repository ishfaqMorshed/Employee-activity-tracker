export default function ProgressBar({ value, max = 100, className = '' }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const grad =
    pct >= 70 ? 'linear-gradient(90deg, #10B981 0%, #22C55E 100%)' :
    pct >= 45 ? 'linear-gradient(90deg, #F97316 0%, #FB923C 100%)' :
                'linear-gradient(90deg, #EF4444 0%, #F87171 100%)'
  const glow =
    pct >= 70 ? '0 0 10px rgba(16,185,129,0.45)' :
    pct >= 45 ? '0 0 10px rgba(249,115,22,0.45)' :
                'none'
  return (
    <div className={`w-full rounded-full h-3 overflow-hidden ${className}`}
         style={{ background: 'rgba(148,163,184,0.2)' }}>
      <div className="h-3 rounded-full transition-all duration-700"
           style={{ width: `${pct}%`, background: grad, boxShadow: glow }} />
    </div>
  )
}
