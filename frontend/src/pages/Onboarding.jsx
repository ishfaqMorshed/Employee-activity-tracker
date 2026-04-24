import { useState, useEffect } from 'react'
import { api } from '../api/client'

const DEPARTMENTS = ['Engineering', 'Design', 'Product', 'Marketing', 'Sales', 'Support', 'Operations', 'Finance']

const ROLES = [
  'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'UI/UX Designer', 'Graphic Designer', 'Product Manager',
  'Marketing Manager', 'Sales Representative', 'Customer Support',
  'Data Analyst', 'DevOps Engineer', 'QA Engineer', 'Other'
]

const APP_OPTIONS = [
  { label: 'VS Code', group: 'Dev' },
  { label: 'PyCharm', group: 'Dev' },
  { label: 'WebStorm', group: 'Dev' },
  { label: 'IntelliJ', group: 'Dev' },
  { label: 'Figma', group: 'Design' },
  { label: 'Photoshop', group: 'Design' },
  { label: 'Illustrator', group: 'Design' },
  { label: 'Sketch', group: 'Design' },
  { label: 'Chrome', group: 'Browser' },
  { label: 'Firefox', group: 'Browser' },
  { label: 'Slack', group: 'Comms' },
  { label: 'Teams', group: 'Comms' },
  { label: 'Zoom', group: 'Comms' },
  { label: 'Outlook', group: 'Comms' },
  { label: 'Excel', group: 'Office' },
  { label: 'Word', group: 'Office' },
  { label: 'PowerPoint', group: 'Office' },
  { label: 'Postman', group: 'Dev' },
  { label: 'Git Bash', group: 'Dev' },
  { label: 'Terminal', group: 'Dev' },
]

const STEPS = ['Basic Info', 'Your Role', 'Tools & Apps', 'Work Patterns', 'Done']

const empty = {
  name: '', email: '', department: '',
  role: '', work_description: '',
  expected_apps: [], expected_sites: '',
  youtube_ok: false, meeting_pct: 20, edge_cases: '',
}

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [synced, setSynced] = useState(false)
  const [countdown, setCountdown] = useState(null)

  useEffect(() => {
    if (result) {
      setCountdown(3)
    }
  }, [result])

  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      window.location.href = `/employee/${result.employee_id}`
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  function toggleApp(app) {
    setForm(f => ({
      ...f,
      expected_apps: f.expected_apps.includes(app)
        ? f.expected_apps.filter(a => a !== app)
        : [...f.expected_apps, app]
    }))
  }

  async function submit() {
    setError('')
    setLoading(true)
    try {
      const sites = form.expected_sites
        .split(',').map(s => s.trim()).filter(Boolean)
      const data = await api.onboard({ ...form, expected_sites: sites })
      setResult(data)
      setStep(4)
      // Notify desktop app if open
      try {
        await fetch(`http://localhost:7777/auth?api_key=${encodeURIComponent(data.api_key)}&name=${encodeURIComponent(data.name)}&employee_id=${encodeURIComponent(data.employee_id)}`, { mode: 'no-cors' })
        setSynced(true)
      } catch (_) { /* desktop app not open — user copies key manually */ }
    } catch (e) {
      setError(e.detail || e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function canNext() {
    if (step === 0) return form.name.trim() && form.email.includes('@') && form.department
    if (step === 1) return form.role
    if (step === 2) return form.expected_apps.length > 0
    if (step === 3) return true
    return false
  }

  const groups = [...new Set(APP_OPTIONS.map(a => a.group))]

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">📊</div>
          <h1 className="text-xl font-bold text-white">Activity Monitor Setup</h1>
          <p className="text-slate-400 text-sm mt-1">Complete your profile to start tracking</p>
        </div>

        {/* Step indicator */}
        {step < 4 && (
          <div className="flex items-center justify-between mb-6 px-2">
            {STEPS.slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                {i < 3 && <div className={`h-0.5 w-12 sm:w-16 ${i < step ? 'bg-green-500' : 'bg-slate-700'}`} />}
              </div>
            ))}
          </div>
        )}

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          {/* STEP 0: Basic Info */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-white font-semibold text-lg mb-4">Basic Information</h2>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Full Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="John Smith"
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Work Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="john@company.com"
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Department</label>
                <select value={form.department} onChange={e => set('department', e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select department…</option>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* STEP 1: Role */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-white font-semibold text-lg mb-4">Your Role</h2>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Job Title</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select role…</option>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">What do you do daily? <span className="text-slate-500">(optional)</span></label>
                <textarea value={form.work_description} onChange={e => set('work_description', e.target.value)}
                  rows={4} placeholder="e.g. Build React components, review PRs, attend standups…"
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
          )}

          {/* STEP 2: Tools */}
          {step === 2 && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">Tools & Apps</h2>
              <p className="text-slate-400 text-sm mb-4">Select apps you regularly use for work</p>
              {groups.map(group => (
                <div key={group} className="mb-4">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {APP_OPTIONS.filter(a => a.group === group).map(({ label }) => {
                      const on = form.expected_apps.includes(label)
                      return (
                        <button key={label} onClick={() => toggleApp(label)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                            ${on ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'}`}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="mt-4">
                <label className="text-slate-400 text-sm block mb-1">Work websites <span className="text-slate-500">(comma-separated)</span></label>
                <input value={form.expected_sites} onChange={e => set('expected_sites', e.target.value)}
                  placeholder="github.com, figma.com, jira.com"
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          {/* STEP 3: Patterns */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-white font-semibold text-lg mb-4">Work Patterns</h2>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.youtube_ok} onChange={e => set('youtube_ok', e.target.checked)}
                  className="mt-1 accent-blue-500" />
                <div>
                  <p className="text-white text-sm font-medium">YouTube tutorials for work</p>
                  <p className="text-slate-400 text-xs">If checked, relevant tutorial watching counts as Medium productivity</p>
                </div>
              </label>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Time spent in meetings</span>
                  <span className="text-white font-medium">{form.meeting_pct}%</span>
                </div>
                <input type="range" min="0" max="80" step="5" value={form.meeting_pct}
                  onChange={e => set('meeting_pct', Number(e.target.value))}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0%</span><span>80%</span>
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">Special cases <span className="text-slate-500">(optional)</span></label>
                <textarea value={form.edge_cases} onChange={e => set('edge_cases', e.target.value)}
                  rows={3} placeholder="e.g. Sometimes use Photoshop for mockups even though I'm a developer"
                  className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
          )}

          {/* STEP 4: Done */}
          {step === 4 && result && (
            <div className="text-center space-y-4">
              <div className="text-4xl">✅</div>
              <h2 className="text-white font-bold text-xl">You're all set, {result.name.split(' ')[0]}!</h2>
              {synced ? (
                <div className="bg-green-900/40 border border-green-700 rounded-lg p-3 text-green-400 text-sm">
                  Desktop app synced — press START to begin tracking
                </div>
              ) : (
                <div className="bg-slate-700 rounded-lg p-4 text-left">
                  <p className="text-slate-400 text-xs mb-1">Your API Key (save this)</p>
                  <p className="text-white font-mono text-sm break-all select-all">{result.api_key}</p>
                  <p className="text-slate-500 text-xs mt-2">Enter this in the desktop app when prompted</p>
                </div>
              )}
              <div className="bg-slate-700 rounded-lg p-4 text-left text-sm text-slate-300 space-y-1">
                <p className="font-medium text-white mb-2">Next steps:</p>
                <p>1. Open the Activity Monitor desktop app</p>
                <p>2. Press <span className="text-green-400 font-medium">START</span> to begin tracking</p>
                <p>3. Your dashboard will open automatically</p>
              </div>
              {countdown !== null && (
                <p className="text-slate-400 text-sm">
                  Redirecting to dashboard in <span className="text-white font-bold">{countdown}</span>s…
                </p>
              )}
            </div>
          )}

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex justify-between mt-6">
              <button onClick={() => { setStep(s => s - 1); setError('') }}
                disabled={step === 0}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-0 transition-colors">
                ← Back
              </button>
              {step < 3 ? (
                <button onClick={() => { setStep(s => s + 1); setError('') }}
                  disabled={!canNext()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors">
                  Next →
                </button>
              ) : (
                <button onClick={submit} disabled={loading}
                  className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                  {loading ? 'Creating account…' : 'Complete Setup'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
