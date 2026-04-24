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
    <div className="min-h-screen flex items-center justify-center px-4 py-8"
         style={{ background: 'linear-gradient(135deg, #FAFAFA 0%, #F3E8FF 100%)' }}>
      <div className="w-full max-w-lg dm-fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <img src="/images/dm-logo.png" alt="Design Musketeer"
               className="h-10 object-contain mx-auto mb-3"
               onError={e => { e.target.style.display='none' }} />
          <h1 className="text-xl font-bold text-slate-900">Activity Monitor Setup</h1>
          <p className="text-sm mt-1 font-medium" style={{ color: '#A855F7' }}>Complete your profile to start tracking</p>
        </div>

        {/* Step indicator */}
        {step < 4 && (
          <div className="flex items-center justify-between mb-6 px-2">
            {STEPS.slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all`}
                     style={{
                       background: i < step
                         ? 'linear-gradient(135deg,#10B981,#22C55E)'
                         : i === step
                         ? 'linear-gradient(135deg,#A855F7,#C084FC)'
                         : '#E2E8F0',
                       color: i >= step && i !== step ? '#94A3B8' : 'white',
                     }}>
                  {i < step ? '✓' : i + 1}
                </div>
                {i < 3 && (
                  <div className="h-0.5 w-12 sm:w-16 transition-all"
                       style={{ background: i < step ? 'linear-gradient(90deg,#10B981,#22C55E)' : '#E2E8F0' }} />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-3xl p-6"
             style={{ border: '1px solid rgba(168,85,247,0.15)', boxShadow: '0 8px 32px rgba(168,85,247,0.08)' }}>
          {/* STEP 0: Basic Info */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-slate-900 font-semibold text-lg mb-4">Basic Information</h2>
              {[
                { label: 'Full Name', field: 'name', type: 'text', placeholder: 'John Smith' },
                { label: 'Work Email', field: 'email', type: 'email', placeholder: 'john@company.com' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label className="text-slate-600 text-sm block mb-1 font-medium">{label}</label>
                  <input type={type} value={form[field]} onChange={e => set(field, e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none border"
                    style={{ borderColor: 'rgba(168,85,247,0.25)' }}
                    onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(168,85,247,0.12)'}
                    onBlur={e => e.target.style.boxShadow='none'} />
                </div>
              ))}
              <div>
                <label className="text-slate-600 text-sm block mb-1 font-medium">Department</label>
                <select value={form.department} onChange={e => set('department', e.target.value)}
                  className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none border"
                  style={{ borderColor: 'rgba(168,85,247,0.25)' }}>
                  <option value="">Select department…</option>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* STEP 1: Role */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-slate-900 font-semibold text-lg mb-4">Your Role</h2>
              <div>
                <label className="text-slate-600 text-sm block mb-1 font-medium">Job Title</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}
                  className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none border"
                  style={{ borderColor: 'rgba(168,85,247,0.25)' }}>
                  <option value="">Select role…</option>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-600 text-sm block mb-1 font-medium">
                  What do you do daily? <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea value={form.work_description} onChange={e => set('work_description', e.target.value)}
                  rows={4} placeholder="e.g. Build React components, review PRs, attend standups…"
                  className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none border resize-none"
                  style={{ borderColor: 'rgba(168,85,247,0.25)' }} />
              </div>
            </div>
          )}

          {/* STEP 2: Tools */}
          {step === 2 && (
            <div>
              <h2 className="text-slate-900 font-semibold text-lg mb-1">Tools & Apps</h2>
              <p className="text-slate-500 text-sm mb-4">Select apps you regularly use for work</p>
              {groups.map(group => (
                <div key={group} className="mb-4">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-medium">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {APP_OPTIONS.filter(a => a.group === group).map(({ label }) => {
                      const on = form.expected_apps.includes(label)
                      return (
                        <button key={label} onClick={() => toggleApp(label)}
                          className="px-3 py-1.5 rounded-xl text-sm font-medium border transition-all"
                          style={{
                            background: on ? 'linear-gradient(135deg,#A855F7,#C084FC)' : 'white',
                            borderColor: on ? '#A855F7' : 'rgba(168,85,247,0.2)',
                            color: on ? 'white' : '#475569',
                          }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="mt-4">
                <label className="text-slate-600 text-sm block mb-1 font-medium">
                  Work websites <span className="text-slate-400 font-normal">(comma-separated)</span>
                </label>
                <input value={form.expected_sites} onChange={e => set('expected_sites', e.target.value)}
                  placeholder="github.com, figma.com, jira.com"
                  className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none border"
                  style={{ borderColor: 'rgba(168,85,247,0.25)' }} />
              </div>
            </div>
          )}

          {/* STEP 3: Patterns */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-slate-900 font-semibold text-lg mb-4">Work Patterns</h2>
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border"
                     style={{ borderColor: 'rgba(168,85,247,0.15)', background: 'rgba(168,85,247,0.03)' }}>
                <input type="checkbox" checked={form.youtube_ok} onChange={e => set('youtube_ok', e.target.checked)}
                  className="mt-1 accent-violet-500" />
                <div>
                  <p className="text-slate-800 text-sm font-medium">YouTube tutorials for work</p>
                  <p className="text-slate-500 text-xs mt-0.5">If checked, relevant tutorial watching counts as Medium productivity</p>
                </div>
              </label>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Time spent in meetings</span>
                  <span className="font-semibold" style={{ color: '#A855F7' }}>{form.meeting_pct}%</span>
                </div>
                <input type="range" min="0" max="80" step="5" value={form.meeting_pct}
                  onChange={e => set('meeting_pct', Number(e.target.value))}
                  className="w-full accent-violet-500" />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0%</span><span>80%</span>
                </div>
              </div>
              <div>
                <label className="text-slate-600 text-sm block mb-1 font-medium">
                  Special cases <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea value={form.edge_cases} onChange={e => set('edge_cases', e.target.value)}
                  rows={3} placeholder="e.g. Sometimes use Photoshop for mockups even though I'm a developer"
                  className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none border resize-none"
                  style={{ borderColor: 'rgba(168,85,247,0.25)' }} />
              </div>
            </div>
          )}

          {/* STEP 4: Done */}
          {step === 4 && result && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto"
                   style={{ background: 'linear-gradient(135deg,#10B981,#22C55E)' }}>✅</div>
              <h2 className="text-slate-900 font-bold text-xl">You're all set, {result.name.split(' ')[0]}!</h2>
              {synced ? (
                <div className="rounded-xl p-3 text-sm font-medium"
                     style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', color: '#059669' }}>
                  Desktop app synced — press START to begin tracking
                </div>
              ) : (
                <div className="rounded-xl p-4 text-left"
                     style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
                  <p className="text-slate-500 text-xs mb-1">Your API Key (save this)</p>
                  <p className="font-mono text-sm break-all select-all text-slate-900">{result.api_key}</p>
                  <p className="text-slate-400 text-xs mt-2">Enter this in the desktop app when prompted</p>
                </div>
              )}
              <div className="rounded-xl p-4 text-left text-sm text-slate-600 space-y-2"
                   style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="font-semibold text-slate-800 mb-2">Next steps:</p>
                <p>1. Open the Activity Monitor desktop app</p>
                <p>2. Press <span className="font-semibold" style={{ color: '#10B981' }}>START</span> to begin tracking</p>
                <p>3. Your dashboard will open automatically</p>
              </div>
              {countdown !== null && (
                <p className="text-slate-400 text-sm">
                  Redirecting to dashboard in <span className="font-bold" style={{ color: '#A855F7' }}>{countdown}</span>s…
                </p>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-sm mt-3">⚠ {error}</p>}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex justify-between mt-6">
              <button onClick={() => { setStep(s => s - 1); setError('') }}
                disabled={step === 0}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-700 disabled:opacity-0 transition-colors">
                ← Back
              </button>
              {step < 3 ? (
                <button onClick={() => { setStep(s => s + 1); setError('') }}
                  disabled={!canNext()}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#A855F7,#C084FC)', boxShadow: '0 4px 12px rgba(168,85,247,0.3)' }}>
                  Next →
                </button>
              ) : (
                <button onClick={submit} disabled={loading}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#10B981,#22C55E)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                  {loading ? 'Creating account…' : '✓ Complete Setup'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
