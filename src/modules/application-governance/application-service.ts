/**
 * IDVIZE Application Governance Service
 * Module 1: Application Governance Intelligence
 * Ingests CMDB data, normalizes, correlates with IAM platforms, detects gaps
 */

import type {
  ApplicationRecord,
  ApplicationGap,
  ApplicationSummaryStats,
  ApplicationMetadata,
  IAMControlPosture,
  IAMControlDetail,
  IAMPlatformCorrelation,
  ControlStatus,
  OnboardingStatus,
} from '../../types/application'
import { recordAudit } from '../../types/audit'

/** In-memory application store */
const applications: Map<string, ApplicationRecord> = new Map()
const gaps: Map<string, ApplicationGap> = new Map()

export class ApplicationGovernanceService {
  /** Ingest applications from CMDB data */
  ingestFromCmdb(cmdbRecords: Record<string, string>[]): ApplicationRecord[] {
    const ingested: ApplicationRecord[] = []

    for (const record of cmdbRecords) {
      const app = this.normalizeCmdbRecord(record)
      if (app) {
        applications.set(app.metadata.appId, app)
        ingested.push(app)
      }
    }

    recordAudit(
      'data_access',
      { type: 'system', id: 'app-governance', name: 'ApplicationGovernanceService' },
      'cmdb_ingested',
      'applications',
      'success',
      { count: ingested.length },
    )

    return ingested
  }

  /** Get all applications */
  getApplications(): ApplicationRecord[] {
    return Array.from(applications.values())
  }

  /** Get application by ID */
  getApplicationById(appId: string): ApplicationRecord | undefined {
    return applications.get(appId)
  }

  /** Search applications */
  searchApplications(query: string): ApplicationRecord[] {
    const lower = query.toLowerCase()
    return Array.from(applications.values()).filter(app =>
      app.metadata.name.toLowerCase().includes(lower) ||
      app.metadata.appId.toLowerCase().includes(lower) ||
      (app.metadata.vendor ?? '').toLowerCase().includes(lower) ||
      (app.metadata.department ?? '').toLowerCase().includes(lower)
    )
  }

  /** Detect gaps for all applications */
  detectGaps(): ApplicationGap[] {
    const allGaps: ApplicationGap[] = []

    for (const app of applications.values()) {
      const appGaps = this.analyzeControlGaps(app)
      for (const gap of appGaps) {
        gaps.set(gap.id, gap)
        allGaps.push(gap)
      }
    }

    recordAudit(
      'agent_decision',
      { type: 'system', id: 'app-governance', name: 'ApplicationGovernanceService' },
      'gaps_detected',
      'applications',
      'success',
      { totalGaps: allGaps.length },
    )

    return allGaps
  }

  /** Get all open gaps */
  getOpenGaps(): ApplicationGap[] {
    return Array.from(gaps.values()).filter(g => g.status === 'open' || g.status === 'in_progress')
  }

  /** Get gaps for a specific application */
  getGapsForApp(appId: string): ApplicationGap[] {
    return Array.from(gaps.values()).filter(g => g.appId === appId)
  }

  /** Update gap status */
  updateGapStatus(gapId: string, status: ApplicationGap['status'], assignedTo?: string): ApplicationGap | null {
    const gap = gaps.get(gapId)
    if (!gap) return null
    gap.status = status
    if (assignedTo) gap.assignedTo = assignedTo
    return gap
  }

  /** Get summary statistics */
  getSummaryStats(): ApplicationSummaryStats {
    const apps = Array.from(applications.values())
    const totalApplications = apps.length

    const criticalApps = apps.filter(a => a.metadata.criticality === 'critical').length
    const highRiskApps = apps.filter(a => a.metadata.riskLevel === 'critical' || a.metadata.riskLevel === 'high').length

    const mfaCoverage = this.calculateCoverage(apps, 'mfaEnabled')
    const ssoCoverage = this.calculateCoverage(apps, 'ssoIntegrated')
    const pamCoverage = this.calculateCoverage(apps, 'pamManaged')
    const automatedProvisioningCoverage = this.calculateCoverage(apps, 'provisioningAutomated')

    const orphanAccountTotal = apps.filter(a => a.controls.orphanAccountPosture === 'gap' || a.controls.orphanAccountPosture === 'attention').length
    const privilegedAccountTotal = apps.filter(a => a.controls.privilegedAccountPosture === 'gap' || a.controls.privilegedAccountPosture === 'attention').length

    const openGaps = Array.from(gaps.values()).filter(g => g.status === 'open').length

    return {
      totalApplications,
      criticalApps,
      highRiskApps,
      mfaCoverage,
      ssoCoverage,
      pamCoverage,
      automatedProvisioningCoverage,
      orphanAccountTotal,
      privilegedAccountTotal,
      openGaps,
    }
  }

  /** Correlate application with IAM platforms */
  correlateWithPlatforms(appId: string): IAMPlatformCorrelation | null {
    const app = applications.get(appId)
    if (!app) return null

    // Heuristic correlation based on control status
    const correlation: IAMPlatformCorrelation = {
      sailpointIiq: {
        onboarded: app.controls.provisioningAutomated === 'ok' || app.controls.accessReviewsCurrent === 'ok',
        notes: app.controls.provisioningAutomated === 'ok' ? 'Provisioning active' : 'Not onboarded',
      },
      microsoftEntra: {
        onboarded: app.controls.ssoIntegrated === 'ok' || app.controls.mfaEnabled === 'ok',
        notes: app.controls.ssoIntegrated === 'ok' ? 'SSO active' : 'Not integrated',
      },
      cyberarkPac: {
        onboarded: app.controls.pamManaged === 'ok',
        notes: app.controls.pamManaged === 'ok' ? 'PAM managed' : 'Not onboarded',
      },
      okta: {
        onboarded: app.controls.ssoIntegrated === 'ok',
        notes: 'Correlation based on SSO status',
      },
    }

    app.iamPlatformCorrelation = correlation
    return correlation
  }

  private normalizeCmdbRecord(record: Record<string, string>): ApplicationRecord | null {
    const appId = record['App ID'] || record['appId'] || record['Application ID']
    const name = record['Application Name'] || record['name'] || record['App Name']

    if (!appId || !name) return null

    const metadata: ApplicationMetadata = {
      appId,
      name,
      owner: record['Owner'] || record['App Owner'],
      businessOwner: record['Business Owner'],
      itOwner: record['IT Owner'],
      vendor: record['Vendor'],
      supportContact: record['Support Contact'],
      supportPage: record['Support Page'],
      supportNumber: record['Support Number'],
      criticality: this.parseCriticality(record['Criticality']),
      riskLevel: this.parseRisk(record['Risk Level'] || record['Risk']),
      dataClassification: 'internal',
      complianceTags: (record['Compliance Tags'] ?? '').split(',').filter(Boolean).map(t => t.trim()),
      authMethod: record['Auth Method'],
      hostingType: record['Hosting Type'] as ApplicationMetadata['hostingType'],
      userPopulation: parseInt(record['User Population'] || record['Users'] || '0', 10) || undefined,
      department: record['Department'] || record['Business Unit'],
      environment: record['Environment'],
      applicationType: record['Application Type'] || record['App Type'],
      soxApplicable: record['SOX Applicable'] === 'Yes' || record['SOX'] === 'Yes',
    }

    const controls = this.parseControls(record)
    const controlDetails = this.buildControlDetails(controls)

    const onboardingStatus: OnboardingStatus =
      controls.ssoIntegrated === 'ok' && controls.mfaEnabled === 'ok' ? 'onboarded'
      : controls.ssoIntegrated === 'attention' || controls.mfaEnabled === 'attention' ? 'in_progress'
      : 'not_started'

    return {
      metadata,
      controls,
      controlDetails,
      onboardingStatus,
      iamPlatformCorrelation: {},
      rawCmdbData: record,
      lastUpdatedAt: new Date().toISOString(),
      source: 'cmdb',
    }
  }

  private parseCriticality(value?: string): ApplicationMetadata['criticality'] {
    const v = (value ?? '').toLowerCase()
    if (v.includes('critical')) return 'critical'
    if (v.includes('high')) return 'high'
    if (v.includes('low')) return 'low'
    return 'medium'
  }

  private parseRisk(value?: string): ApplicationMetadata['riskLevel'] {
    const v = (value ?? '').toLowerCase()
    if (v.includes('critical')) return 'critical'
    if (v.includes('high')) return 'high'
    if (v.includes('low')) return 'low'
    return 'medium'
  }

  private parseControls(record: Record<string, string>): IAMControlPosture {
    return {
      ssoIntegrated: this.parseControlStatus(record['SSO Integrated'] || record['SSO']),
      mfaEnabled: this.parseControlStatus(record['MFA Enabled'] || record['MFA']),
      pamManaged: this.parseControlStatus(record['PAM Managed'] || record['PAM']),
      provisioningAutomated: this.parseControlStatus(record['Provisioning Automated'] || record['Provisioning']),
      accessReviewsCurrent: this.parseControlStatus(record['Access Reviews Current'] || record['Access Reviews']),
      orphanAccountPosture: this.parseControlStatus(record['Orphan Account Posture'] || record['Orphan Accounts']),
      privilegedAccountPosture: this.parseControlStatus(record['Privileged Account Posture'] || record['Privileged Accounts']),
    }
  }

  private parseControlStatus(value?: string): ControlStatus {
    const v = (value ?? '').toLowerCase()
    if (v === 'ok' || v === 'yes' || v === 'true' || v === 'enabled' || v === 'active') return 'ok'
    if (v === 'attention' || v === 'attn' || v === 'partial' || v === 'in_progress') return 'attention'
    if (v === 'gap' || v === 'no' || v === 'false' || v === 'disabled' || v === 'missing') return 'gap'
    return 'na'
  }

  private buildControlDetails(controls: IAMControlPosture): IAMControlDetail[] {
    return [
      { name: 'MFA Enabled', status: controls.mfaEnabled, detail: 'Multi-factor authentication status' },
      { name: 'SSO Integrated', status: controls.ssoIntegrated, detail: 'Single sign-on integration status' },
      { name: 'PAM Managed', status: controls.pamManaged, detail: 'Privileged access management status' },
      { name: 'Provisioning Automated', status: controls.provisioningAutomated, detail: 'Automated provisioning status' },
      { name: 'Access Reviews Current', status: controls.accessReviewsCurrent, detail: 'Access review campaign status' },
      { name: 'Orphan Account Posture', status: controls.orphanAccountPosture, detail: 'Orphan account remediation status' },
      { name: 'Privileged Account Posture', status: controls.privilegedAccountPosture, detail: 'Privileged account control status' },
    ]
  }

  private calculateCoverage(apps: ApplicationRecord[], control: keyof IAMControlPosture): number {
    if (apps.length === 0) return 0
    const covered = apps.filter(a => a.controls[control] === 'ok').length
    return Math.round((covered / apps.length) * 100)
  }

  private analyzeControlGaps(app: ApplicationRecord): ApplicationGap[] {
    const appGaps: ApplicationGap[] = []
    const now = new Date().toISOString()
    const severity = app.metadata.criticality === 'critical' ? 'critical' as const
      : app.metadata.criticality === 'high' ? 'high' as const
      : 'medium' as const

    const addGap = (gapType: ApplicationGap['gapType'], control: ControlStatus, description: string, recommendation: string) => {
      if (control === 'gap') {
        appGaps.push({
          id: `gap-${app.metadata.appId}-${gapType}`,
          appId: app.metadata.appId,
          appName: app.metadata.name,
          gapType,
          severity,
          description,
          recommendation,
          detectedAt: now,
          status: 'open',
        })
      }
    }

    addGap('missing_sso', app.controls.ssoIntegrated, `${app.metadata.name} missing SSO`, `Onboard to SSO`)
    addGap('missing_mfa', app.controls.mfaEnabled, `${app.metadata.name} missing MFA`, `Enable MFA`)
    addGap('missing_pam', app.controls.pamManaged, `${app.metadata.name} missing PAM`, `Onboard to PAM`)
    addGap('manual_provisioning', app.controls.provisioningAutomated, `${app.metadata.name} manual provisioning`, `Automate provisioning`)
    addGap('overdue_review', app.controls.accessReviewsCurrent, `${app.metadata.name} overdue review`, `Schedule access review`)
    addGap('orphan_accounts', app.controls.orphanAccountPosture, `${app.metadata.name} orphan accounts`, `Remediate orphan accounts`)
    addGap('excessive_privileged', app.controls.privilegedAccountPosture, `${app.metadata.name} excessive privileged`, `Review privileged accounts`)

    return appGaps
  }
}

/** Singleton application governance service */
export const applicationGovernanceService = new ApplicationGovernanceService()
