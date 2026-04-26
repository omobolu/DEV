/**
 * MaturityEvidenceCollectorService
 *
 * Gathers raw evidence from every available module/adapter.
 * Returns a flat list of MaturityEvidence records.
 * Unknown or unavailable sources produce 'missing' quality evidence
 * so the scoring engine can penalise confidence appropriately.
 */

import { v4 as uuidv4 } from 'uuid';
import { MaturityEvidence, EvidenceSource, EvidenceQuality } from '../maturity.types';
import { documentService } from '../../document/document.service';
import { auditService }    from '../../security/audit/audit.service';
import { approvalService } from '../../security/approval/approval.service';
import { scimService }     from '../../security/scim/scim.service';
import { applicationService } from '../../application/application.service';
import { entraAdapter }    from '../../integration/adapters/entra.adapter';
import { sailpointAdapter } from '../../integration/adapters/sailpoint.adapter';
import { cyberarkAdapter }  from '../../integration/adapters/cyberark.adapter';
import { oktaAdapter }      from '../../integration/adapters/okta.adapter';
import { costAggregationEngine } from '../../cost/engines/cost-aggregation.engine';
import { vendorImpactEngine }    from '../../cost/engines/vendor-impact.engine';
import { contractRepository }    from '../../cost/repositories/contract.repository';

function ev(
  indicatorId: string,
  domainId: string,
  source: EvidenceSource,
  quality: EvidenceQuality,
  rawValue: unknown,
  description: string,
  metadata?: Record<string, unknown>,
): MaturityEvidence {
  return {
    evidenceId:  uuidv4(),
    indicatorId,
    domainId,
    source,
    quality,
    collectedAt: new Date().toISOString(),
    rawValue,
    description,
    metadata,
  };
}

export class MaturityEvidenceCollectorService {

  async collect(tenantId: string): Promise<MaturityEvidence[]> {
    const evidence: MaturityEvidence[] = [];

    await Promise.all([
      this.collectDocumentEvidence(tenantId, evidence),
      this.collectAuditEvidence(tenantId, evidence),
      this.collectApprovalEvidence(tenantId, evidence),
      this.collectScimEvidence(tenantId, evidence),
      this.collectApplicationEvidence(tenantId, evidence),
      this.collectEntraEvidence(evidence),
      this.collectSailpointEvidence(evidence),
      this.collectCyberArkEvidence(evidence),
      this.collectOktaEvidence(evidence),
      this.collectCostEvidence(tenantId, evidence),
      this.collectIntegrationStatusEvidence(evidence),
    ]);

    return evidence;
  }

  // ── Document Module ─────────────────────────────────────────────────────────

  private async collectDocumentEvidence(tenantId: string, out: MaturityEvidence[]) {
    try {
      const stats = documentService.getStats(tenantId);

      // gov-policies: count of published policy documents
      const publishedPolicies = stats.byStatus.published ?? 0;
      out.push(ev('gov-policies', 'governance', 'document_module', 'live',
        { publishedPolicies, byCategory: stats.byCategory },
        `${publishedPolicies} published documents across ${Object.keys(stats.byCategory).length} categories`));

      // gov-charter: look for governance/policy category docs
      const govDocs = (stats.byCategory['policy'] ?? 0) + (stats.byCategory['standard'] ?? 0);
      out.push(ev('gov-charter', 'governance', 'document_module', 'live',
        { govDocs },
        `${govDocs} policy/standard documents found`));

      // gov-roles: look for procedure/guideline docs
      const procDocs = (stats.byCategory['procedure'] ?? 0) + (stats.byCategory['guideline'] ?? 0);
      out.push(ev('gov-roles', 'governance', 'document_module', 'live',
        { procDocs },
        `${procDocs} procedure/guideline documents found`));

      // doc-* indicators
      const inReview   = stats.byStatus.in_review   ?? 0;
      const draft      = stats.byStatus.draft        ?? 0;
      const archived   = stats.byStatus.archived     ?? 0;
      const runbooks   = stats.byCategory['runbook'] ?? 0;
      const arch       = stats.byCategory['architecture'] ?? 0;

      out.push(ev('doc-policies',  'documentation', 'document_module', 'live',
        { publishedPolicies, inReview },
        `${publishedPolicies} published, ${inReview} in review`));

      out.push(ev('doc-runbooks',  'documentation', 'document_module', 'live',
        { runbooks },
        `${runbooks} runbook documents found`));

      out.push(ev('doc-arch',      'documentation', 'document_module', 'live',
        { arch },
        `${arch} architecture documents found`));

      out.push(ev('doc-review',    'documentation', 'document_module', 'live',
        { inReview, draft, archived, total: stats.total },
        `${inReview} documents currently in review cycle out of ${stats.total} total`));

      // cmp-controls: policy + standard docs as proxy for control framework coverage
      out.push(ev('cmp-controls',  'compliance', 'document_module', 'live',
        { policyCount: govDocs },
        `${govDocs} policy/standard documents as control framework proxies`));

    } catch (e) {
      out.push(ev('doc-policies', 'documentation', 'document_module', 'missing',
        null, 'Document module unavailable', { error: String(e) }));
    }
  }

  // ── Audit Logs ──────────────────────────────────────────────────────────────

  private async collectAuditEvidence(tenantId: string, out: MaturityEvidence[]) {
    try {
      const totalEvents = auditService.count(tenantId);
      const allEvents   = auditService.query(tenantId, {});
      const authzDenies  = allEvents.filter(e => e.eventType === 'authz.deny').length;
      const authzAllows  = allEvents.filter(e => e.eventType === 'authz.allow').length;
      const authEvents   = allEvents.filter(e => e.eventType.startsWith('auth.')).length;
      const scimEvents   = allEvents.filter(e => e.eventType.startsWith('scim.')).length;
      const approvalEvents = allEvents.filter(e => e.eventType.startsWith('approval.')).length;

      out.push(ev('cmp-audit', 'compliance', 'audit_logs', 'live',
        { totalEvents, authzDenies, authzAllows, authEvents },
        `${totalEvents} total audit events captured`));

      out.push(ev('sec-authz', 'security_gov', 'audit_logs', 'live',
        { authzDenies, authzAllows, denyRate: authzAllows > 0 ? authzDenies / (authzAllows + authzDenies) : 0 },
        `${authzDenies} authz denials out of ${authzAllows + authzDenies} total authz events`));

      out.push(ev('sec-anomaly', 'security_gov', 'audit_logs', 'live',
        { totalEvents, authzDenies },
        `Audit trail with ${totalEvents} events available for anomaly review`));

      out.push(ev('sec-policies', 'security_gov', 'audit_logs', 'live',
        { authzAllows, authzDenies },
        `Policy enforcement: ${authzAllows} allowed, ${authzDenies} denied`));

      out.push(ev('lc-deprovision', 'lifecycle', 'audit_logs', 'live',
        { scimEvents },
        `${scimEvents} SCIM provisioning events in audit log`));

      out.push(ev('ai-automation', 'ai_automation', 'audit_logs', 'live',
        { totalEvents, scimEvents, approvalEvents },
        `${scimEvents + approvalEvents} automated events (SCIM + approvals) out of ${totalEvents} total`));

      out.push(ev('gov-metrics', 'governance', 'audit_logs', 'live',
        { totalEvents },
        `Audit log contains ${totalEvents} events — metrics tracking active`));

    } catch (e) {
      out.push(ev('cmp-audit', 'compliance', 'audit_logs', 'missing',
        null, 'Audit service unavailable', { error: String(e) }));
    }
  }

  // ── Approval Workflows ──────────────────────────────────────────────────────

  private async collectApprovalEvidence(tenantId: string, out: MaturityEvidence[]) {
    try {
      const all      = approvalService.listAll(tenantId);
      const pending  = approvalService.listPending(tenantId);
      const approved = all.filter(r => r.status === 'approved');
      const rejected = all.filter(r => r.status === 'rejected');
      const expired  = all.filter(r => r.status === 'expired');
      const total    = all.length;
      const completionRate = total > 0 ? (approved.length + rejected.length) / total : 0;
      const highRisk = all.filter(r => r.riskLevel === 'high_risk');

      out.push(ev('iga-cert', 'iga', 'approval_workflows', 'live',
        { total, approved: approved.length, rejected: rejected.length, pending: pending.length, completionRate },
        `${approved.length + rejected.length}/${total} access requests resolved (${Math.round(completionRate * 100)}%)`));

      out.push(ev('cmp-reviews', 'compliance', 'approval_workflows', 'live',
        { total, completionRate, expired: expired.length },
        `Access review completion: ${Math.round(completionRate * 100)}%, ${expired.length} expired`));

      out.push(ev('cmp-remediation', 'compliance', 'approval_workflows', 'live',
        { rejected: rejected.length, expired: expired.length },
        `${rejected.length} rejected (access removed), ${expired.length} expired without resolution`));

      out.push(ev('sec-sod', 'security_gov', 'approval_workflows', 'live',
        { highRisk: highRisk.length, total },
        `${highRisk.length} high-risk approval requests tracked`));

      out.push(ev('svc-selfservice', 'service_ops', 'approval_workflows', 'live',
        { total, pending: pending.length },
        `${total} access requests via self-service workflow`));

      out.push(ev('lc-workflow', 'lifecycle', 'audit_logs', 'live',
        { total, completionRate },
        `${total} lifecycle workflow requests, ${Math.round(completionRate * 100)}% resolved`));

    } catch (e) {
      out.push(ev('cmp-reviews', 'compliance', 'approval_workflows', 'missing',
        null, 'Approval service unavailable', { error: String(e) }));
    }
  }

  // ── SCIM Provisioning ───────────────────────────────────────────────────────

  private async collectScimEvidence(tenantId: string, out: MaturityEvidence[]) {
    try {
      const usersResp  = scimService.listUsers(tenantId) as Record<string, unknown>;
      const groupsResp = scimService.listGroups(tenantId) as Record<string, unknown>;
      const userCount  = (usersResp['totalResults'] as number) ?? 0;
      const groupCount = (groupsResp['totalResults'] as number) ?? 0;

      out.push(ev('iga-scim', 'iga', 'scim_provisioning', 'live',
        { userCount, groupCount },
        `${userCount} SCIM-managed users, ${groupCount} groups`));

      out.push(ev('iga-jml', 'iga', 'scim_provisioning', 'live',
        { userCount },
        `${userCount} identities managed via SCIM provisioning`));

      out.push(ev('lc-provision', 'lifecycle', 'scim_provisioning', 'live',
        { userCount, groupCount },
        `${userCount} users provisioned via SCIM`));

      out.push(ev('lc-events', 'lifecycle', 'scim_provisioning', 'live',
        { userCount },
        `SCIM endpoint active with ${userCount} managed identities`));

      out.push(ev('ai-automation', 'ai_automation', 'scim_provisioning', 'live',
        { scimManaged: userCount },
        `${userCount} identities auto-provisioned via SCIM (no manual tickets)`));

    } catch (e) {
      out.push(ev('iga-scim', 'iga', 'scim_provisioning', 'missing',
        null, 'SCIM service unavailable', { error: String(e) }));
    }
  }

  // ── Application CMDB ────────────────────────────────────────────────────────

  private async collectApplicationEvidence(tenantId: string, out: MaturityEvidence[]) {
    try {
      const { apps, total } = applicationService.listApplications(tenantId);
      const ssoEnabled  = apps.filter(a => (a as unknown as Record<string,unknown>).ssoEnabled  === true).length;
      const mfaRequired = apps.filter(a => (a as unknown as Record<string,unknown>).mfaRequired === true).length;
      const pamVaulted  = apps.filter(a => (a as unknown as Record<string,unknown>).pamVaulted  === true).length;
      const scimEnabled = apps.filter(a => (a as unknown as Record<string,unknown>).scimEnabled === true).length;
      const orphanCount = apps.reduce((n, a) => n + (((a as unknown as Record<string,unknown>).orphanAccounts as number) ?? 0), 0);
      const totalUsers  = apps.reduce((n, a) => n + ((a.userPopulation) ?? 0), 0);

      out.push(ev('am-sso', 'am', 'application_cmdb', 'live',
        { ssoEnabled, total, rate: total > 0 ? ssoEnabled / total : 0 },
        `${ssoEnabled}/${total} apps have SSO enabled`));

      out.push(ev('am-mfa', 'am', 'application_cmdb', 'live',
        { mfaRequired, total, rate: total > 0 ? mfaRequired / total : 0 },
        `${mfaRequired}/${total} apps require MFA`));

      out.push(ev('am-fed', 'am', 'application_cmdb', 'live',
        { ssoEnabled, scimEnabled, total },
        `${ssoEnabled} apps federated via SSO`));

      out.push(ev('pam-vault', 'pam', 'application_cmdb', 'live',
        { pamVaulted, total, rate: total > 0 ? pamVaulted / total : 0 },
        `${pamVaulted}/${total} apps have PAM vaulting`));

      out.push(ev('iga-scim', 'iga', 'application_cmdb', 'live',
        { scimEnabled, total, rate: total > 0 ? scimEnabled / total : 0 },
        `${scimEnabled}/${total} apps use SCIM provisioning`));

      out.push(ev('iga-orphan', 'iga', 'application_cmdb', 'live',
        { orphanCount, total, totalUsers },
        `${orphanCount} orphan accounts found across ${total} apps`));

      out.push(ev('pam-discovery', 'pam', 'application_cmdb', 'live',
        { pamVaulted, total },
        `${pamVaulted}/${total} apps with known privileged accounts managed`));

    } catch (e) {
      out.push(ev('am-sso', 'am', 'application_cmdb', 'missing',
        null, 'Application CMDB unavailable', { error: String(e) }));
    }
  }

  // ── Entra ID Adapter ────────────────────────────────────────────────────────

  private async collectEntraEvidence(out: MaturityEvidence[]) {
    try {
      const status = entraAdapter.getIntegrationStatus();
      const apps   = await entraAdapter.listEnterpriseApps();
      const isLive = status.status === 'connected';
      const quality: EvidenceQuality = isLive ? 'live' : 'mock';

      const ssoApps  = apps.filter(a => a.ssoEnabled).length;
      const mfaApps  = apps.filter(a => a.mfaEnabled).length;
      const scimApps = apps.filter(a => a.scimEnabled).length;
      const total    = apps.length;

      out.push(ev('am-sso', 'am', 'entra_adapter', quality,
        { ssoApps, total, isLive },
        `Entra ID: ${ssoApps}/${total} enterprise apps with SSO ${isLive ? '(live)' : '(mock)'}`));

      out.push(ev('am-mfa', 'am', 'entra_adapter', quality,
        { mfaApps, total, isLive },
        `Entra ID: ${mfaApps}/${total} apps with MFA enabled`));

      out.push(ev('am-ca', 'am', 'entra_adapter', quality,
        { configured: isLive, status: status.status },
        `Entra Conditional Access: ${isLive ? 'live connected' : 'not live-connected'}`));

      out.push(ev('iga-scim', 'iga', 'entra_adapter', quality,
        { scimApps, total },
        `Entra: ${scimApps}/${total} apps with SCIM provisioning`));

    } catch (e) {
      out.push(ev('am-sso', 'am', 'entra_adapter', 'missing',
        null, 'Entra adapter unavailable', { error: String(e) }));
    }
  }

  // ── SailPoint Adapter ───────────────────────────────────────────────────────

  private async collectSailpointEvidence(out: MaturityEvidence[]) {
    try {
      const status  = sailpointAdapter.getIntegrationStatus();
      const sources = await sailpointAdapter.listSources();
      const isLive  = status.status === 'connected';
      const quality: EvidenceQuality = isLive ? 'live' : 'mock';

      out.push(ev('iga-jml', 'iga', 'sailpoint_adapter', quality,
        { sources: sources.length, isLive },
        `SailPoint: ${sources.length} identity sources configured ${isLive ? '(live)' : '(mock)'}`));

      out.push(ev('lc-provision', 'lifecycle', 'sailpoint_adapter', quality,
        { sources: sources.length, isLive },
        `SailPoint provisioning: ${sources.length} sources`));

      out.push(ev('iga-roles', 'iga', 'sailpoint_adapter', quality,
        { isLive },
        `SailPoint role management: ${isLive ? 'live' : 'mock data'}`));

      out.push(ev('lc-workflow', 'lifecycle', 'sailpoint_adapter', quality,
        { isLive },
        `SailPoint workflow engine: ${isLive ? 'connected' : 'not live-connected'}`));

    } catch (e) {
      out.push(ev('iga-jml', 'iga', 'sailpoint_adapter', 'missing',
        null, 'SailPoint adapter unavailable', { error: String(e) }));
    }
  }

  // ── CyberArk Adapter ────────────────────────────────────────────────────────

  private async collectCyberArkEvidence(out: MaturityEvidence[]) {
    try {
      const status = cyberarkAdapter.getIntegrationStatus();
      const safes  = await cyberarkAdapter.listSafes();
      const isLive = status.status === 'connected';
      const quality: EvidenceQuality = isLive ? 'live' : 'mock';

      out.push(ev('pam-vault', 'pam', 'cyberark_adapter', quality,
        { safeCount: safes.length, isLive },
        `CyberArk: ${safes.length} PAM safes configured ${isLive ? '(live)' : '(mock)'}`));

      out.push(ev('pam-rotation', 'pam', 'cyberark_adapter', quality,
        { isLive },
        `CyberArk credential rotation: ${isLive ? 'live-connected' : 'not live-connected'}`));

      out.push(ev('pam-session', 'pam', 'cyberark_adapter', quality,
        { isLive },
        `CyberArk session recording: ${isLive ? 'live-connected' : 'not live-connected'}`));

      out.push(ev('pam-discovery', 'pam', 'cyberark_adapter', quality,
        { safeCount: safes.length },
        `${safes.length} CyberArk safes as privileged account inventory`));

    } catch (e) {
      out.push(ev('pam-vault', 'pam', 'cyberark_adapter', 'missing',
        null, 'CyberArk adapter unavailable', { error: String(e) }));
    }
  }

  // ── Okta Adapter ────────────────────────────────────────────────────────────

  private async collectOktaEvidence(out: MaturityEvidence[]) {
    try {
      const status = oktaAdapter.getIntegrationStatus();
      const apps   = await oktaAdapter.listApps();
      const isLive = status.status === 'connected';
      const quality: EvidenceQuality = isLive ? 'live' : 'mock';

      out.push(ev('ciam-platform', 'ciam', 'okta_adapter', quality,
        { appCount: apps.length, isLive },
        `Okta CIAM: ${apps.length} apps configured ${isLive ? '(live)' : '(mock)'}`));

      out.push(ev('ciam-mfa', 'ciam', 'okta_adapter', quality,
        { isLive },
        `Okta MFA policies: ${isLive ? 'live' : 'not live-connected'}`));

      out.push(ev('ciam-pwdless', 'ciam', 'mock_placeholder', 'mock',
        { configured: false },
        'Passwordless CIAM capabilities not yet assessed'));

      out.push(ev('ciam-consent', 'ciam', 'mock_placeholder', 'missing',
        null,
        'Consent management not yet integrated'));

    } catch (e) {
      out.push(ev('ciam-platform', 'ciam', 'okta_adapter', 'missing',
        null, 'Okta adapter unavailable', { error: String(e) }));
    }
  }

  // ── Cost Module ─────────────────────────────────────────────────────────────

  private async collectCostEvidence(tenantId: string, out: MaturityEvidence[]) {
    try {
      const summary  = costAggregationEngine.compute(tenantId);
      const impacts  = vendorImpactEngine.analyzeAll(tenantId);
      const contracts = contractRepository.findAll(tenantId);
      const activeContracts  = contracts.filter(c => c.status === 'active').length;
      const expiringContracts = contracts.filter(c => {
        if (c.status !== 'active') return false;
        const expiry = new Date(c.endDate);
        const now    = new Date();
        const daysLeft = (expiry.getTime() - now.getTime()) / 86400000;
        return daysLeft < 90;
      }).length;

      out.push(ev('cst-visibility', 'cost', 'cost_module', 'live',
        { totalCost: summary.totalAnnualCost, breakdown: summary.breakdown },
        `Total IAM cost: $${summary.totalAnnualCost.toLocaleString()}/yr with full breakdown`));

      out.push(ev('cst-vendors', 'cost', 'cost_module', 'live',
        { vendorCount: impacts.length, lowEfficiency: impacts.filter(i => i.efficiencyScore < 50).length },
        `${impacts.length} vendors assessed, ${impacts.filter(i => i.efficiencyScore < 50).length} with low efficiency`));

      out.push(ev('cst-contracts', 'cost', 'cost_module', 'live',
        { active: activeContracts, expiring: expiringContracts, total: contracts.length },
        `${activeContracts} active contracts, ${expiringContracts} expiring within 90 days`));

      out.push(ev('cst-roi', 'cost', 'mock_placeholder', 'mock',
        { totalCost: summary.totalAnnualCost },
        'ROI measurement not yet implemented — cost visibility confirmed'));

      out.push(ev('gov-budget', 'governance', 'cost_module', 'live',
        { totalCost: summary.totalAnnualCost, breakdownCategories: Object.keys(summary.breakdown ?? {}).length },
        `IAM budget tracked: $${summary.totalAnnualCost.toLocaleString()}/yr`));

      out.push(ev('gov-metrics', 'governance', 'cost_module', 'live',
        { totalCost: summary.totalAnnualCost },
        'Cost metrics available for KPI reporting'));

    } catch (e) {
      out.push(ev('cst-visibility', 'cost', 'cost_module', 'missing',
        null, 'Cost module unavailable', { error: String(e) }));
    }
  }

  // ── Integration Status ──────────────────────────────────────────────────────

  private async collectIntegrationStatusEvidence(out: MaturityEvidence[]) {
    const statuses = [
      entraAdapter.getIntegrationStatus(),
      sailpointAdapter.getIntegrationStatus(),
      cyberarkAdapter.getIntegrationStatus(),
      oktaAdapter.getIntegrationStatus(),
    ];
    const connectedCount = statuses.filter(s => s.status === 'connected').length;
    const totalPlatforms = statuses.length;

    out.push(ev('ai-tools', 'ai_automation', 'integration_status', 'live',
      { connected: connectedCount, total: totalPlatforms, platforms: statuses.map(s => s.platform) },
      `${connectedCount}/${totalPlatforms} IAM platforms live-connected`));

    out.push(ev('ciam-platform', 'ciam', 'integration_status', 'live',
      { oktaStatus: statuses.find(s => s.platform === 'Okta')?.status },
      `Okta integration status: ${statuses.find(s => s.platform === 'Okta')?.status}`));

    // Placeholder evidence for indicators with no live source yet
    const placeholders: [string, string][] = [
      ['svc-sla',        'service_ops'],
      ['svc-automation', 'service_ops'],
      ['svc-escalation', 'service_ops'],
      ['bld-velocity',   'build'],
      ['bld-quality',    'build'],
      ['bld-pipeline',   'build'],
      ['bld-coverage',   'build'],
      ['ai-predict',     'ai_automation'],
      ['ai-anomaly',     'ai_automation'],
    ];
    placeholders.forEach(([indicatorId, domainId]) => {
      out.push(ev(indicatorId, domainId, 'mock_placeholder', 'mock',
        { assessed: false },
        'No live evidence source — placeholder mock data'));
    });
  }
}

export const maturityEvidenceCollector = new MaturityEvidenceCollectorService();
