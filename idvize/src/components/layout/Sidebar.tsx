import { NavLink } from 'react-router-dom'
import {
  MonitorDot, Plug, ScrollText, BarChart2, ShieldCheck,
  ShieldAlert, UserCheck, Database, FileText, Award, DollarSign,
  LayoutDashboard,
} from 'lucide-react'

const SECTION_SYSTEM = [
  { icon: Plug,        label: 'Driver Manager', path: '/integrations' },
  { icon: ScrollText,  label: 'Audit Log',      path: '/os?tab=monitor' },
]

const SECTION_IAM = [
  { icon: BarChart2,   label: 'IGA',           path: '/iga',                color: '#6366f1' },
  { icon: ShieldCheck, label: 'Access Mgmt',   path: '/access-management',  color: '#06b6d4' },
  { icon: ShieldAlert, label: 'PAM',           path: '/pam',                color: '#f59e0b' },
  { icon: UserCheck,   label: 'CIAM',          path: '/ciam',               color: '#22c55e' },
]

const SECTION_DATA = [
  { icon: Database,    label: 'Identity CMDB', path: '/cmdb',      color: '#8b5cf6' },
  { icon: FileText,    label: 'Policy & Docs', path: '/documents', color: '#10b981' },
  { icon: LayoutDashboard, label: 'IAM Overview', path: '/dashboard', color: '#64748b' },
]

const SECTION_INTEL = [
  { icon: Award,       label: 'Maturity',    path: '/maturity',                color: '#a855f7' },
  { icon: DollarSign,  label: 'Cost Intel',  path: '/insights/program-maturity', color: '#f97316' },
]

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-3 pb-1">
      <span className="text-[10px] font-semibold tracking-widest text-slate-600 uppercase">{label}</span>
    </div>
  )
}

function NavItem({ icon: Icon, label, path, color }: {
  icon: React.ElementType; label: string; path: string; color?: string
}) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 mx-1 rounded-lg transition-colors text-sm
         ${isActive
           ? 'bg-indigo-600/20 text-white'
           : 'text-slate-400 hover:bg-surface-700 hover:text-slate-200'}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} style={{ color: isActive && color ? color : isActive ? '#818cf8' : undefined }} className="flex-shrink-0" />
          <span className="truncate text-xs font-medium">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-52 bg-surface-800 border-r border-surface-700 h-screen flex-shrink-0 overflow-y-auto">
      {/* Wordmark */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-surface-700 flex-shrink-0">
        <span className="text-white font-bold text-base tracking-tight">
          id<span className="text-indigo-400">vize</span>
        </span>
        <span className="text-[10px] font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded">
          OS
        </span>
      </div>

      {/* Control Panel — home */}
      <div className="pt-2 pb-1">
        <NavLink
          to="/os"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 mx-1 rounded-lg transition-colors
             ${isActive
               ? 'bg-indigo-600 text-white'
               : 'text-slate-300 hover:bg-surface-700 hover:text-white'}`
          }
        >
          <MonitorDot size={16} className="flex-shrink-0" />
          <span className="text-xs font-semibold">Control Panel</span>
        </NavLink>
      </div>

      <div className="w-full border-t border-surface-700/60 mx-0 my-1" />

      {/* SYSTEM */}
      <SectionLabel label="System" />
      {SECTION_SYSTEM.map(item => <NavItem key={item.path} {...item} />)}

      <div className="w-full border-t border-surface-700/60 mx-0 my-1" />

      {/* IAM APPLICATIONS */}
      <SectionLabel label="IAM Applications" />
      {SECTION_IAM.map(item => <NavItem key={item.path} {...item} />)}

      <div className="w-full border-t border-surface-700/60 mx-0 my-1" />

      {/* DATA PLANE */}
      <SectionLabel label="Data Plane" />
      {SECTION_DATA.map(item => <NavItem key={item.path} {...item} />)}

      <div className="w-full border-t border-surface-700/60 mx-0 my-1" />

      {/* INTELLIGENCE */}
      <SectionLabel label="Intelligence" />
      {SECTION_INTEL.map(item => <NavItem key={item.path} {...item} />)}
    </aside>
  )
}
