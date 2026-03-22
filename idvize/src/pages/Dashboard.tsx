import { Link } from 'react-router-dom'
import { BarChart2, ShieldCheck, ShieldAlert, UserCheck } from 'lucide-react'

const dashboards = [
  { icon: BarChart2,   label: 'IGA',                title: 'Identity Governance & Administration', path: '/iga',               color: '#6366f1', bg: 'bg-indigo-900/20 border-indigo-800/40' },
  { icon: ShieldCheck, label: 'Access Management',   title: 'Authentication, SSO & MFA analytics',  path: '/access-management', color: '#06b6d4', bg: 'bg-cyan-900/20 border-cyan-800/40' },
  { icon: ShieldAlert, label: 'PAM',                 title: 'Privileged Access Management',          path: '/pam',               color: '#f59e0b', bg: 'bg-amber-900/20 border-amber-800/40' },
  { icon: UserCheck,   label: 'CIAM',                title: 'Customer Identity & Access Management', path: '/ciam',              color: '#22c55e', bg: 'bg-green-900/20 border-green-800/40' },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-500 mt-1 text-sm">Identity & Access Management analytics overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {dashboards.map(({ icon: Icon, label, title, path, color, bg }) => (
          <Link
            key={path}
            to={path}
            className={`flex flex-col gap-4 p-6 rounded-xl border transition-all hover:scale-[1.02] hover:shadow-lg ${bg}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                   style={{ backgroundColor: `${color}20` }}>
                <Icon size={20} style={{ color }} />
              </div>
              <span className="font-semibold text-white">{label}</span>
            </div>
            <p className="text-slate-400 text-sm">{title}</p>
            <span className="text-xs font-medium mt-auto" style={{ color }}>View Dashboard →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
