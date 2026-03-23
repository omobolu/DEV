import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, User, BarChart2, AppWindow, Users,
  ShieldCheck, Settings, Lock, ShieldAlert, UserCheck, Database, FileText, Plug,
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',   path: '/dashboard' },
  { icon: User,            label: 'My Account',  path: '/my-account' },
  { icon: BarChart2,       label: 'Insights',    path: '/insights/program-maturity' },
  { icon: AppWindow,       label: 'Applications',path: '/applications/onboarding' },
  { icon: Users,           label: 'Users',       path: '/users' },
  { icon: ShieldCheck,     label: 'Admin',        path: '/admin' },
  { icon: Settings,        label: 'Setup',        path: '/setup' },
  { icon: Lock,            label: 'Security',     path: '/security' },
]

const DASHBOARD_ITEMS = [
  { icon: BarChart2,   label: 'IGA',    path: '/iga',                color: '#6366f1' },
  { icon: ShieldCheck, label: 'AM',     path: '/access-management',  color: '#06b6d4' },
  { icon: ShieldAlert, label: 'PAM',    path: '/pam',                color: '#f59e0b' },
  { icon: UserCheck,   label: 'CIAM',   path: '/ciam',               color: '#22c55e' },
  { icon: Database,    label: 'CMDB',   path: '/cmdb',               color: '#8b5cf6' },
  { icon: FileText,    label: 'Docs',   path: '/documents',          color: '#10b981' },
  { icon: Plug,        label: 'Integrations', path: '/integrations',   color: '#f97316' },
]

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-16 bg-surface-800 border-r border-surface-700 h-screen flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center h-14 border-b border-surface-700">
        <span className="text-indigo-400 font-bold text-xs tracking-widest">ID</span>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col items-center gap-1 py-3 flex-1">
        {NAV_ITEMS.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            title={label}
            className={({ isActive }) =>
              `group relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors
               ${isActive
                 ? 'bg-indigo-600 text-white'
                 : 'text-slate-400 hover:bg-surface-700 hover:text-slate-200'}`
            }
          >
            <Icon size={18} />
            <span className="absolute left-14 bg-surface-700 text-slate-200 text-xs px-2 py-1 rounded
                             opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-surface-600">
              {label}
            </span>
          </NavLink>
        ))}

        <div className="w-8 border-t border-surface-700 my-2" />

        {/* Dashboard shortcuts */}
        {DASHBOARD_ITEMS.map(({ icon: Icon, label, path, color }) => (
          <NavLink
            key={path}
            to={path}
            title={label}
            className={({ isActive }) =>
              `group relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors
               ${isActive ? 'bg-surface-700 ring-1 ring-inset' : 'text-slate-500 hover:bg-surface-700 hover:text-slate-200'}`
            }
            style={({ isActive }) => isActive ? { color, ringColor: color } : {}}
          >
            {({ isActive }) => (
              <>
                <Icon size={16} style={{ color: isActive ? color : undefined }} />
                <span className="absolute left-14 bg-surface-700 text-slate-200 text-xs px-2 py-1 rounded
                                 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-surface-600">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
