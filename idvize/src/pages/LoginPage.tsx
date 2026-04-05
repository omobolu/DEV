import { useState } from 'react'
import { ShieldCheck, Eye, EyeOff, Loader2, Building2, AlertCircle } from 'lucide-react'

const API = 'http://localhost:3001'

const DEMO_USERS = [
  // ACME Financial Services
  { label: 'Admin — all permissions', username: 'admin@acme.com',       password: 'password123', role: 'Manager',       tenant: 'ACME Financial' },
  { label: 'Architect',               username: 'sarah.chen@acme.com',  password: 'password123', role: 'Architect',     tenant: 'ACME Financial' },
  { label: 'Analyst',                 username: 'james.okafor@acme.com',password: 'password123', role: 'BusinessAnalyst',tenant: 'ACME Financial' },
  // Globex Technologies
  { label: 'Admin — all permissions', username: 'admin@globex.io',       password: 'password123', role: 'Manager',       tenant: 'Globex Tech' },
  { label: 'Architect',               username: 'priya.kumar@globex.io', password: 'password123', role: 'Architect',     tenant: 'Globex Tech' },
]

export default function LoginPage({ onLogin }: { onLogin: (token: string, name: string, tenantName: string) => void }) {
  const [username, setUsername]       = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/security/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'demo-key' },
        body: JSON.stringify({ username, password }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Login failed')
      const token      = json.data.token.access_token
      const name       = json.data.user?.name ?? username
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

  const quickLogin = (u: typeof DEMO_USERS[0]) => {
    setUsername(u.username)
    setPassword(u.password)
  }

  // Group demo users by tenant for display
  const acmeUsers   = DEMO_USERS.filter(u => u.tenant === 'ACME Financial')
  const globexUsers = DEMO_USERS.filter(u => u.tenant === 'Globex Tech')

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-4">
            <ShieldCheck size={28} className="text-indigo-400" aria-hidden="true" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold text-white">
              id<span className="text-indigo-400">vize</span>
            </h1>
            <span className="text-[10px] font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded">
              OS
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">Sign in to your IAM Operating System</p>
        </div>

        {/* Card */}
        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-6">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-username" className="block text-xs font-medium text-slate-400 mb-1.5">
                Username
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
                           text-sm text-slate-200 placeholder-slate-600
                           focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-400 mb-1.5">
                Password
              </label>
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
                             text-sm text-slate-200 placeholder-slate-600
                             focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
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
                className="flex items-start gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2.5"
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
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Demo quick-login — grouped by tenant */}
          <div className="mt-6 pt-5 border-t border-surface-700">
            <p className="text-xs text-slate-500 mb-3">Demo accounts (password: <code className="text-slate-400">password123</code>)</p>

            {[{ name: 'ACME Financial Services', users: acmeUsers, color: 'text-indigo-400' },
              { name: 'Globex Technologies', users: globexUsers, color: 'text-emerald-400' }].map(group => (
              <div key={group.name} className="mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Building2 size={11} className={group.color} aria-hidden="true" />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${group.color}`}>{group.name}</span>
                </div>
                <div className="space-y-1" role="list" aria-label={`${group.name} demo accounts`}>
                  {group.users.map(u => (
                    <button
                      key={u.username}
                      onClick={() => quickLogin(u)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg
                                 bg-surface-900/60 border border-surface-700 hover:border-indigo-600/50
                                 text-left transition-colors group focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      aria-label={`Login as ${u.label} (${u.role}) at ${group.name}`}
                    >
                      <span className="text-xs text-slate-300 group-hover:text-white">{u.label}</span>
                      <span className="text-xs text-slate-600 group-hover:text-slate-400">{u.role}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          IDVIZE · The IAM Operating System
        </p>
      </div>
    </div>
  )
}
