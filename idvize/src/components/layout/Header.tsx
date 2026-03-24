import { useEffect, useState } from 'react'
import { Bell, Settings, LogOut } from 'lucide-react'

const API = 'http://localhost:3001'
const HEADERS = { 'Content-Type': 'application/json', 'x-api-key': 'demo-key' }

export default function Header({ onLogout }: { onLogout?: () => void }) {
  const name = localStorage.getItem('idvize_user') ?? 'User'
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

  return (
    <header className="flex items-center h-14 px-6 bg-surface-800 border-b border-surface-700 flex-shrink-0 gap-4">
      {/* Logo wordmark + OS badge + kernel dot */}
      <div className="flex items-center gap-2 mr-4">
        <div className="relative">
          <span className="text-white font-bold text-lg tracking-tight">
            id<span className="text-indigo-400">vize</span>
          </span>
        </div>
        <span className="text-[10px] font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded">
          OS
        </span>
        <div className="flex items-center gap-1.5 ml-1">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor} ${kernelStatus === 'running' ? 'shadow-[0_0_6px_rgba(74,222,128,0.8)]' : ''}`} />
          <span className="text-[10px] text-slate-500 hidden sm:block">IAM Operating System</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Icons */}
      <div className="flex items-center gap-2">
        <button className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-surface-700 hover:text-slate-200 transition-colors">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <button className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-surface-700 hover:text-slate-200 transition-colors">
          <Settings size={16} />
        </button>

        {/* Avatar + name */}
        <div className="flex items-center gap-2 ml-1 pl-2 border-l border-surface-600">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          <span className="text-xs text-slate-400 hidden sm:block max-w-[120px] truncate">{name}</span>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign out"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:bg-surface-700 hover:text-red-400 transition-colors"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
