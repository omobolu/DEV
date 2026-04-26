import { useState } from 'react'
import { ShieldCheck, Eye, EyeOff, Loader2, AlertCircle, HelpCircle } from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'

export default function LoginPage({ onLogin }: { onLogin: (token: string, name: string, tenantName: string) => void }) {
  const [username, setUsername]         = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/security/auth/token', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Sign-in failed. Check your credentials and try again.')
      const token      = json.data.token.access_token
      const name       = json.data.user?.displayName ?? json.data.user?.name ?? username
      const tenantName = json.data.user?.tenantName ?? ''
      localStorage.setItem('idvize_token', token)
      localStorage.setItem('idvize_user', name)
      localStorage.setItem('idvize_tenant', tenantName)
      onLogin(token, name, tenantName)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-5">
            <ShieldCheck size={28} className="text-a-indigo" aria-hidden="true" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold text-white">
              id<span className="text-a-indigo">vize</span>
            </h1>
            <span className="text-[10px] font-semibold bg-indigo-600/30 text-a-indigo border border-indigo-500/40 px-1.5 py-0.5 rounded uppercase tracking-wider">
              OS
            </span>
          </div>
          <p className="text-muted text-sm mt-2">Identity governance for the modern enterprise</p>
        </div>

        {/* Card */}
        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-8 shadow-xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-heading">Sign in</h2>
            <p className="text-xs text-muted mt-1">Use your corporate credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-username" className="block text-xs font-medium text-muted mb-1.5">
                Email or username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
                autoComplete="username"
                aria-describedby={error ? 'login-error' : undefined}
                className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5
                           text-sm text-body placeholder-faint
                           focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-medium text-muted">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-a-indigo hover:text-indigo-300 transition-colors focus:outline-none focus:underline"
                  onClick={() => setError('Password recovery is managed by your administrator. Contact your IAM team for access.')}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  aria-describedby={error ? 'login-error' : undefined}
                  className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 pr-10
                             text-sm text-body placeholder-faint
                             focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors focus:outline-none focus:text-a-indigo"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                id="login-error"
                role="alert"
                aria-live="polite"
                className="flex items-start gap-2 text-xs text-a-red bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2.5"
              >
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500
                         disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg py-2.5
                         transition-colors mt-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-surface-800"
            >
              {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-surface-700">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setError('Access provisioning is managed by your administrator. Contact your IAM team to request an account.') }}
              className="flex items-center justify-center gap-2 text-xs text-muted hover:text-secondary transition-colors focus:outline-none focus:text-a-indigo"
            >
              <HelpCircle size={12} aria-hidden="true" />
              <span>Need access? Contact your administrator</span>
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-faint mt-6">
          Protected by enterprise-grade authentication · IDVIZE OS
        </p>
      </div>
    </div>
  )
}
