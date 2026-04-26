import { useState } from 'react'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, isLoading, error } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (!username.trim()) {
      setLocalError('Username is required')
      return
    }
    if (!password.trim()) {
      setLocalError('Password is required')
      return
    }

    try {
      await login(username.trim(), password)
    } catch {
      setLocalError('Invalid username or password')
    }
  }

  const displayError = localError || error

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#0a1020' }}
    >
      <div
        className="w-full max-w-md p-8 rounded-2xl"
        style={{
          backgroundColor: '#111a2e',
          border: '1px solid #1c2a42',
          boxShadow: '0 0 40px rgba(0, 229, 255, 0.05)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield size={32} style={{ color: '#00e5ff' }} />
            <span className="font-bold text-2xl tracking-wider">
              <span style={{ color: '#00e5ff' }}>ID</span>
              <span className="text-white">VIZE</span>
            </span>
          </div>
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            IAM Operating System
          </p>
        </div>

        {/* Error message */}
        {displayError && (
          <div
            className="mb-4 p-3 rounded-lg text-sm text-center"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            {displayError}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#e2e8f0' }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#0c1220',
                border: '1px solid #1c2a42',
                color: '#e2e8f0',
              }}
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#e2e8f0' }}
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors pr-10"
                style={{
                  backgroundColor: '#0c1220',
                  border: '1px solid #1c2a42',
                  color: '#e2e8f0',
                }}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#64748b' }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: isLoading ? '#1c2a42' : '#00e5ff',
              color: isLoading ? '#64748b' : '#0a1020',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs" style={{ color: '#475569' }}>
            Secure access powered by IDVize
          </p>
        </div>
      </div>
    </div>
  )
}
