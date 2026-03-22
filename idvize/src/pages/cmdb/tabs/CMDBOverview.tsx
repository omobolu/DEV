import { useMemo } from 'react'
import { useCMDB } from '@/context/CMDBContext'
import KpiCard from '@/components/common/KpiCard'
import ChartCard from '@/components/common/ChartCard'
import SolidPieChart from '@/components/charts/SolidPieChart'
import HorizontalBarChart from '@/components/charts/HorizontalBarChart'
import VerticalBarChart from '@/components/charts/VerticalBarChart'
import { Clock } from 'lucide-react'

export default function CMDBOverview() {
  const { apps, lastImportMeta } = useCMDB()
  const n = apps.length

  const appTypeData = useMemo(() => {
    const palette = ['#8b5cf6','#a78bfa','#c4b5fd','#6d28d9']
    const counts: Record<string, number> = {}
    apps.forEach(a => { counts[a.appType] = (counts[a.appType] ?? 0) + 1 })
    return Object.entries(counts).map(([name, value], i) => ({ name, value, fill: palette[i % palette.length] }))
  }, [apps])

  const criticalityData = useMemo(() => {
    const palette: Record<string, string> = { Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e' }
    const counts: Record<string, number> = {}
    apps.forEach(a => { counts[a.businessCriticality] = (counts[a.businessCriticality] ?? 0) + 1 })
    return ['Critical','High','Medium','Low'].filter(k => counts[k]).map(name => ({ name, value: counts[name], fill: palette[name] }))
  }, [apps])

  const controlCoverage = useMemo(() => {
    if (!n) return []
    return [
      { name: 'SSO',  value: Math.round(apps.filter(a => a.ssoEnabled).length / n * 100) },
      { name: 'MFA',  value: Math.round(apps.filter(a => a.mfaRequired).length / n * 100) },
      { name: 'PAM',  value: Math.round(apps.filter(a => a.pamVaulted).length / n * 100) },
      { name: 'RBAC', value: Math.round(apps.filter(a => a.rbacEnabled).length / n * 100) },
      { name: 'JIT',  value: Math.round(apps.filter(a => a.jitAccess).length / n * 100) },
      { name: 'SoD',  value: Math.round(apps.filter(a => a.sodPoliciesDefined).length / n * 100) },
    ]
  }, [apps, n])

  const onboardingData = useMemo(() => {
    const palette: Record<string, string> = { Onboarded: '#22c55e', 'In Progress': '#6366f1', Planned: '#06b6d4', 'Not Started': '#f97316' }
    const counts: Record<string, number> = {}
    apps.forEach(a => { counts[a.onboardingStatus] = (counts[a.onboardingStatus] ?? 0) + 1 })
    return ['Onboarded','In Progress','Planned','Not Started'].map(label => ({
      label,
      count: counts[label] ?? 0,
      fill: palette[label],
    })) as Record<string, unknown>[]
  }, [apps])

  if (!n) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-600">No CMDB data loaded — use the Import tab to load data.</p>
    </div>
  )

  const ssoCount  = apps.filter(a => a.ssoEnabled).length
  const mfaCount  = apps.filter(a => a.mfaRequired).length
  const orphans   = apps.reduce((s, a) => s + a.orphanAccounts, 0)

  return (
    <div className="space-y-6">
      {lastImportMeta && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-surface-800 border border-surface-700 rounded-lg px-4 py-2 w-fit">
          <Clock size={12} />
          Last import: <span className="text-slate-400 font-medium">{lastImportMeta.source}</span>
          &nbsp;·&nbsp;{lastImportMeta.count.toLocaleString()} apps
          &nbsp;·&nbsp;{new Date(lastImportMeta.timestamp).toLocaleString()}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total Applications" value={n.toLocaleString()}                    accentColor="#8b5cf6" />
        <KpiCard label="SSO Coverage"       value={Math.round(ssoCount / n * 100)} unit="%" accentColor="#6366f1" />
        <KpiCard label="MFA Coverage"       value={Math.round(mfaCount / n * 100)} unit="%" accentColor="#06b6d4" />
        <KpiCard label="Total Orphan Accts" value={orphans.toLocaleString()}               accentColor="#ef4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="App Type Distribution" subtitle="By deployment model">
          <SolidPieChart data={appTypeData} />
        </ChartCard>
        <ChartCard title="Business Criticality" subtitle="Risk tier breakdown">
          <SolidPieChart data={criticalityData} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="IAM Control Coverage" subtitle="% of apps with each control enabled">
          <HorizontalBarChart data={controlCoverage} unit="%" colorByValue />
        </ChartCard>
        <ChartCard title="Onboarding Status" subtitle="Application onboarding progress">
          <VerticalBarChart
            data={onboardingData}
            xKey="label"
            series={[{ key: 'count', name: 'Apps', color: '#8b5cf6' }]}
            showLegend={false}
            height={260}
            colorByValue={false}
          />
        </ChartCard>
      </div>
    </div>
  )
}
