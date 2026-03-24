import { useParams } from 'react-router-dom'
import { cmdbDetailService } from '../services/cmdbDetailService'
import AppDetailHeader from '../components/AppDetailHeader'
import AppKpiBar from '../components/AppKpiBar'
import PostureChartCard from '../components/PostureChartCard'
import ControlStatusList from '../components/ControlStatusList'
import RecommendationsCard from '../components/RecommendationsCard'
import AppMetadataCard from '../components/AppMetadataCard'
import FullControlsPanel from '../components/FullControlsPanel'
import { AlertTriangle } from 'lucide-react'

export default function AppDetailPage() {
  const { appId } = useParams<{ appId: string }>()
  const app = appId ? cmdbDetailService.getApp(appId) : undefined

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center">
        <AlertTriangle size={40} className="text-amber-400" />
        <div>
          <p className="text-lg font-semibold text-slate-200">
            Application Not Found
          </p>
          <p className="text-sm text-slate-500 mt-1">
            No detail record for <span className="font-mono text-slate-400">{appId}</span>.
            Detailed dashboards are available for apps APP-001 through APP-008.
          </p>
        </div>
        <a
          href="/cmdb"
          className="text-sm text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
        >
          ← Back to CMDB
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <AppDetailHeader
        appId={app.appId}
        name={app.name}
        tags={app.tags}
        criticality={app.criticality}
        risk={app.risk}
      />

      {/* ── KPI strip ── */}
      <AppKpiBar
        users={app.users}
        orphanAccounts={app.orphanAccounts}
        privilegedAccounts={app.privilegedAccounts}
        compliance={app.compliance}
      />

      {/* ── Main 3-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col — posture donut */}
        <div className="lg:col-span-1">
          <PostureChartCard
            ok={app.posture.ok}
            attention={app.posture.attention}
            gap={app.posture.gap}
          />
        </div>

        {/* Centre col — control status */}
        <div className="lg:col-span-1">
          <ControlStatusList controls={app.controls} />
        </div>

        {/* Right col — recommendations */}
        <div className="lg:col-span-1">
          <RecommendationsCard
            recommendations={app.recommendations}
            rawControls={app.rawControls}
          />
        </div>
      </div>

      {/* ── Metadata section ── */}
      <AppMetadataCard metadata={app.metadata} />

      {/* ── Full IAM Controls Assessment ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          IAM Controls Assessment
        </h2>
        <FullControlsPanel appId={app.appId} />
      </div>
    </div>
  )
}
