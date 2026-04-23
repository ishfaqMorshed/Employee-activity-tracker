export default function StatusBadge({ status }) {
  const cfg = {
    active:  { dot: 'bg-green-400 animate-pulse', text: 'text-green-400',  label: 'Active'  },
    idle:    { dot: 'bg-yellow-400',              text: 'text-yellow-400', label: 'Idle'    },
    offline: { dot: 'bg-slate-500',               text: 'text-slate-400',  label: 'Offline' },
  }[status] ?? { dot: 'bg-slate-500', text: 'text-slate-400', label: 'Unknown' }

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
