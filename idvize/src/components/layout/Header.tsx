import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Settings, LogOut, Building2, Menu, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

const API = 'http://localhost:3001'
const HEADERS = { 'Content-Type': 'application/json', 'x-api-key': 'demo-key' }

/* =============================================================================
 * Top header — navy palette, matches the sidebar so the chrome reads as one
 * security command surface. The brand wordmark lives in the sidebar only.
 * ========================================================================== */

export default function Header({ onLogout, onMenuClick }: { onLogout?: () => void; onMenuClick?: () => void }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const name       = localStorage.getItem('idvize_user')   ?? 'User'
  const tenantName = localStorage.getItem('idvize_tenant') ?? ''
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const token = localStorage.getItem('idvize_token') ?? ''

  const [kernelStatus, setKernelStatus] = useState<'running' | 'degraded' | 'offline' | null>(null)

  useEffect(() => {
    fetch(`${API}/os/status`, { headers: { ...HEADERS, Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setKernelStatus(j.data.kernel?.status ?? 'running') })
      .catch(() => setKernelStatus('offline'))
  }, [token])

  const dotColor =
    kernelStatus === 'running'  ? 'bg-green-400' :
    kernelStatus === 'degraded' ? 'bg-amber-400' :
    kernelStatus === 'offline'  ? 'bg-red-400'   : 'bg-slate-600'

  const statusLabel =
    kernelStatus === 'running'  ? 'System running' :
    kernelStatus === 'degraded' ? 'System degraded' :
    kernelStatus === 'offline'  ? 'System offline'  : 'Checking status'

  return (
    <header
      className="flex items-center h-14 px-4 md:px-6 bg-slate-900 text-slate-100 border-b border-slate-800 flex-shrink-0 gap-3 md:gap-4"
      role="banner"
    >
      {/* Mobile menu button */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Kernel status — wordmark removed (already in sidebar) */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor} ${kernelStatus === 'running' ? 'shadow-[0_0_6px_rgba(74,222,128,0.8)]' : ''}`}
          role="status"
          aria-label={statusLabel}
        />
        <span className="text-[11px] text-slate-300 hidden lg:block">IAM Operating System</span>
      </div>

      {/* Tenant badge */}
      {tenantName && (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">
          <Building2 size={12} className="text-blue-400 flex-shrink-0" />
          <span className="text-xs text-slate-200 font-medium max-w-[160px] truncate">{tenantName}</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Icons */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" aria-label="Unread notifications" />
        </button>
        <button
          onClick={() => navigate('/settings/email')}
          className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>

        {/* Avatar + name */}
        <div className="flex items-center gap-2 ml-1 pl-2 border-l border-slate-700">
          <div
            className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold"
            aria-label={`User: ${name}`}
          >
            {initials}
          </div>
          <span className="text-xs text-slate-300 hidden md:block max-w-[120px] truncate">{name}</span>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign out"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-red-400 transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
