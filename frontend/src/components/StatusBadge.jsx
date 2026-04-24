export default function StatusBadge({ status }) {
  const cfg = {
    active:  { bg: 'linear-gradient(135deg,#10B981,#22C55E)', label: 'Active',  pulse: true  },
    idle:    { bg: 'linear-gradient(135deg,#F97316,#FB923C)', label: 'Idle',    pulse: false },
    offline: { bg: 'linear-gradient(135deg,#64748B,#94A3B8)', label: 'Offline', pulse: false },
  }[status] ?? { bg: 'linear-gradient(135deg,#64748B,#94A3B8)', label: 'Unknown', pulse: false }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
          style={{ background: cfg.bg }}>
      <span className={`w-1.5 h-1.5 rounded-full bg-white/80 ${cfg.pulse ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}
