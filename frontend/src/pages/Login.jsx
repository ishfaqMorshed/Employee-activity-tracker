import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function Login() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(email.trim().toLowerCase())
      localStorage.setItem('session', JSON.stringify(data))
      if (data.is_manager) navigate('/manager')
      else navigate(`/employee/${data.employee.id}`)
    } catch (err) {
      setError(err.detail || 'Employee not found. Check your email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4"
         style={{ background: 'linear-gradient(135deg, #FAFAFA 0%, #F3E8FF 100%)' }}>
      <div className="w-full max-w-sm dm-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/images/dm-logo.png" alt="Design Musketeer"
               className="h-12 object-contain mx-auto mb-4"
               onError={e => { e.target.style.display='none' }} />
          <h1 className="text-2xl font-bold text-slate-900">Activity Monitor</h1>
          <p className="text-sm mt-1 font-medium" style={{ color: '#A855F7' }}>
            We are, All you Need
          </p>
        </div>

        <form onSubmit={handleLogin}
              className="bg-white rounded-3xl p-8 shadow-sm"
              style={{ border: '1px solid rgba(168,85,247,0.15)', boxShadow: '0 8px 32px rgba(168,85,247,0.08)' }}>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Work Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="w-full bg-white rounded-xl px-4 py-3 text-sm text-slate-800 outline-none mb-5 border"
            style={{ borderColor: 'rgba(168,85,247,0.25)' }}
            onFocus={e => e.target.style.boxShadow='0 0 0 3px rgba(168,85,247,0.15)'}
            onBlur={e => e.target.style.boxShadow='none'}
          />

          {error && (
            <p className="text-red-500 text-xs mb-4 flex items-center gap-1">
              <span>⚠</span> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 font-semibold text-white text-sm transition-all duration-200 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #A855F7 0%, #C084FC 100%)',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(168,85,247,0.35)',
            }}
            onMouseEnter={e => { if (!loading) e.target.style.transform='translateY(-1px)' }}
            onMouseLeave={e => { e.target.style.transform='translateY(0)' }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          New employee?{' '}
          <a href="/onboarding" style={{ color: '#A855F7' }} className="font-medium hover:underline">
            Complete onboarding
          </a>
        </p>
      </div>
    </div>
  )
}
