export default function StatCard({ label, value, sub, icon }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-slate-400 text-xs uppercase tracking-wide">{icon} {label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-slate-400 text-xs">{sub}</span>}
    </div>
  )
}
