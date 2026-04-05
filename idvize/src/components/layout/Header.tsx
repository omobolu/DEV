import { useEffect, useState } from 'react'
import { Bell, Settings, LogOut, Building2, Menu } from 'lucide-react'

const API = 'http://localhost:3001'
const HEADERS = { 'Content-Type': 'application/json', 'x-api-key': 'demo-key' }

export default function Header({ onLogout, onMenuClick }: { onLogout?: () => void; onMenuClick?: () => void }) {
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
    <header className="flex items-center h-14 px-4 md:px-6 bg-surface-800 border-b border-surface-700 flex-shrink-0 gap-3 md:gap-4" role="banner">
      {/* Mobile menu button */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-surface-700 hover:text-white transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Logo wordmark + OS badge + kernel dot */}
      <div className="flex items-center gap-2 mr-2 md:mr-4">
        <div className="relative">
          <span className="text-white font-bold text-lg tracking-tight">
            id<span className="text-indigo-400">vize</span>
          </span>
        </div>
        <span className="text-[10px] font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded hidden sm:inline">
          OS
        </span>
        <div className="flex items-center gap-1.5 ml-1">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor} ${kernelStatus === 'running' ? 'shadow-[0_0_6px_rgba(74,222,128,0.8)]' : ''}`}
            role="status"
            aria-label={statusLabel}
          />
          <span className="text-[10px] text-slate-500 hidden lg:block">IAM Operating System</span>
        </div>
      </div>

      {/* Tenant badge */}
      {tenantName && (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-700/50 border border-surface-600">
          <Building2 size={12} className="text-indigo-400 flex-shrink-0" />
          <span className="text-xs text-slate-300 font-medium max-w-[160px] truncate">{tenantName}</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Icons */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <button
          className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-surface-700 hover:text-slate-200 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" aria-label="Unread notifications" />
        </button>
        <button
          className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-surface-700 hover:text-slate-200 transition-colors"
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>

        {/* Avatar + name */}
        <div className="flex items-center gap-2 ml-1 pl-2 border-l border-surface-600">
          <div
            className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold"
            aria-label={`User: ${name}`}
          >
            {initials}
          </div>
          <span className="text-xs text-slate-400 hidden md:block max-w-[120px] truncate">{name}</span>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign out"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:bg-surface-700 hover:text-red-400 transition-colors"
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
