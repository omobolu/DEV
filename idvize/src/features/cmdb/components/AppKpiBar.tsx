/**
 * Top KPI summary bar — Users / Orphan Accts / Privileged / Compliance
 * Matches the 4-card header row shown in the design reference.
 */
interface AppKpiBarProps {
  users: number
  orphanAccounts: number
  privilegedAccounts: number
  compliance: string
}

interface KpiItemProps {
  label: string
  value: string | number
  valueClass?: string
  border?: boolean
}

function KpiItem({ label, value, valueClass = 'text-cyan-400', border = true }: KpiItemProps) {
  return (
    <div
      className={`flex-1 bg-surface-800 px-6 py-4 flex flex-col gap-1
        ${border ? 'border-r border-surface-700' : ''}`}
    >
      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-3xl font-bold leading-none ${valueClass}`}>{
        typeof value === 'number' ? value.toLocaleString() : value
      }</p>
    </div>
  )
}

export default function AppKpiBar({ users, orphanAccounts, privilegedAccounts, compliance }: AppKpiBarProps) {
  const orphanClass = orphanAccounts > 20 ? 'text-red-400' : orphanAccounts > 5 ? 'text-amber-400' : 'text-green-400'
  const privClass   = privilegedAccounts > 100 ? 'text-red-400' : privilegedAccounts > 30 ? 'text-amber-400' : 'text-slate-200'

  return (
    <div className="flex rounded-xl overflow-hidden border border-surface-700">
      <KpiItem label="Users"          value={users}              valueClass="text-cyan-400" />
      <KpiItem label="Orphan Accts"   value={orphanAccounts}     valueClass={orphanClass} />
      <KpiItem label="Privileged"     value={privilegedAccounts} valueClass={privClass} />
      <KpiItem label="Compliance"     value={compliance}         valueClass="text-violet-400" border={false} />
    </div>
  )
}
