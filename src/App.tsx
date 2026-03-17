import { useState, useRef, useCallback } from 'react'
import './App.css'
import { DEFAULT_CMDB_DATA, DEFAULT_CMDB_HEADERS } from './cmdbData'
import {
  LayoutDashboard,
  UserCircle,
  BarChart3,
  AppWindow,
  Users,
  ShieldCheck,
  Settings,
  Lock,
  Search,
  ShoppingCart,
  Bell,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Info,
  Filter,
  RefreshCw,
  Maximize2,
  MoreVertical,
  Download,
  KeyRound,
  Globe,
  Shield,
  Database,
  FileUp,
  Wifi,
  X,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, LineChart, Line, ComposedChart,
} from 'recharts'

type Page =
  | 'insights'
  | 'iga-warehouse'
  | 'access-management'
  | 'pam'
  | 'ciam'
  | 'app-onboarding'
  | 'app-management'
  | 'orphan-accounts'
  | 'cmdb'
  | 'cmdb-app'

const COLORS = {
  primary: '#00e5ff',
  sidebar: '#070b14',
  sidebarHover: '#0f1a2e',
  headerBg: '#0c1220',
  cardBg: '#111a2e',
  pageBg: '#0a1020',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  border: '#1c2a42',
  accent: '#00ff88',
  warning: '#f59e0b',
  danger: '#ef4444',
  glow: '#00e5ff22',
}

const PIE_COLORS = ['#00e5ff', '#00ff88', '#7c3aed', '#f59e0b', '#ef4444', '#06b6d4', '#10b981', '#f43f5e', '#8b5cf6', '#0ea5e9', '#a78bfa', '#34d399']

function Sidebar({ activePage, setActivePage, collapsed, setCollapsed }: {
  activePage: Page
  setActivePage: (p: Page) => void
  collapsed: boolean
  setCollapsed: (c: boolean) => void
}) {
  const navItems: { icon: React.ReactNode; label: string; id: Page }[] = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', id: 'insights' },
    { icon: <UserCircle size={20} />, label: 'My Account', id: 'insights' },
    { icon: <BarChart3 size={20} />, label: 'Insights', id: 'insights' },
    { icon: <AppWindow size={20} />, label: 'Applications', id: 'app-onboarding' },
    { icon: <Database size={20} />, label: 'CMDB', id: 'cmdb' },
    { icon: <Users size={20} />, label: 'Users', id: 'iga-warehouse' },
    { icon: <ShieldCheck size={20} />, label: 'Admin', id: 'app-management' },
    { icon: <Settings size={20} />, label: 'Setup', id: 'access-management' },
    { icon: <Lock size={20} />, label: 'Security', id: 'pam' },
  ]

  return (
    <div
      className="flex flex-col h-screen fixed left-0 top-0 z-30 transition-all duration-300"
      style={{ width: collapsed ? 64 : 220, backgroundColor: COLORS.sidebar, borderRight: `1px solid ${COLORS.border}` }}
    >
      <div className="flex items-center justify-center py-5 px-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="flex items-center gap-2.5">
          <Shield size={22} style={{ color: COLORS.primary }} />
          {!collapsed && (
            <span className="font-bold text-lg tracking-wider">
              <span style={{ color: COLORS.primary }}>ID</span><span className="text-white">VIZE</span>
            </span>
          )}
        </div>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item, i) => {
          const isActive = activePage === item.id || (activePage === 'cmdb-app' && item.id === 'cmdb')
          return (
            <button
              key={i}
              onClick={() => setActivePage(item.id)}
              className="w-full flex items-center gap-3 px-4 py-3 transition-all duration-200"
              style={{
                backgroundColor: isActive ? COLORS.sidebarHover : 'transparent',
                color: isActive ? COLORS.primary : '#64748b',
                borderLeft: isActive ? `3px solid ${COLORS.primary}` : '3px solid transparent',
              }}
            >
              {item.icon}
              {!collapsed && <span className="text-sm truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 transition-colors"
        style={{ color: '#64748b', borderTop: `1px solid ${COLORS.border}` }}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
      {!collapsed && <div className="px-4 py-2 text-xs" style={{ color: '#475569' }}>v1.0.0</div>}
    </div>
  )
}

function Header({ title }: { title: string }) {
  return (
    <header
      className="flex items-center justify-between px-6 py-3 sticky top-0 z-20"
      style={{ backgroundColor: COLORS.headerBg, borderBottom: `1px solid ${COLORS.border}` }}
    >
      <h2 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>{title}</h2>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a' }}>
          <Search size={16} style={{ color: '#475569' }} />
          <input type="text" placeholder="Track Request By Cart ID" className="text-sm outline-none bg-transparent w-56" style={{ color: '#94a3b8' }} />
          <SlidersHorizontal size={16} style={{ color: '#475569' }} />
        </div>
        <div className="relative">
          <ShoppingCart size={20} style={{ color: '#475569' }} />
          <span className="absolute -top-1.5 -right-1.5 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center" style={{ backgroundColor: COLORS.primary, color: '#0a0e1a' }}>0</span>
        </div>
        <div className="relative">
          <Bell size={20} style={{ color: '#475569' }} />
          <span className="absolute -top-1.5 -right-1.5 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center" style={{ backgroundColor: COLORS.primary, color: '#0a0e1a' }}>0</span>
        </div>
        <SlidersHorizontal size={20} style={{ color: '#475569' }} />
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: COLORS.primary, color: '#0a0e1a' }}>JD</div>
      </div>
    </header>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg p-4 flex items-center justify-between" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.border}` }}>
      <span className="text-sm" style={{ color: COLORS.textSecondary }}>{label}</span>
      <span className="text-xl font-bold" style={{ color: color || COLORS.primary }}>{value}</span>
    </div>
  )
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg p-4 ${className || ''}`} style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.border}` }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>{title}</h3>
        <div className="flex items-center gap-2" style={{ color: '#475569' }}>
          <Info size={14} />
          <Filter size={14} />
          <RefreshCw size={14} />
          <Maximize2 size={14} />
          <MoreVertical size={14} />
        </div>
      </div>
      {children}
    </div>
  )
}

function TabNav({ tabs, activeTab, setActiveTab }: { tabs: string[]; activeTab: string; setActiveTab: (t: string) => void }) {
  return (
    <div className="flex gap-1 mb-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className="px-4 py-2 text-sm transition-colors"
          style={{
            color: activeTab === tab ? COLORS.primary : COLORS.textSecondary,
            borderBottom: activeTab === tab ? `2px solid ${COLORS.primary}` : '2px solid transparent',
            fontWeight: activeTab === tab ? 600 : 400,
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

function GaugeChart({ title, total, items, icon }: {
  title: string; total: number; items: { name: string; value: number; color: string }[]; icon: React.ReactNode
}) {
  // Replace 0 values with a tiny number so Recharts renders all slices
  const chartData = items.map(item => ({ ...item, value: item.value === 0 ? 0.5 : item.value }))
  // Add a transparent "empty" segment for the bottom half
  const bgData = [{ name: 'bg', value: 100, color: '#1c2a42' }]

  return (
    <div className="rounded-lg p-6" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.border}` }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>{title}</h3>
        <div className="flex items-center gap-1" style={{ color: '#475569' }}>{icon}<Info size={14} /></div>
      </div>
      <div className="flex flex-col items-center">
        <div style={{ width: 220, height: 130 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={bgData} cx="50%" cy="100%" startAngle={180} endAngle={0} innerRadius={55} outerRadius={95} dataKey="value" stroke="none" isAnimationActive={false}>
                <Cell fill="#1c2a42" />
              </Pie>
              <Pie data={chartData} cx="50%" cy="100%" startAngle={180} endAngle={0} innerRadius={55} outerRadius={95} dataKey="value" stroke="none" paddingAngle={1}>
                {chartData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center mt-1">
          <div className="text-xs" style={{ color: COLORS.textSecondary }}>Total</div>
          <div className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>{total}</div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 justify-center">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs" style={{ color: COLORS.textSecondary }}>{item.name}: {item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══ Program Insights ═══ */
function ProgramInsightsPage({ setActivePage }: { setActivePage: (p: Page) => void }) {
  const igaItems = [
    { name: 'Access Request', value: 45, color: '#00e5ff' },
    { name: 'Account Management', value: 45, color: '#00ff88' },
    { name: 'Certification', value: 0, color: '#f59e0b' },
    { name: 'SOD', value: 0, color: '#7c3aed' },
  ]
  const amItems = [
    { name: 'Single Sign-On', value: 23, color: '#00e5ff' },
    { name: 'Two-factor Auth', value: 1, color: '#00ff88' },
    { name: 'Step-Up Auth', value: 0, color: '#f59e0b' },
    { name: 'Authorization', value: 3, color: '#7c3aed' },
  ]
  const pamItems = [
    { name: 'Vaulting', value: 10, color: '#00e5ff' },
    { name: 'Endpoints', value: 0, color: '#00ff88' },
    { name: 'App Sec', value: 10, color: '#7c3aed' },
    { name: 'CIEM', value: 0, color: '#f59e0b' },
  ]

  return (
    <div>
      <Header title="Program Insights" />
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-6" style={{ color: COLORS.textPrimary }}>Identity Program Overview</h1>
        <div className="grid grid-cols-6 gap-4 mb-8">
          {[
            { label: 'IGA Dashboard', page: 'iga-warehouse' as Page, icon: <ShieldCheck size={20} /> },
            { label: 'Access Mgmt', page: 'access-management' as Page, icon: <KeyRound size={20} /> },
            { label: 'PAM Dashboard', page: 'pam' as Page, icon: <Lock size={20} /> },
            { label: 'CIAM Dashboard', page: 'ciam' as Page, icon: <Globe size={20} /> },
            { label: 'App Onboarding', page: 'app-onboarding' as Page, icon: <AppWindow size={20} /> },
            { label: 'CMDB', page: 'cmdb' as Page, icon: <Database size={20} /> },
          ].map((item, i) => (
            <button key={i} onClick={() => setActivePage(item.page)}
              className="rounded-lg p-4 flex flex-col items-center gap-2 transition-all duration-200"
              style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.border}` }}>
              <div style={{ color: COLORS.primary }}>{item.icon}</div>
              <span className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6">
          <GaugeChart title="Identity Governance and Administration" total={123} items={igaItems} icon={<ShieldCheck size={14} />} />
          <GaugeChart title="Access Management" total={123} items={amItems} icon={<KeyRound size={14} />} />
          <GaugeChart title="Privileged Access Management" total={123} items={pamItems} icon={<Lock size={14} />} />
        </div>
      </div>
    </div>
  )
}

/* ═══ IGA Warehouse ═══ */
const identitiesRegionData = [
  { name: 'Europe', value: 0.02, color: '#7c3aed' },
  { name: 'Asia Pacific', value: 24.93, color: '#00e5ff' },
  { name: 'Canada', value: 24.99, color: '#00ff88' },
  { name: 'North America', value: 50.06, color: '#f59e0b' },
]
const appTypeData = [
  { name: 'Business Critical', value: 4.85, color: '#00e5ff' },
  { name: 'Non-SOX', value: 5.83, color: '#f59e0b' },
  { name: 'General', value: 10.68, color: '#7c3aed' },
  { name: 'SOX', value: 78.64, color: '#ef4444' },
]
const hireProcessingData = [
  { month: 'Sep', hires: 3, failRate: 1 }, { month: 'Dec', hires: 4, failRate: 1.5 },
  { month: 'Jun', hires: 3.5, failRate: 2 }, { month: 'Oct', hires: 5, failRate: 2.5 },
  { month: 'Feb', hires: 5.5, failRate: 3 }, { month: 'May', hires: 6, failRate: 4 },
  { month: 'Mar', hires: 5.5, failRate: 4.5 }, { month: 'Jan', hires: 6, failRate: 5 },
  { month: 'Aug', hires: 6.5, failRate: 5.5 }, { month: 'Apr', hires: 7, failRate: 5.5 },
  { month: 'Jul', hires: 19, failRate: 6 },
]
const appPortfolioData = [
  { name: 'Manual Provisioning', value: 3.69, color: '#00e5ff' },
  { name: 'Automated Provisioning', value: 39.17, color: '#00ff88' },
  { name: 'Other', value: 57.14, color: '#7c3aed' },
]

function IGAWarehousePage({ setActivePage }: { setActivePage: (p: Page) => void }) {
  const [activeTab, setActiveTab] = useState('Identity Warehouse')
  return (
    <div>
      <Header title="Identity Governance and Administration (IGA)" />
      <div className="p-6">
        <TabNav tabs={['Home', 'Identity Warehouse', 'User LifeCycle Management', 'Access Requests', 'Governance']} activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Orphan Accounts" value="34%" color="#ef4444" />
          <KpiCard label="SOD Coverage" value="23%" color="#f97316" />
          <KpiCard label="Applications Coverage" value="57.3%" color="#3b82f6" />
          <KpiCard label="Terminated Users With Active..." value="79%" color="#ef4444" />
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Active Identities Portfolio">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={identitiesRegionData} cx="40%" cy="50%" outerRadius={90} innerRadius={40} dataKey="value" label={({ value }) => `${value}%`}>
                    {identitiesRegionData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value: string) => <span className="text-xs" style={{ color: '#94a3b8' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Type Of Applications">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={appTypeData} cx="40%" cy="50%" outerRadius={90} dataKey="value" label={({ value }) => `${value}%`}>
                    {appTypeData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value: string) => <span className="text-xs" style={{ color: '#94a3b8' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Hire Processing Trend">
            <div className="h-64">
              <ResponsiveContainer>
                <ComposedChart data={hireProcessingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="hires" fill="#00e5ff" name="Total No of Hires" />
                  <Line type="monotone" dataKey="failRate" stroke="#ef4444" name="Percentage of failure" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Applications Portfolio">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={appPortfolioData} cx="40%" cy="50%" outerRadius={90} dataKey="value" label={({ value }) => `${value}%`}>
                    {appPortfolioData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value: string) => <span className="text-xs" style={{ color: '#94a3b8' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <button onClick={() => setActivePage('orphan-accounts')} className="text-sm hover:underline font-medium" style={{ color: COLORS.primary }}>
          View Orphan Accounts Detail &rarr;
        </button>
      </div>
    </div>
  )
}

/* ═══ Access Management ═══ */
const registrationData = [
  { week: '08/06', proofing: 20, registrations: 15 }, { week: '08/13', proofing: 22, registrations: 25 },
  { week: '08/19', proofing: 18, registrations: 48 }, { week: '08/20', proofing: 24, registrations: 22 },
]
const loginPerformanceData = [
  { app: 'ServiceNow', success: 98, failure: 2 }, { app: 'ZS Cloud', success: 95, failure: 5 },
  { app: 'S4 Hana Cloud', success: 92, failure: 8 }, { app: 'BlackLine', success: 88, failure: 12 },
  { app: 'Salesforce HR', success: 97, failure: 3 }, { app: 'Inavigator', success: 85, failure: 15 },
  { app: 'Kenexa TFG', success: 90, failure: 10 }, { app: 'Ariba-Buyer', success: 93, failure: 7 },
  { app: 'IDP', success: 96, failure: 4 }, { app: 'LCC', success: 91, failure: 9 },
]
const integrationPortfolioData = [
  { name: 'WS-Fed', value: 0.81, color: '#00e5ff' }, { name: 'OAUTH/OIDC', value: 1.90, color: '#00ff88' },
  { name: 'OAUTH', value: 3.79, color: '#f59e0b' }, { name: 'WS-Fed+SAML 1.1', value: 4.34, color: '#7c3aed' },
  { name: 'SAML 2.0', value: 89.16, color: '#ef4444' },
]
const loginTimeTrendData = [
  { date: 'Week 1', time: 14000 }, { date: 'Week 2', time: 12000 }, { date: 'Week 3', time: 9500 },
  { date: 'Week 4', time: 13000 }, { date: 'Week 5', time: 15000 }, { date: 'Week 6', time: 12500 },
  { date: 'Week 7', time: 14500 },
]

function AccessManagementPage() {
  return (
    <div>
      <Header title="Access Management Dashboards" />
      <div className="p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Identity base" value="670,234" />
          <KpiCard label="MFA Coverage" value="31.44 %" color="#f97316" />
          <KpiCard label="Login Success Rate" value="96.01 %" color="#22c55e" />
          <KpiCard label="Avg. Login Time" value="141.6 ms" color="#06b6d4" />
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Registration & Proofing">
            <div className="h-64">
              <ResponsiveContainer>
                <ComposedChart data={registrationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip /><Legend />
                  <Bar dataKey="registrations" fill="#00e5ff" name="Successful registrations" />
                  <Line type="monotone" dataKey="proofing" stroke="#00ff88" name="Successful ID Proofing" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Login Performance - Top Applications">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={loginPerformanceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="app" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip /><Legend />
                  <Bar dataKey="success" stackId="a" fill="#00ff88" name="Success %" />
                  <Bar dataKey="failure" stackId="a" fill="#ef4444" name="Failure %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <ChartCard title="Application Integration Portfolio">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={integrationPortfolioData} cx="40%" cy="50%" outerRadius={90} dataKey="value" label={({ value }) => `${value}%`}>
                    {integrationPortfolioData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value: string) => <span className="text-xs" style={{ color: '#94a3b8' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Login Time Trend">
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={loginTimeTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="time" stroke="#00e5ff" name="In Time (ms)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

/* ═══ PAM Dashboard ═══ */
const pamSessionData = [
  { month: 'Jan', sessions: 320, alerts: 12 }, { month: 'Feb', sessions: 280, alerts: 8 },
  { month: 'Mar', sessions: 350, alerts: 15 }, { month: 'Apr', sessions: 410, alerts: 22 },
  { month: 'May', sessions: 380, alerts: 18 }, { month: 'Jun', sessions: 420, alerts: 25 },
]
const pamVaultData = [
  { name: 'Rotated', value: 65, color: '#00ff88' }, { name: 'Pending Rotation', value: 20, color: '#f59e0b' },
  { name: 'Expired', value: 10, color: '#ef4444' }, { name: 'New', value: 5, color: '#00e5ff' },
]
const pamPrivilegedAccountData = [
  { type: 'Service Accounts', count: 245 }, { type: 'Admin Accounts', count: 89 },
  { type: 'Root Accounts', count: 12 }, { type: 'Shared Accounts', count: 56 }, { type: 'Emergency', count: 8 },
]
const pamEndpointData = [
  { name: 'Windows', value: 45, color: '#00e5ff' }, { name: 'Linux', value: 30, color: '#00ff88' },
  { name: 'Network Devices', value: 15, color: '#f59e0b' }, { name: 'Databases', value: 10, color: '#7c3aed' },
]
const pamCheckoutTrendData = [
  { week: 'Week 1', checkouts: 45, checkins: 42 }, { week: 'Week 2', checkouts: 52, checkins: 50 },
  { week: 'Week 3', checkouts: 38, checkins: 35 }, { week: 'Week 4', checkouts: 65, checkins: 60 },
  { week: 'Week 5', checkouts: 48, checkins: 47 }, { week: 'Week 6', checkouts: 55, checkins: 53 },
]
const pamRiskEventsData = [
  { category: 'Failed Login', high: 8, medium: 15, low: 22 },
  { category: 'Unauth Access', high: 5, medium: 8, low: 3 },
  { category: 'Policy Violation', high: 3, medium: 12, low: 18 },
  { category: 'Session Timeout', high: 1, medium: 6, low: 25 },
  { category: 'Credential Misuse', high: 7, medium: 4, low: 2 },
]

function PAMDashboardPage() {
  return (
    <div>
      <Header title="Privileged Access Management (PAM)" />
      <div className="p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Privileged Accounts" value="410" />
          <KpiCard label="Vaulted Credentials" value="1,247" color="#22c55e" />
          <KpiCard label="Active Sessions" value="38" color="#06b6d4" />
          <KpiCard label="Password Rotation Compliance" value="87.2%" color="#f97316" />
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Privileged Session Activity">
            <div className="h-64">
              <ResponsiveContainer>
                <ComposedChart data={pamSessionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip /><Legend />
                  <Bar yAxisId="left" dataKey="sessions" fill="#7c3aed" name="Sessions" />
                  <Line yAxisId="right" type="monotone" dataKey="alerts" stroke="#ef4444" name="Security Alerts" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Credential Vault Status">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pamVaultData} cx="40%" cy="50%" outerRadius={90} innerRadius={40} dataKey="value" label={({ value }) => `${value}%`}>
                    {pamVaultData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value: string) => <span className="text-xs" style={{ color: '#94a3b8' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Privileged Account Types">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={pamPrivilegedAccountData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#7c3aed" name="Count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Managed Endpoints by Type">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pamEndpointData} cx="40%" cy="50%" outerRadius={90} dataKey="value" label={({ value }) => `${value}%`}>
                    {pamEndpointData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value: string) => <span className="text-xs" style={{ color: '#94a3b8' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <ChartCard title="Credential Checkout / Checkin Trend">
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={pamCheckoutTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip /><Legend />
                  <Line type="monotone" dataKey="checkouts" stroke="#00e5ff" name="Checkouts" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="checkins" stroke="#00ff88" name="Checkins" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Risk Events by Category">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={pamRiskEventsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="category" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip /><Legend />
                  <Bar dataKey="high" stackId="a" fill="#ef4444" name="High" />
                  <Bar dataKey="medium" stackId="a" fill="#f97316" name="Medium" />
                  <Bar dataKey="low" stackId="a" fill="#fbbf24" name="Low" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

/* ═══ CIAM Dashboard ═══ */
const ciamRegistrationTrendData = [
  { month: 'Jan', registrations: 12400, conversions: 9800 }, { month: 'Feb', registrations: 15200, conversions: 12100 },
  { month: 'Mar', registrations: 18700, conversions: 14900 }, { month: 'Apr', registrations: 16300, conversions: 13200 },
  { month: 'May', registrations: 21000, conversions: 17500 }, { month: 'Jun', registrations: 24500, conversions: 20100 },
]
const ciamAuthMethodData = [
  { name: 'Password', value: 35, color: '#00e5ff' }, { name: 'Social Login', value: 28, color: '#00ff88' },
  { name: 'Passwordless', value: 20, color: '#7c3aed' }, { name: 'MFA', value: 12, color: '#f59e0b' },
  { name: 'Biometric', value: 5, color: '#ef4444' },
]
const ciamGeoDistributionData = [
  { region: 'N. America', users: 45000 }, { region: 'Europe', users: 32000 },
  { region: 'Asia Pacific', users: 28000 }, { region: 'Latin America', users: 12000 },
  { region: 'Middle East', users: 5000 }, { region: 'Africa', users: 3000 },
]
const ciamConsentData = [
  { name: 'Consented', value: 72, color: '#00ff88' }, { name: 'Pending', value: 18, color: '#f59e0b' },
  { name: 'Declined', value: 7, color: '#ef4444' }, { name: 'Expired', value: 3, color: '#475569' },
]
const ciamSessionData = [
  { hour: '00:00', active: 1200 }, { hour: '04:00', active: 800 }, { hour: '08:00', active: 3400 },
  { hour: '12:00', active: 5600 }, { hour: '16:00', active: 4800 }, { hour: '20:00', active: 3200 },
  { hour: '23:59', active: 1800 },
]
const ciamDropoffData = [
  { step: 'Landing', users: 10000 }, { step: 'Start Reg', users: 7500 },
  { step: 'Email Verify', users: 5200 }, { step: 'Profile Setup', users: 4100 },
  { step: 'Completed', users: 3400 },
]

function CIAMDashboardPage() {
  return (
    <div>
      <Header title="Customer Identity & Access Management (CIAM)" />
      <div className="p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Customers" value="125,000" />
          <KpiCard label="Monthly Active Users" value="89,450" color="#22c55e" />
          <KpiCard label="Avg. Registration Time" value="2.3 min" color="#06b6d4" />
          <KpiCard label="Self-Service Resolution" value="78.5%" color="#8b5cf6" />
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Social Login Adoption" value="42.1%" color="#f97316" />
          <KpiCard label="Passwordless Adoption" value="28.3%" color="#22c55e" />
          <KpiCard label="Consent Compliance" value="92.4%" color="#3b82f6" />
          <KpiCard label="Fraud Detection Rate" value="99.2%" color="#ef4444" />
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Customer Registration Trend">
            <div className="h-64">
              <ResponsiveContainer>
                <ComposedChart data={ciamRegistrationTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip /><Legend />
                  <Bar dataKey="registrations" fill="#00e5ff" name="New Registrations" />
                  <Line type="monotone" dataKey="conversions" stroke="#00ff88" name="Conversions" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Authentication Methods">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={ciamAuthMethodData} cx="40%" cy="50%" outerRadius={90} innerRadius={40} dataKey="value" label={({ value }) => `${value}%`}>
                    {ciamAuthMethodData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value: string) => <span className="text-xs" style={{ color: '#94a3b8' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Customer Geographic Distribution">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={ciamGeoDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="region" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="users" fill="#00e5ff" name="Users" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Privacy & Consent Status">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={ciamConsentData} cx="40%" cy="50%" outerRadius={90} innerRadius={40} dataKey="value" label={({ value }) => `${value}%`}>
                    {ciamConsentData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value: string) => <span className="text-xs" style={{ color: '#94a3b8' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <ChartCard title="Active Sessions (24h)">
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={ciamSessionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="active" stroke="#00e5ff" name="Active Sessions" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Registration Funnel Drop-off">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={ciamDropoffData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="step" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="users" fill="#f97316" name="Users" radius={[4, 4, 0, 0]}>
                    {ciamDropoffData.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

/* ═══ App Onboarding ═══ */
const appPriorityData = [
  { name: 'High Priority', value: 32.65, color: '#ef4444' },
  { name: 'Medium Priority', value: 40.00, color: '#f59e0b' },
  { name: 'Low Priority', value: 26.18, color: '#00ff88' },
]
const quarterlyStatusData = [
  { quarter: 'October', completed: 8 }, { quarter: 'November', completed: 11 }, { quarter: 'December', completed: 12 },
]

function AppOnboardingPage() {
  return (
    <div>
      <Header title="Application Onboarding Analytics" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <TabNav tabs={['Home']} activeTab="Home" setActiveTab={() => {}} />
          <div className="text-sm rounded-lg px-3 py-1.5" style={{ color: COLORS.textSecondary, border: `1px solid ${COLORS.border}` }}>
            04/01/2025 09:31:59 - 05/01/2025 09:31:59
          </div>
        </div>
        <div className="grid grid-cols-5 gap-4 mb-6">
          <KpiCard label="Applications Onboarded last 3..." value="40" />
          <KpiCard label="Applications Promoted last 30..." value="28" color="#3b82f6" />
          <KpiCard label="Applications Promoted last 30..." value="NA" color="#94a3b8" />
          <KpiCard label="High priority applications..." value="106" color="#ef4444" />
          <KpiCard label="Average Onboarding Time" value="15 days" color="#22c55e" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <ChartCard title="Application Priority Scale">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={appPriorityData} cx="40%" cy="50%" outerRadius={90} dataKey="value" label={({ value }) => `${value}%`}>
                    {appPriorityData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value: string) => <span className="text-xs" style={{ color: '#94a3b8' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Application Quarterly Status Distribution">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={quarterlyStatusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip /><Legend />
                  <Bar dataKey="completed" fill="#00e5ff" name="Promotion Completed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

/* ═══ App Management ═══ */
const orphanAccountsPieData = [
  { name: 'AD Parent', value: 8.33, color: '#00e5ff' }, { name: 'UpgTest0', value: 8.33, color: '#00ff88' },
  { name: 'aprupg6', value: 8.33, color: '#f59e0b' }, { name: 'DemoBrymAD', value: 8.33, color: '#7c3aed' },
  { name: 'UpgTest19', value: 8.33, color: '#ef4444' }, { name: 'CoupaT7', value: 8.33, color: '#06b6d4' },
  { name: 'CourageAppex', value: 8.33, color: '#10b981' }, { name: 'DemoCT23', value: 8.33, color: '#f43f5e' },
  { name: 'AIX', value: 16.67, color: '#8b5cf6' }, { name: 'F-ERP', value: 16.67, color: '#0ea5e9' },
]
const loginFailureTrendData = [
  { month: 'June', authFailed: 200, loginFailure: 5000, mfaError: 800, userAccErr: 300, appError: 100, misc: 50 },
  { month: 'July', authFailed: 150, loginFailure: 3000, mfaError: 600, userAccErr: 200, appError: 80, misc: 30 },
  { month: 'August', authFailed: 300, loginFailure: 8000, mfaError: 1200, userAccErr: 500, appError: 200, misc: 100 },
  { month: 'September', authFailed: 500, loginFailure: 15000, mfaError: 2000, userAccErr: 800, appError: 400, misc: 200 },
  { month: 'October', authFailed: 800, loginFailure: 25000, mfaError: 3500, userAccErr: 1200, appError: 600, misc: 350 },
  { month: 'November', authFailed: 600, loginFailure: 35000, mfaError: 4000, userAccErr: 1500, appError: 800, misc: 400 },
]
const terminatedAccountsData = [
  { month: 'Jan', accounts: 150 }, { month: 'Feb', accounts: 200 }, { month: 'Mar', accounts: 180 },
  { month: 'Apr', accounts: 250 }, { month: 'May', accounts: 350 }, { month: 'Jun', accounts: 500 },
  { month: 'Jul', accounts: 420 }, { month: 'Aug', accounts: 380 },
]
const terminationCompletionData = [
  { period: 'Q1', completed: 700, pending: 50 }, { period: 'Q2', completed: 650, pending: 80 },
  { period: 'Q3', completed: 580, pending: 120 }, { period: 'Q4', completed: 720, pending: 30 },
]

function AppManagementPage() {
  const [activeTab, setActiveTab] = useState('Key Risk Indicators')
  return (
    <div>
      <Header title="Key Risk & Performance Indicators" />
      <div className="p-6">
        <TabNav tabs={['Key Risk Indicators', 'Key Performance Indicators']} activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="grid grid-cols-2 gap-6 mb-6">
          <ChartCard title="Orphan Accounts">
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={orphanAccountsPieData} cx="35%" cy="50%" outerRadius={90} innerRadius={35} dataKey="value" label={({ value }) => `${value}%`}>
                    {orphanAccountsPieData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} formatter={(value: string) => <span className="text-xs" style={{ color: '#94a3b8' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Login Failure Trend">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={loginFailureTrendData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="month" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="authFailed" stackId="a" fill="#94a3b8" name="Auth Failed" />
                  <Bar dataKey="loginFailure" stackId="a" fill="#ef4444" name="Login Failure" />
                  <Bar dataKey="mfaError" stackId="a" fill="#3b82f6" name="MFA Error" />
                  <Bar dataKey="userAccErr" stackId="a" fill="#f97316" name="User Account Error" />
                  <Bar dataKey="appError" stackId="a" fill="#eab308" name="Application Error" />
                  <Bar dataKey="misc" stackId="a" fill="#a855f7" name="Misc." />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <ChartCard title="Terminated Accounts From HR-System">
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={terminatedAccountsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="accounts" stroke="#00e5ff" name="No. of Accounts" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="User Termination Completion Rate">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={terminationCompletionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip /><Legend />
                  <Bar dataKey="completed" fill="#00ff88" name="Completed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" fill="#f59e0b" name="Pending" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

/* ═══ Orphan Accounts ═══ */
const orphanAccountsTableData = [
  { appName: 'F-ERP', accountName: 'F032496', status: 'Active' },
  { appName: 'F-ERP', accountName: 'F032658', status: 'Active' },
  { appName: 'AIX', accountName: 'Henry.Nic', status: 'Active' },
  { appName: 'AIX', accountName: 'Chris.Huego', status: 'Active' },
  { appName: 'Active Directory Parent', accountName: 'pnshetty', status: 'Active' },
  { appName: 'aprupg6', accountName: 'pnshetty', status: 'Active' },
  { appName: 'AprilUpgradeTest19', accountName: 'pnshetty', status: 'Active' },
  { appName: 'DemoBrymAD', accountName: 'jsmith', status: 'Active' },
  { appName: 'CoupaAmeliaT7', accountName: 'admin_ops', status: 'Active' },
  { appName: 'CourageLogsAppex', accountName: 'svc_monitor', status: 'Active' },
  { appName: 'DemoCT23', accountName: 'test.user', status: 'Active' },
  { appName: 'AprilUpgradeTest0', accountName: 'backup_admin', status: 'Active' },
]
const orphanBarData = [
  { app: 'F-ERP', count: 2 }, { app: 'AIX', count: 2 }, { app: 'AD Parent', count: 1 },
  { app: 'aprupg6', count: 1 }, { app: 'UpgTest19', count: 1 }, { app: 'DemoBrym', count: 1 },
  { app: 'CoupaT7', count: 1 }, { app: 'Courage', count: 1 }, { app: 'DemoCT23', count: 1 },
  { app: 'UpgTest0', count: 1 },
]

function OrphanAccountsPage({ setActivePage }: { setActivePage: (p: Page) => void }) {
  const [searchTerm, setSearchTerm] = useState('')
  const filteredData = orphanAccountsTableData.filter(
    (row) => row.appName.toLowerCase().includes(searchTerm.toLowerCase()) || row.accountName.toLowerCase().includes(searchTerm.toLowerCase())
  )
  return (
    <div>
      <Header title="Orphan Accounts" />
      <div className="p-6">
        <button onClick={() => setActivePage('iga-warehouse')} className="text-sm hover:underline mb-4 inline-block" style={{ color: COLORS.primary }}>
          &larr; Back to Identity Warehouse
        </button>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>Orphan Accounts</h2>
          <div className="flex items-center gap-2">
            <Download size={16} style={{ color: '#475569' }} />
            <RefreshCw size={16} style={{ color: '#475569' }} />
            <Maximize2 size={16} style={{ color: '#475569' }} />
          </div>
        </div>
        <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.border}` }}>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={orphanBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2a42" />
                <XAxis dataKey="app" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#00e5ff" name="Orphan Accounts" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex justify-end mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a' }}>
            <Search size={14} style={{ color: '#475569' }} />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="text-sm outline-none bg-transparent w-48" style={{ color: '#94a3b8' }} />
          </div>
        </div>
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#0f1629' }}>
                <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: COLORS.textSecondary, borderBottom: `1px solid ${COLORS.border}` }}>Application Name</th>
                <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: COLORS.textSecondary, borderBottom: `1px solid ${COLORS.border}` }}>Account Name</th>
                <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: COLORS.textSecondary, borderBottom: `1px solid ${COLORS.border}` }}>Account Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, i) => (
                <tr key={i} className="transition-colors" style={{ backgroundColor: i % 2 === 0 ? COLORS.cardBg : '#0f1629' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>{row.appName}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}>{row.accountName}</td>
                  <td className="px-4 py-3 text-sm" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#00ff8822', color: '#00ff88' }}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ═══ CMDB Integration ═══ */
type CmdbRow = Record<string, string>
type HeaderMap = Record<string, string>
type ApiHeader = { key: string; value: string }

type CmdbMode = 'sample' | 'csv' | 'api'

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (ch === ',' && !inQuotes) {
      out.push(current)
      current = ''
      continue
    }

    current += ch
  }

  out.push(current)
  return out.map((v) => v.trim())
}

function parseCsvText(text: string): { headers: string[]; rows: CmdbRow[]; error?: string } {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    return { headers: [], rows: [], error: 'CSV must include a header row and at least one data row.' }
  }

  const headers = parseCsvLine(lines[0])
  if (headers.length === 0) {
    return { headers: [], rows: [], error: 'CSV header row is empty.' }
  }

  const rows: CmdbRow[] = []
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line)
    const row: CmdbRow = {}
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = cells[i] ?? ''
    }
    rows.push(row)
  }

  return { headers, rows }
}

function guessHeaderMap(targetHeaders: string[], sourceHeaders: string[]): HeaderMap {
  const sourceLower = new Map(sourceHeaders.map((h) => [h.toLowerCase(), h]))
  const map: HeaderMap = {}

  for (const target of targetHeaders) {
    const exact = sourceHeaders.includes(target) ? target : undefined
    const ci = sourceLower.get(target.toLowerCase())
    map[target] = exact ?? ci ?? ''
  }

  return map
}

function normalizeRows(rawRows: CmdbRow[], targetHeaders: string[], map: HeaderMap): CmdbRow[] {
  return rawRows.map((raw) => {
    const row: CmdbRow = {}
    for (const target of targetHeaders) {
      const source = map[target]
      row[target] = source ? (raw[source] ?? '') : ''
    }
    return row
  })
}

function jsonToRows(data: unknown): { headers: string[]; rows: CmdbRow[]; error?: string } {
  const records: Record<string, unknown>[] = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : typeof data === 'object' && data !== null && Array.isArray((data as { data?: unknown }).data)
      ? ((data as { data: Record<string, unknown>[] }).data)
      : []

  if (records.length === 0) {
    return { headers: [], rows: [], error: 'API response must be an array of objects (or { data: [...] }).' }
  }

  const headerSet = new Set<string>()
  for (const r of records) {
    Object.keys(r).forEach((k) => headerSet.add(k))
  }

  const headers = Array.from(headerSet)
  const rows: CmdbRow[] = records.map((r) => {
    const out: CmdbRow = {}
    for (const h of headers) {
      const v = r[h]
      out[h] = v === null || v === undefined ? '' : typeof v === 'string' ? v : String(v)
    }
    return out
  })

  return { headers, rows }
}

function CMDBPage({ onSelectApp }: { onSelectApp: (app: CmdbRow) => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [mode, setMode] = useState<CmdbMode>('sample')
  const [rawHeaders, setRawHeaders] = useState<string[]>(DEFAULT_CMDB_HEADERS)
  const [rawRows, setRawRows] = useState<CmdbRow[]>(DEFAULT_CMDB_DATA)

  const [targetHeaders, setTargetHeaders] = useState<string[]>(DEFAULT_CMDB_HEADERS)
  const [headerMap, setHeaderMap] = useState<HeaderMap>(() => guessHeaderMap(DEFAULT_CMDB_HEADERS, DEFAULT_CMDB_HEADERS))

  const [mappingOpen, setMappingOpen] = useState(true)
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [apiUrl, setApiUrl] = useState('')
  const [apiHeaders, setApiHeaders] = useState<ApiHeader[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const mappedRows = normalizeRows(rawRows, targetHeaders, headerMap)

  const visibleColumns = (() => {
    if (showAllColumns) return targetHeaders
    const core = [
      'Application ID',
      'Application Name',
      'Vendor',
      'Department',
      'Environment',
      'Criticality',
      'Risk Level',
      'MFA Enabled',
      'SSO Integrated',
      'PAM Managed',
      'Orphan Accounts',
      'Privileged Accounts',
      'IAM Controls',
    ]
    return core.filter((c) => targetHeaders.includes(c))
  })()

  const filteredRows = mappedRows.filter((row) => {
    const hay = [
      row['Application Name'] ?? '',
      row['Application ID'] ?? '',
      row['Vendor'] ?? '',
    ].join(' ').toLowerCase()
    return hay.includes(searchTerm.toLowerCase())
  })

  const kpi = (() => {
    const total = mappedRows.length
    const yes = (v: string | undefined) => (v ?? '').toLowerCase() === 'yes'

    const mfa = total ? (mappedRows.filter((r) => yes(r['MFA Enabled'])).length / total) * 100 : 0
    const sso = total ? (mappedRows.filter((r) => yes(r['SSO Integrated'])).length / total) * 100 : 0
    const pam = total ? (mappedRows.filter((r) => yes(r['PAM Managed'])).length / total) * 100 : 0

    const critical = mappedRows.filter((r) => (r['Criticality'] ?? '').toLowerCase() === 'critical').length
    const highRisk = mappedRows.filter((r) => (r['Risk Level'] ?? '').toLowerCase() === 'high').length

    return {
      total,
      critical,
      highRisk,
      mfa: `${mfa.toFixed(1)}%`,
      sso: `${sso.toFixed(1)}%`,
      pam: `${pam.toFixed(1)}%`,
    }
  })()

  const setSource = useCallback((opts: {
    nextHeaders: string[]
    nextRows: CmdbRow[]
    message: string
    nextTargetHeaders?: string[]
  }) => {
    const targets = opts.nextTargetHeaders ?? targetHeaders

    if (opts.nextTargetHeaders) {
      setTargetHeaders(opts.nextTargetHeaders)
    }

    setRawHeaders(opts.nextHeaders)
    setRawRows(opts.nextRows)
    setHeaderMap(guessHeaderMap(targets, opts.nextHeaders))
    setError(null)
    setNotice(opts.message)
  }, [targetHeaders])

  const handleLoadSample = useCallback(() => {
    setMode('sample')
    setSource({
      nextHeaders: DEFAULT_CMDB_HEADERS,
      nextRows: DEFAULT_CMDB_DATA,
      message: 'Loaded sample CMDB (100 apps).',
      nextTargetHeaders: DEFAULT_CMDB_HEADERS,
    })
  }, [setSource])

  const handleCsvUpload = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      const text = await file.text()
      const parsed = parseCsvText(text)
      if (parsed.error) {
        setError(parsed.error)
        return
      }
      setMode('csv')
      setSource({
        nextHeaders: parsed.headers,
        nextRows: parsed.rows,
        message: `Loaded CSV: ${file.name}`,
      })
    } finally {
      setLoading(false)
    }
  }, [setSource])

  const handleFetchApi = useCallback(async () => {
    if (!apiUrl.trim()) {
      setError('Enter an API URL to fetch CMDB data.')
      return
    }

    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      const headers: Record<string, string> = {}
      for (const h of apiHeaders) {
        if (h.key.trim()) headers[h.key.trim()] = h.value
      }

      const resp = await fetch(apiUrl.trim(), { headers })
      if (!resp.ok) {
        setError(`API request failed: ${resp.status} ${resp.statusText}`)
        return
      }

      const data = await resp.json()
      const parsed = jsonToRows(data)
      if (parsed.error) {
        setError(parsed.error)
        return
      }

      setMode('api')
      setSource({
        nextHeaders: parsed.headers,
        nextRows: parsed.rows,
        message: `Loaded ${parsed.rows.length} records from API.`,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'API request failed.')
    } finally {
      setLoading(false)
    }
  }, [apiHeaders, apiUrl, setSource])

  const duplicateTargets = (() => {
    const seen = new Set<string>()
    const dup = new Set<string>()
    for (const t of targetHeaders) {
      const key = t.trim().toLowerCase()
      if (!key) continue
      if (seen.has(key)) dup.add(key)
      seen.add(key)
    }
    return dup.size > 0
  })()

  return (
    <div>
      <Header title="CMDB Integration" />
      <div className="p-6">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>Configuration Management Database (CMDB)</h1>
            <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
              Ingest CMDB data via API or CSV and map headers to your IAM control fields.
            </p>
          </div>
          <a
            href="/cmdb_sample.csv"
            className="text-sm inline-flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: COLORS.primary }}
          >
            <Download size={16} />
            Download sample CSV
          </a>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={handleLoadSample}
            className="rounded-lg p-4 text-left transition-colors"
            style={{ border: `1px solid ${COLORS.border}`, backgroundColor: mode === 'sample' ? COLORS.sidebarHover : COLORS.cardBg }}
          >
            <div className="flex items-center gap-2 mb-1" style={{ color: COLORS.primary }}>
              <Database size={18} />
              <span className="text-sm font-semibold">Sample CMDB</span>
            </div>
            <div className="text-xs" style={{ color: COLORS.textSecondary }}>Load built-in fictitious CMDB (100 apps)</div>
          </button>

          <button
            onClick={() => {
              setMode('csv')
              fileInputRef.current?.click()
            }}
            className="rounded-lg p-4 text-left transition-colors"
            style={{ border: `1px solid ${COLORS.border}`, backgroundColor: mode === 'csv' ? COLORS.sidebarHover : COLORS.cardBg }}
          >
            <div className="flex items-center gap-2 mb-1" style={{ color: COLORS.primary }}>
              <FileUp size={18} />
              <span className="text-sm font-semibold">CSV Upload</span>
            </div>
            <div className="text-xs" style={{ color: COLORS.textSecondary }}>Upload a CMDB export (headers can be mapped)</div>
          </button>

          <button
            onClick={() => setMode('api')}
            className="rounded-lg p-4 text-left transition-colors"
            style={{ border: `1px solid ${COLORS.border}`, backgroundColor: mode === 'api' ? COLORS.sidebarHover : COLORS.cardBg }}
          >
            <div className="flex items-center gap-2 mb-1" style={{ color: COLORS.primary }}>
              <Wifi size={18} />
              <span className="text-sm font-semibold">API</span>
            </div>
            <div className="text-xs" style={{ color: COLORS.textSecondary }}>Fetch CMDB data from an API endpoint</div>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleCsvUpload(f)
          }}
        />

        {mode === 'api' && (
          <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>API Connection</div>
              <button
                onClick={() => setApiHeaders((prev) => [...prev, { key: '', value: '' }])}
                className="text-sm inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: COLORS.primary }}
              >
                <Plus size={14} />
                Add header
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="col-span-2">
                <label className="text-xs" style={{ color: COLORS.textSecondary }}>URL</label>
                <input
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://example.com/api/cmdb"
                  className="mt-1 w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: COLORS.textPrimary }}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleFetchApi}
                  className="w-full text-sm px-3 py-2 rounded-lg font-semibold"
                  style={{ backgroundColor: COLORS.primary, color: '#0a0e1a' }}
                  disabled={loading}
                >
                  {loading ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
            </div>

            {apiHeaders.length > 0 && (
              <div className="space-y-2">
                {apiHeaders.map((h, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <input
                      value={h.key}
                      onChange={(e) => setApiHeaders((prev) => prev.map((x, i) => i === idx ? { ...x, key: e.target.value } : x))}
                      placeholder="Header name (e.g., Authorization)"
                      className="col-span-5 text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: COLORS.textPrimary }}
                    />
                    <input
                      value={h.value}
                      onChange={(e) => setApiHeaders((prev) => prev.map((x, i) => i === idx ? { ...x, value: e.target.value } : x))}
                      placeholder="Header value"
                      className="col-span-6 text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: COLORS.textPrimary }}
                    />
                    <button
                      onClick={() => setApiHeaders((prev) => prev.filter((_, i) => i !== idx))}
                      className="col-span-1 flex items-center justify-center rounded-lg"
                      style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: '#64748b' }}
                      title="Remove header"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(error || notice || duplicateTargets) && (
          <div className="rounded-lg p-3 mb-6 flex items-start gap-2" style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a' }}>
            {error ? <AlertTriangle size={16} style={{ color: COLORS.danger }} /> : <Check size={16} style={{ color: COLORS.accent }} />}
            <div className="text-sm" style={{ color: error ? COLORS.danger : COLORS.textSecondary }}>
              {duplicateTargets ? 'Header mapping has duplicate target field names. Rename duplicates to continue.' : (error ?? notice)}
            </div>
          </div>
        )}

        <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Header mapping</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHeaderMap(guessHeaderMap(targetHeaders, rawHeaders))}
                className="text-sm px-3 py-1.5 rounded-lg"
                style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: COLORS.primary }}
              >
                Auto-map
              </button>
              <button
                onClick={() => setMappingOpen((v) => !v)}
                className="text-sm px-3 py-1.5 rounded-lg"
                style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: '#94a3b8' }}
              >
                {mappingOpen ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {mappingOpen && (
            <div>
              <div className="text-xs mb-3" style={{ color: COLORS.textSecondary }}>
                Map your incoming CMDB headers (source) to the IAM control fields you want to track (target).
              </div>

              <div className="space-y-2">
                {targetHeaders.map((target, idx) => (
                  <div key={`${target}-${idx}`} className="grid grid-cols-12 gap-2">
                    <input
                      value={target}
                      onChange={(e) => {
                        const nextName = e.target.value
                        setTargetHeaders((prev) => {
                          const next = [...prev]
                          const oldName = next[idx]
                          next[idx] = nextName
                          setHeaderMap((prevMap) => {
                            const src = prevMap[oldName] ?? ''
                            const nextMap: HeaderMap = { ...prevMap }
                            delete nextMap[oldName]
                            nextMap[nextName] = src
                            return nextMap
                          })
                          return next
                        })
                      }}
                      className="col-span-5 text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: COLORS.textPrimary }}
                    />

                    <select
                      value={headerMap[target] ?? ''}
                      onChange={(e) => setHeaderMap((prev) => ({ ...prev, [target]: e.target.value }))}
                      className="col-span-6 text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: COLORS.textPrimary }}
                    >
                      <option value="">— not mapped —</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        setTargetHeaders((prev) => prev.filter((_, i) => i !== idx))
                        setHeaderMap((prev) => {
                          const next: HeaderMap = { ...prev }
                          delete next[target]
                          return next
                        })
                      }}
                      className="col-span-1 flex items-center justify-center rounded-lg"
                      style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: '#64748b' }}
                      title="Remove field"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => {
                    const name = `Custom Field ${targetHeaders.length + 1}`
                    setTargetHeaders((prev) => [...prev, name])
                    setHeaderMap((prev) => ({ ...prev, [name]: '' }))
                  }}
                  className="text-sm inline-flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: COLORS.primary }}
                >
                  <Plus size={14} />
                  Add field
                </button>
                <button
                  onClick={() => {
                    setTargetHeaders(DEFAULT_CMDB_HEADERS)
                    setHeaderMap(guessHeaderMap(DEFAULT_CMDB_HEADERS, rawHeaders))
                  }}
                  className="text-sm px-3 py-2 rounded-lg"
                  style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: '#94a3b8' }}
                >
                  Reset fields
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-6 gap-4 mb-6">
          <KpiCard label="Apps" value={String(kpi.total)} />
          <KpiCard label="Critical" value={String(kpi.critical)} color={COLORS.danger} />
          <KpiCard label="High Risk" value={String(kpi.highRisk)} color={COLORS.warning} />
          <KpiCard label="MFA Coverage" value={kpi.mfa} color={COLORS.accent} />
          <KpiCard label="SSO Coverage" value={kpi.sso} color={COLORS.primary} />
          <KpiCard label="PAM Coverage" value={kpi.pam} color="#7c3aed" />
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a' }}>
            <Search size={14} style={{ color: '#475569' }} />
            <input
              type="text"
              placeholder="Search apps, IDs, vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm outline-none bg-transparent w-80"
              style={{ color: '#94a3b8' }}
            />
          </div>

          <button
            onClick={() => setShowAllColumns((v) => !v)}
            className="text-sm px-3 py-2 rounded-lg"
            style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a', color: COLORS.primary }}
          >
            {showAllColumns ? 'Show core columns' : 'Show all columns'}
          </button>
        </div>

        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#0f1629' }}>
                {visibleColumns.map((c) => (
                  <th
                    key={c}
                    className="text-left px-4 py-3 text-sm font-semibold"
                    style={{ color: COLORS.textSecondary, borderBottom: `1px solid ${COLORS.border}` }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 250).map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onSelectApp(row)}
                  className="transition-colors cursor-pointer hover:brightness-110"
                  style={{ backgroundColor: i % 2 === 0 ? COLORS.cardBg : '#0f1629' }}
                >
                  {visibleColumns.map((c) => (
                    <td
                      key={c}
                      className="px-4 py-3 text-sm"
                      style={{ color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}
                    >
                      {row[c]}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm" style={{ color: COLORS.textSecondary }} colSpan={visibleColumns.length}>
                    No results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs mt-3" style={{ color: COLORS.textSecondary }}>
          Showing {Math.min(filteredRows.length, 250)} of {filteredRows.length} rows.
        </div>
      </div>
    </div>
  )
}

function CMDBAppDashboardPage({ app, onBack }: { app: CmdbRow; onBack: () => void }) {
  type Status = 'good' | 'warn' | 'bad' | 'na'

  const yes = (v: string | undefined) => (v ?? '').toLowerCase() === 'yes'

  const statusColor = (s: Status) => {
    if (s === 'good') return COLORS.accent
    if (s === 'warn') return COLORS.warning
    if (s === 'bad') return COLORS.danger
    return COLORS.textSecondary
  }

  const statusLabel = (s: Status) => {
    if (s === 'good') return 'OK'
    if (s === 'warn') return 'ATTN'
    if (s === 'bad') return 'GAP'
    return 'N/A'
  }

  const parseIntSafe = (v: string | undefined) => {
    const n = Number.parseInt((v ?? '').replace(/[^0-9]/g, ''), 10)
    return Number.isFinite(n) ? n : 0
  }

  const parseDate = (v: string | undefined) => {
    const s = (v ?? '').trim()
    if (!s) return null
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const daysSince = (d: Date | null) => {
    if (!d) return null
    const ms = Date.now() - d.getTime()
    return Math.floor(ms / (1000 * 60 * 60 * 24))
  }

  const accessReviewStatus = (() => {
    const freq = (app['Access Review Frequency'] ?? '').toLowerCase()
    if (!freq || freq === 'none') return { status: 'na' as Status, detail: 'No cadence set' }

    const last = parseDate(app['Last Access Review'])
    const age = daysSince(last)
    if (age === null) return { status: 'bad' as Status, detail: 'Missing last review date' }

    const allowedDays =
      freq.includes('monthly') ? 35 :
        freq.includes('quarter') ? 110 :
          freq.includes('semi') ? 220 :
            freq.includes('annual') ? 400 : 220

    if (age > allowedDays) return { status: 'bad' as Status, detail: `Overdue (${age}d since last review)` }
    if (age > allowedDays * 0.8) return { status: 'warn' as Status, detail: `Due soon (${age}d since last review)` }
    return { status: 'good' as Status, detail: `Within cadence (${age}d since last review)` }
  })()

  const provisioningStatus = (() => {
    const v = (app['Provisioning Method'] ?? '').toLowerCase()
    if (!v) return { status: 'na' as Status, detail: 'Not specified' }
    if (v.includes('automated')) return { status: 'good' as Status, detail: 'Automated provisioning' }
    if (v.includes('manual')) return { status: 'bad' as Status, detail: 'Manual provisioning' }
    return { status: 'warn' as Status, detail: app['Provisioning Method'] ?? '' }
  })()

  const orphanStatus = (() => {
    const n = parseIntSafe(app['Orphan Accounts'])
    if (n >= 25) return { status: 'bad' as Status, detail: `${n} orphan accounts` }
    if (n >= 10) return { status: 'warn' as Status, detail: `${n} orphan accounts` }
    return { status: 'good' as Status, detail: `${n} orphan accounts` }
  })()

  const privilegedStatus = (() => {
    const n = parseIntSafe(app['Privileged Accounts'])
    if (n >= 20) return { status: 'warn' as Status, detail: `${n} privileged accounts` }
    if (n >= 35) return { status: 'bad' as Status, detail: `${n} privileged accounts` }
    return { status: 'good' as Status, detail: `${n} privileged accounts` }
  })()

  const controls = [
    {
      name: 'MFA Enabled',
      status: yes(app['MFA Enabled']) ? ('good' as Status) : ('bad' as Status),
      detail: yes(app['MFA Enabled']) ? 'Enabled' : 'Not enabled',
    },
    {
      name: 'SSO Integrated',
      status: yes(app['SSO Integrated']) ? ('good' as Status) : ('warn' as Status),
      detail: yes(app['SSO Integrated']) ? 'Integrated' : 'Not integrated',
    },
    {
      name: 'PAM Managed',
      status: yes(app['PAM Managed']) ? ('good' as Status) : ('warn' as Status),
      detail: yes(app['PAM Managed']) ? 'Onboarded to PAM' : 'Not PAM-managed',
    },
    {
      name: 'Provisioning',
      status: provisioningStatus.status,
      detail: provisioningStatus.detail,
    },
    {
      name: 'Access Reviews',
      status: accessReviewStatus.status,
      detail: accessReviewStatus.detail,
    },
    {
      name: 'Orphan Accounts',
      status: orphanStatus.status,
      detail: orphanStatus.detail,
    },
    {
      name: 'Privileged Accounts',
      status: privilegedStatus.status,
      detail: privilegedStatus.detail,
    },
  ]

  const controlSummary = (() => {
    const counts = { good: 0, warn: 0, bad: 0, na: 0 }
    for (const c of controls) counts[c.status]++
    return counts
  })()

  const recommendations = (() => {
    const recs: string[] = []
    if (!yes(app['MFA Enabled'])) recs.push('Enable MFA for all interactive access.')
    if (!yes(app['SSO Integrated'])) recs.push('Integrate application with enterprise SSO (SAML/OIDC).')
    if (!yes(app['PAM Managed']) && (app['Criticality'] ?? '').toLowerCase() !== 'low') recs.push('Onboard privileged accounts/sessions into PAM and vaulting.')
    if (provisioningStatus.status === 'bad') recs.push('Automate provisioning/deprovisioning (SCIM/API) to reduce orphan accounts.')
    if (accessReviewStatus.status === 'bad' || accessReviewStatus.status === 'warn') recs.push('Perform an access review and confirm the review cadence.')
    if (orphanStatus.status !== 'good') recs.push('Investigate and remediate orphan accounts.')
    return recs
  })()

  const statusPieData = [
    { name: 'OK', value: controlSummary.good, color: COLORS.accent },
    { name: 'ATTN', value: controlSummary.warn, color: COLORS.warning },
    { name: 'GAP', value: controlSummary.bad, color: COLORS.danger },
    { name: 'N/A', value: controlSummary.na, color: '#64748b' },
  ].filter((d) => d.value > 0)

  return (
    <div>
      <Header title="CMDB App Dashboard" />
      <div className="p-6">
        <button
          onClick={onBack}
          className="text-sm hover:underline mb-4 inline-flex items-center gap-2"
          style={{ color: COLORS.primary }}
        >
          <ChevronLeft size={16} />
          Back to CMDB
        </button>

        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: COLORS.textPrimary }}>
              {app['Application Name'] || 'Application'}
              <span className="text-sm font-normal ml-3" style={{ color: COLORS.textSecondary }}>{app['Application ID']}</span>
            </h1>
            <div className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
              {app['Vendor']} • {app['Department']} • {app['Environment']}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#0a0e1a', border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary }}>
              Criticality: <span style={{ color: COLORS.textPrimary }}>{app['Criticality']}</span>
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#0a0e1a', border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary }}>
              Risk: <span style={{ color: COLORS.textPrimary }}>{app['Risk Level']}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard label="Users" value={app['User Count'] || '—'} />
          <KpiCard label="Orphan Accts" value={app['Orphan Accounts'] || '—'} color={statusColor(orphanStatus.status)} />
          <KpiCard label="Privileged" value={app['Privileged Accounts'] || '—'} color={statusColor(privilegedStatus.status)} />
          <KpiCard label="Compliance" value={app['Compliance Framework'] || '—'} color={COLORS.primary} />
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <ChartCard title="IAM Control Posture">
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
                    {statusPieData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Control Status">
            <div className="space-y-3">
              {controls.map((c) => (
                <div key={c.name} className="flex items-start justify-between gap-3 rounded-lg px-3 py-2" style={{ border: `1px solid ${COLORS.border}`, backgroundColor: '#0a0e1a' }}>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: statusColor(c.status) }} />
                    <div>
                      <div className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>{c.name}</div>
                      <div className="text-xs" style={{ color: COLORS.textSecondary }}>{c.detail}</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${statusColor(c.status)}22`, color: statusColor(c.status) }}>
                    {statusLabel(c.status)}
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="Recommendations">
            <div className="space-y-2">
              {recommendations.length === 0 ? (
                <div className="text-sm" style={{ color: COLORS.textSecondary }}>No critical gaps detected.</div>
              ) : (
                recommendations.map((r, i) => (
                  <div key={i} className="text-sm" style={{ color: COLORS.textSecondary }}>• {r}</div>
                ))
              )}
              <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <div className="text-xs font-semibold mb-2" style={{ color: COLORS.textSecondary }}>IAM Controls (raw)</div>
                <div className="text-sm" style={{ color: COLORS.textPrimary }}>{app['IAM Controls'] || '—'}</div>
              </div>
            </div>
          </ChartCard>
        </div>

        <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.border}` }}>
          <div className="text-sm font-semibold mb-2" style={{ color: COLORS.textPrimary }}>Application metadata</div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs" style={{ color: COLORS.textSecondary }}>Auth Method</div>
              <div className="text-sm" style={{ color: COLORS.textPrimary }}>{app['Authentication Method'] || '—'}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: COLORS.textSecondary }}>Data Classification</div>
              <div className="text-sm" style={{ color: COLORS.textPrimary }}>{app['Data Classification'] || '—'}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: COLORS.textSecondary }}>SOX Applicable</div>
              <div className="text-sm" style={{ color: COLORS.textPrimary }}>{app['SOX Applicable'] || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══ Main App ═══ */
function App() {
  const [activePage, setActivePage] = useState<Page>('insights')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedCmdbApp, setSelectedCmdbApp] = useState<CmdbRow | null>(null)

  const handleSelectApp = (app: CmdbRow) => {
    setSelectedCmdbApp(app)
    setActivePage('cmdb-app')
  }

  const handleBackToCmdb = () => {
    setSelectedCmdbApp(null)
    setActivePage('cmdb')
  }

  const renderPage = () => {
    switch (activePage) {
      case 'insights': return <ProgramInsightsPage setActivePage={setActivePage} />
      case 'iga-warehouse': return <IGAWarehousePage setActivePage={setActivePage} />
      case 'access-management': return <AccessManagementPage />
      case 'pam': return <PAMDashboardPage />
      case 'ciam': return <CIAMDashboardPage />
      case 'app-onboarding': return <AppOnboardingPage />
      case 'app-management': return <AppManagementPage />
      case 'orphan-accounts': return <OrphanAccountsPage setActivePage={setActivePage} />
      case 'cmdb': return <CMDBPage onSelectApp={handleSelectApp} />
      case 'cmdb-app': return selectedCmdbApp ? <CMDBAppDashboardPage app={selectedCmdbApp} onBack={handleBackToCmdb} /> : <CMDBPage onSelectApp={handleSelectApp} />
      default: return <ProgramInsightsPage setActivePage={setActivePage} />
    }
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: COLORS.pageBg }}>
      <Sidebar activePage={activePage} setActivePage={setActivePage} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <main className="flex-1 transition-all duration-300" style={{ marginLeft: sidebarCollapsed ? 64 : 220 }}>
        {renderPage()}
      </main>
    </div>
  )
}

export default App
