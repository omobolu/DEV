import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  MonitorDot, Plug, Activity, Users, Briefcase,
  UserRound, UserCheck, ShieldCheck, ShieldAlert, RefreshCw,
  ClipboardCheck, UserPlus, Network, Workflow,
  BadgeCheck, KeyRound, KeySquare, Lock, Eye,
  Database, FileText, Award, DollarSign,
  LayoutDashboard, BookOpen, TrendingUp, AlertTriangle, X,
  ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* =============================================================================
 * Sidebar palette — explicit dark navy. Independent of the app theme so the
 * sidebar reads as the security command center on both light and dark surfaces.
 *
 *   Background : #0F172A  (slate-900)
 *   Hover      : #1E293B  (slate-800)
 *   Active     : #2563EB  (blue-600)
 *   Text       : #FFFFFF  (white)
 *   Muted      : #CBD5E1  (slate-300)
 * ========================================================================== */

const SECTION_SYSTEM = [
  { icon: Plug,     label: 'Driver Manager', path: '/integrations' },
  { icon: Activity, label: 'System Events',  path: '/system-events' },
]

/**
 * Identity Domains — organized by business audience (B2E / B2B / B2C),
 * not by IAM acronym. Sub-paths use parent route wildcards (`iga/*`, `ciam/*`)
 * so each leaf has its own URL signature for active-state highlighting.
 */
const IDENTITY_DOMAINS = [
  {
    label: 'Workforce',
    sublabel: 'Employees · B2E',
    icon: Users,
    items: [
      { icon: RefreshCw,   label: 'Lifecycle Management', path: '/iga',                end: true },
      { icon: ShieldCheck, label: 'Access Management',    path: '/access-management',  end: true },
      { icon: ShieldAlert, label: 'Privileged Access',    path: '/pam' },
    ],
  },
  {
    label: 'Partners',
    sublabel: 'Vendors & contractors · B2B',
    icon: Briefcase,
    items: [
      { icon: UserPlus,       label: 'Partner Onboarding',  path: '/iga/partners/onboarding' },
      { icon: Network,        label: 'Federated Access',    path: '/access-management/partners' },
      { icon: Workflow,       label: 'Access Provisioning', path: '/iga/partners/provisioning' },
      { icon: ClipboardCheck, label: 'Partner Governance',  path: '/iga/partners/governance' },
    ],
  },
  {
    label: 'Customers',
    sublabel: 'External users · B2C',
    icon: UserRound,
    items: [
      { icon: UserPlus,   label: 'Identity Registration',         path: '/ciam/registration' },
      { icon: BadgeCheck, label: 'Identity Verification',         path: '/ciam/verification' },
      { icon: KeyRound,   label: 'Authentication',                path: '/ciam/authentication' },
      { icon: KeySquare,  label: 'Password & Account Management', path: '/ciam/accounts' },
      { icon: UserCheck,  label: 'Customer Access',               path: '/ciam/access' },
      { icon: Lock,       label: 'Consent & Privacy',             path: '/ciam/consent' },
      { icon: Eye,        label: 'Fraud & Risk',                  path: '/ciam/fraud' },
    ],
  },
] as const

const SECTION_DATA = [
  { icon: Database,        label: 'Identity CMDB',    path: '/cmdb' },
  { icon: FileText,        label: 'Policy & Docs',    path: '/documents' },
  { icon: BookOpen,        label: 'Controls Library', path: '/controls/library' },
  { icon: LayoutDashboard, label: 'IAM Overview',     path: '/dashboard' },
]

const SECTION_INTEL = [
  { icon: AlertTriangle, label: 'Top IAM Risks',  path: '/risks' },
  { icon: Award,         label: 'Maturity',       path: '/maturity' },
  { icon: DollarSign,    label: 'Cost Intel',     path: '/insights/program-maturity' },
  { icon: TrendingUp,    label: 'Business Value', path: '/value' },
]

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1.5">
      <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">{label}</span>
    </div>
  )
}

function NavItem({ icon: Icon, label, path, end, onClick }: {
  icon: React.ElementType
  label: string
  path: string
  end?: boolean
  onClick?: () => void
}) {
  return (
    <NavLink
      to={path}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 mx-1 rounded-lg transition-colors text-sm
         ${isActive
           ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
           : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
      }
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="truncate text-xs font-medium">{label}</span>
    </NavLink>
  )
}

function DomainGroup({
  label, sublabel, icon: Icon, items, isOpen, onToggle,
}: {
  label: string
  sublabel: string
  icon: LucideIcon
  items: ReadonlyArray<{ icon: LucideIcon; label: string; path: string; end?: boolean }>
  isOpen: boolean
  onToggle: () => void
}) {
  const headerId = `domain-header-${label.toLowerCase()}`
  const panelId  = `domain-panel-${label.toLowerCase()}`

  return (
    <div className="mt-0.5">
      <button
        id={headerId}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full flex items-center gap-2 px-3 py-2 mx-1 rounded-lg text-left transition-colors hover:bg-slate-800 group"
      >
        <Icon size={14} className="text-slate-400 flex-shrink-0 group-hover:text-white transition-colors" aria-hidden="true" />
        <div className="flex-1 flex flex-col leading-tight min-w-0">
          <span className="text-[12px] font-semibold text-white truncate">{label}</span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400">{sublabel}</span>
        </div>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`flex-shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>

      {/* Animated container — grid-rows trick gives smooth height animation */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="ml-4 border-l border-slate-700/70 pl-1 py-1 space-y-0.5">
            {items.map(item => <NavItem key={item.path} {...item} />)}
          </div>
        </div>
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

  // Single-open accordion. Pre-open the domain that matches the current URL,
  // otherwise default to Workforce (the most-used B2E domain).
  const initialOpen = (() => {
    for (const d of IDENTITY_DOMAINS) {
      if (d.items.some(i => location.pathname.startsWith(i.path.split('?')[0]))) {
        return d.label as (typeof IDENTITY_DOMAINS)[number]['label']
      }
    }
    return 'Workforce' as const
  })()
  const [openDomain, setOpenDomain] = useState<string | null>(initialOpen)

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
      <div className="flex items-center justify-between gap-2 px-4 h-14 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-base tracking-tight">
            id<span className="text-blue-400">vize</span>
          </span>
          <span className="text-[10px] font-semibold bg-blue-600/30 text-blue-300 border border-blue-500/40 px-1.5 py-0.5 rounded uppercase tracking-wider">
            OS
          </span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>
      </div>

      {/* Control Panel — home */}
      <div className="pt-3 pb-1">
        <NavLink
          to="/os"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 mx-1 rounded-lg transition-colors
             ${isActive
               ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
               : 'text-slate-200 hover:bg-slate-800 hover:text-white'}`
          }
        >
          <MonitorDot size={16} className="flex-shrink-0" />
          <span className="text-xs font-semibold">Control Panel</span>
        </NavLink>
      </div>

      <div className="w-full border-t border-slate-800 my-2" />

      {/* SYSTEM */}
      <SectionLabel label="System" />
      {SECTION_SYSTEM.map(item => <NavItem key={item.path} {...item} />)}

      <div className="w-full border-t border-slate-800 my-2" />

      {/* IDENTITY DOMAINS — collapsible, single-open accordion */}
      <SectionLabel label="Identity Domains" />
      {IDENTITY_DOMAINS.map(domain => (
        <DomainGroup
          key={domain.label}
          label={domain.label}
          sublabel={domain.sublabel}
          icon={domain.icon}
          items={domain.items}
          isOpen={openDomain === domain.label}
          onToggle={() => setOpenDomain(prev => (prev === domain.label ? null : domain.label))}
        />
      ))}

      <div className="w-full border-t border-slate-800 my-2" />

      {/* DATA PLANE */}
      <SectionLabel label="Data Plane" />
      {SECTION_DATA.map(item => <NavItem key={item.path} {...item} />)}

      <div className="w-full border-t border-slate-800 my-2" />

      {/* INTELLIGENCE */}
      <SectionLabel label="Intelligence" />
      {SECTION_INTEL.map(item => <NavItem key={item.path} {...item} />)}

      <div className="h-3" />
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

      {/* Sidebar — explicit dark navy regardless of app theme */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col w-52 bg-slate-900 text-slate-100 border-r border-slate-800 overflow-y-auto
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
