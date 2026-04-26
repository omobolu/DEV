import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  MonitorDot, Plug, ScrollText, Activity, Users, Briefcase,
  UserRound, UserCheck, ShieldCheck, ShieldAlert, RefreshCw,
  Database, FileText, Award, DollarSign,
  LayoutDashboard, BookOpen, TrendingUp, AlertTriangle, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const SECTION_SYSTEM = [
  { icon: Plug,        label: 'Driver Manager', path: '/integrations' },
  { icon: ScrollText,  label: 'Audit Log',      path: '/os?tab=monitor' },
  { icon: Activity,    label: 'System Events',  path: '/system-events' },
]

/**
 * Identity Domains — organized by business audience (B2E / B2B / B2C),
 * not by IAM acronym. Each domain shows the capabilities relevant to it.
 */
const IDENTITY_DOMAINS = [
  {
    label: 'Workforce',
    sublabel: 'Employees · B2E',
    icon: Users,
    items: [
      { icon: RefreshCw,   label: 'Lifecycle Management', path: '/iga',                color: '#2563eb' },
      { icon: ShieldCheck, label: 'Access Management',    path: '/access-management',  color: '#06b6d4' },
      { icon: ShieldAlert, label: 'Privileged Access',    path: '/pam',                color: '#d97706' },
    ],
  },
  {
    label: 'Partners',
    sublabel: 'Vendors & contractors · B2B',
    icon: Briefcase,
    items: [
      { icon: ShieldCheck, label: 'Partner Access', path: '/access-management?audience=partners', color: '#06b6d4' },
    ],
  },
  {
    label: 'Customers',
    sublabel: 'External users · B2C',
    icon: UserRound,
    items: [
      { icon: UserCheck,   label: 'Customer Identity', path: '/ciam', color: '#16a34a' },
    ],
  },
] as const

const SECTION_DATA = [
  { icon: Database,        label: 'Identity CMDB',    path: '/cmdb',             color: '#1e40af' },
  { icon: FileText,        label: 'Policy & Docs',    path: '/documents',        color: '#10b981' },
  { icon: BookOpen,        label: 'Controls Library', path: '/controls/library', color: '#2563eb' },
  { icon: LayoutDashboard, label: 'IAM Overview',     path: '/dashboard',        color: '#64748b' },
]

const SECTION_INTEL = [
  { icon: AlertTriangle, label: 'Top IAM Risks',  path: '/risks',                     color: '#ef4444' },
  { icon: Award,         label: 'Maturity',       path: '/maturity',                  color: '#475569' },
  { icon: DollarSign,    label: 'Cost Intel',     path: '/insights/program-maturity', color: '#f97316' },
  { icon: TrendingUp,    label: 'Business Value', path: '/value',                     color: '#22c55e' },
]

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-3 pb-1">
      <span className="text-[10px] font-semibold tracking-widest text-faint uppercase">{label}</span>
    </div>
  )
}

function NavItem({ icon: Icon, label, path, color, onClick }: {
  icon: React.ElementType; label: string; path: string; color?: string; onClick?: () => void
}) {
  return (
    <NavLink
      to={path}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 mx-1 rounded-lg transition-colors text-sm
         ${isActive
           ? 'bg-indigo-600/20 text-heading'
           : 'text-muted hover:bg-surface-700 hover:text-body'}`
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

function DomainGroup({
  label, sublabel, icon: Icon, items,
}: {
  label: string
  sublabel: string
  icon: LucideIcon
  items: ReadonlyArray<{ icon: LucideIcon; label: string; path: string; color: string }>
}) {
  return (
    <div className="mt-1">
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <Icon size={12} className="text-faint flex-shrink-0" aria-hidden="true" />
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-semibold text-secondary">{label}</span>
          <span className="text-[9px] uppercase tracking-wider text-faint">{sublabel}</span>
        </div>
      </div>
      <div className="ml-3 border-l border-surface-700/60 pl-1">
        {items.map(item => <NavItem key={item.path} {...item} />)}
      </div>
    </div>
  )
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()

  // Close on route change (mobile)
  useEffect(() => {
    onClose()
  }, [location.pathname])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handler)
      return () => document.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  const sidebarContent = (
    <>
      {/* Wordmark */}
      <div className="flex items-center justify-between gap-2 px-4 h-14 border-b border-surface-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-heading font-bold text-base tracking-tight">
            id<span className="text-a-indigo">vize</span>
          </span>
          <span className="text-[10px] font-semibold bg-indigo-600/30 text-a-indigo border border-indigo-500/40 px-1.5 py-0.5 rounded">
            OS
          </span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg text-muted hover:bg-surface-700 hover:text-heading transition-colors"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>
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
               : 'text-secondary hover:bg-surface-700 hover:text-heading'}`
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

      {/* IDENTITY DOMAINS — grouped by audience (B2E / B2B / B2C) */}
      <SectionLabel label="Identity Domains" />
      {IDENTITY_DOMAINS.map(domain => (
        <DomainGroup
          key={domain.label}
          label={domain.label}
          sublabel={domain.sublabel}
          icon={domain.icon}
          items={domain.items}
        />
      ))}

      <div className="w-full border-t border-surface-700/60 mx-0 my-1" />

      {/* DATA PLANE */}
      <SectionLabel label="Data Plane" />
      {SECTION_DATA.map(item => <NavItem key={item.path} {...item} />)}

      <div className="w-full border-t border-surface-700/60 mx-0 my-1" />

      {/* INTELLIGENCE */}
      <SectionLabel label="Intelligence" />
      {SECTION_INTEL.map(item => <NavItem key={item.path} {...item} />)}
    </>
  )

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — always visible on md+, drawer on mobile */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col w-52 bg-surface-800 border-r border-surface-700 overflow-y-auto
          transition-transform duration-200 ease-in-out
          md:static md:translate-x-0 md:flex-shrink-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        {sidebarContent}
      </aside>
    </>
  )
}
