import { Bell, ShoppingCart, Settings, LogOut } from 'lucide-react'

export default function Header({ onLogout }: { onLogout?: () => void }) {
  const name = localStorage.getItem('idvize_user') ?? 'User'
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="flex items-center h-14 px-6 bg-surface-800 border-b border-surface-700 flex-shrink-0 gap-4">
      {/* Logo wordmark */}
      <span className="text-white font-bold text-lg tracking-tight mr-4">
        id<span className="text-indigo-400">vize</span>
      </span>

      <div className="flex-1" />

      {/* Icons */}
      <div className="flex items-center gap-2">
        <button className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-surface-700 hover:text-slate-200 transition-colors">
          <ShoppingCart size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
        </button>
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
