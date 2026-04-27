/**
 * Security Governance Agent
 *
 * Sits above the security module and produces governance health reports.
 * Answers: "What is the current security posture of the IDVIZE platform?"
 */

import { authRepository } from '../modules/security/auth/auth.repository';
import { auditService } from '../modules/security/audit/audit.service';
import { approvalService } from '../modules/security/approval/approval.service';
import { authzService } from '../modules/security/authz/authz.service';
import { runClaudeAnalysis, type ClaudeAnalysisResult } from '../services/claude.service';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';

export interface SecurityPostureReport {
  reportId: string;
  generatedAt: string;
  generatedBy: string;
  userSummary: {
    total: number;
    active: number;
    suspended: number;
    deprovisioned: number;
    mfaEnrolled: number;
    mfaNotEnrolled: number;
    byRole: Record<string, number>;
  };
  auditSummary: {
    totalEvents: number;
    authFailures: number;
    authzDenials: number;
    fieldMaskingEvents: number;
    scimOperations: number;
    approvalEvents: number;
  };
  approvalSummary: {
    pending: number;
    resolved: number;
    highRiskPending: number;
  };
  policyHealth: {
    totalPolicies: number;
    activePolicies: number;
    denyPolicies: number;
    allowPolicies: number;
  };
  riskFlags: string[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
}

class SecurityGovernanceAgent {
  private lastReport: SecurityPostureReport | null = null;

  async run(tenantId: string): Promise<SecurityPostureReport> {
    console.log('[SecurityGovernanceAgent] Starting security posture analysis...');

    const allUsers = authRepository.findAll(tenantId);
    const auditEvents = auditService.query(tenantId, { limit: 10000 });

    // ── User Summary ─────────────────────────────────────────────────────────
    const userSummary = {
      total: allUsers.length,
      active: allUsers.filter(u => u.status === 'active').length,
      suspended: allUsers.filter(u => u.status === 'suspended').length,
      deprovisioned: allUsers.filter(u => u.status === 'deprovisioned').length,
      mfaEnrolled: allUsers.filter(u => u.mfaEnrolled).length,
      mfaNotEnrolled: allUsers.filter(u => !u.mfaEnrolled).length,
      byRole: allUsers.reduce<Record<string, number>>((acc, u) => {
        for (const role of u.roles) {
          acc[role] = (acc[role] ?? 0) + 1;
        }
        return acc;
      }, {}),
    };

    // ── Audit Summary ────────────────────────────────────────────────────────
    const auditSummary = {
      totalEvents: auditEvents.length,
      authFailures: auditEvents.filter(e => e.eventType === 'auth.login.failure').length,
      authzDenials: auditEvents.filter(e => e.eventType === 'authz.deny').length,
      fieldMaskingEvents: auditEvents.filter(e => e.eventType === 'authz.field_masked').length,
      scimOperations: auditEvents.filter(e => e.eventType.startsWith('scim.')).length,
      approvalEvents: auditEvents.filter(e => e.eventType.startsWith('approval.')).length,
    };

    // ── Approval Summary ─────────────────────────────────────────────────────
    approvalService.expireStale(tenantId);
    const pending = approvalService.listPending(tenantId);
    const all = approvalService.listAll(tenantId);
    const approvalSummary = {
      pending: pending.length,
      resolved: all.filter(r => r.status === 'approved' || r.status === 'rejected').length,
      highRiskPending: pending.filter(r => r.riskLevel === 'high_risk').length,
    };

    // ── Policy Health ─────────────────────────────────────────────────────────
    const policies = authzService.listPolicies();
    const policyHealth = {
      totalPolicies: policies.length,
      activePolicies: policies.filter(p => p.enabled).length,
      denyPolicies: policies.filter(p => p.effect === 'deny').length,
      allowPolicies: policies.filter(p => p.effect === 'allow').length,
    };

    // ── Risk Flags ────────────────────────────────────────────────────────────
    const riskFlags: string[] = [];

    if (userSummary.mfaNotEnrolled > 0) {
      riskFlags.push(`${userSummary.mfaNotEnrolled} active user(s) without MFA enrolled`);
    }

    const managerCount = userSummary.byRole['Manager'] ?? 0;
    if (managerCount === 0) riskFlags.push('No Manager role assigned — no one can approve high-risk actions');
    if (managerCount > 3) riskFlags.push(`${managerCount} Manager accounts — review principle of least privilege`);

    if (auditSummary.authFailures > 10) {
      riskFlags.push(`${auditSummary.authFailures} authentication failures in audit log — investigate brute-force risk`);
    }

    if (approvalSummary.highRiskPending > 0) {
      riskFlags.push(`${approvalSummary.highRiskPending} high-risk approval(s) pending — action required`);
    }

    if (userSummary.deprovisioned > 0) {
      riskFlags.push(`${userSummary.deprovisioned} deprovisioned user(s) — confirm access revocation is complete`);
    }

    const overallRisk: SecurityPostureReport['overallRisk'] =
      riskFlags.length === 0 ? 'low' :
      riskFlags.length <= 2 ? 'medium' :
      riskFlags.length <= 4 ? 'high' : 'critical';

    const report: SecurityPostureReport = {
      reportId: `sec-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      generatedBy: 'security-governance-agent',
      userSummary,
      auditSummary,
      approvalSummary,
      policyHealth,
      riskFlags,
      overallRisk,
    };

    this.lastReport = report;
    console.log(`[SecurityGovernanceAgent] Report complete. Risk: ${overallRisk}. Flags: ${riskFlags.length}`);
    return report;
  }

  getLastReport(): SecurityPostureReport | null {
    return this.lastReport;
  }

  getStatus() {
    return {
      agent: 'SecurityGovernanceAgent',
      hasReport: this.lastReport !== null,
      reportId: this.lastReport?.reportId ?? null,
      lastRunAt: this.lastReport?.generatedAt ?? null,
    };
  }

  /**
   * AI-enhanced posture analysis.
   * Runs the deterministic report, then asks Claude to reason over it
   * and generate a natural-language risk narrative.
   */
  async runWithAI(tenantId: string): Promise<SecurityAiAnalysis> {
    console.log('[SecurityGovernanceAgent] Starting AI-enhanced security analysis...');

    const baseReport = await this.run(tenantId);

    const tools: Tool[] = [
      {
        name: 'get_user_summary',
        description: 'Get user population statistics including MFA enrolment, roles, and status breakdown.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      {
        name: 'get_audit_summary',
        description: 'Get audit event statistics including auth failures, authz denials, and SCIM operations.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      {
        name: 'get_approval_summary',
        description: 'Get pending and resolved approval request statistics including high-risk items.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      {
        name: 'get_policy_health',
        description: 'Get authorization policy statistics including active policies and deny rules.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      {
        name: 'get_risk_flags',
        description: 'Get all current risk flags and the overall risk level.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      {
        name: 'get_recent_audit_events',
        description: 'Get detailed recent audit events for deeper pattern analysis.',
        input_schema: {
          type: 'object' as const,
          properties: {
            limit: { type: 'number', description: 'Number of events to return (default 50)' },
            eventType: { type: 'string', description: 'Optional filter by event type prefix' },
          },
          required: [],
        },
      },
    ];

    const toolHandlers: Record<string, (input: Record<string, unknown>) => unknown> = {
      get_user_summary: () => baseReport.userSummary,
      get_audit_summary: () => baseReport.auditSummary,
      get_approval_summary: () => baseReport.approvalSummary,
      get_policy_health: () => baseReport.policyHealth,
      get_risk_flags: () => ({ flags: baseReport.riskFlags, overallRisk: baseReport.overallRisk }),
      get_recent_audit_events: (input) => {
        const limit = typeof input.limit === 'number' ? input.limit : 50;
        const events = auditService.query(tenantId, { limit });
        const typeFilter = typeof input.eventType === 'string' ? input.eventType : undefined;
        const filtered = typeFilter ? events.filter(e => e.eventType.startsWith(typeFilter)) : events;
        return filtered.map(e => ({
          eventType: e.eventType,
          actor: e.actorName,
          resource: e.resource,
          outcome: e.outcome,
          timestamp: e.timestamp,
          reason: e.reason,
        }));
      },
    };

    const systemPrompt = `You are an expert IAM security analyst and governance advisor.
You have access to live IAM platform security telemetry through tool calls. Your job is to produce a concise,
risk-focused executive narrative that identifies threat patterns, access anomalies, and governance gaps that a
deterministic system would miss. Focus on: identity threat indicators, privilege abuse patterns, access hygiene,
approval workflow health, and policy coverage gaps. Be specific about counts, users, and event patterns.`;

    const userPrompt = `Analyse the current security posture of our IAM platform.
Use the available tools to inspect user statistics, audit events, approval workflows, authorization policies,
and risk flags. Then produce a structured executive security brief covering:

1. **Identity Threat Assessment** — authentication failure patterns, suspicious access indicators, MFA gaps
2. **Privilege & Access Analysis** — role distribution, over-privileged accounts, least-privilege violations
3. **Approval Workflow Health** — pending high-risk approvals, workflow bottlenecks, stale requests
4. **Policy Coverage Gaps** — authorization policy completeness, deny rule effectiveness, shadow access risks
5. **Top 5 Remediation Actions** — specific, prioritised steps to reduce risk today
6. **Governance Score** — overall IAM governance maturity assessment (0–100) with justification

Reference specific event types, counts, and user details where available from the data.`;

    let aiResult: ClaudeAnalysisResult;
    try {
      aiResult = await runClaudeAnalysis(
        systemPrompt,
        userPrompt,
        tools,
        toolHandlers,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      aiResult = {
        narrative: `AI analysis unavailable: ${msg}\n\nDeterministic report: risk level ${baseReport.overallRisk}, ${baseReport.riskFlags.length} flag(s) identified.`,
        inputTokens: 0,
        outputTokens: 0,
        modelUsed: 'none',
      };
    }

    return {
      reportId: `sec-ai-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      baseReport,
      narrative: aiResult.narrative,
      thinking: aiResult.thinking,
      usage: {
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        model: aiResult.modelUsed,
      },
    };
  }
}

export interface SecurityAiAnalysis {
  reportId: string;
  generatedAt: string;
  baseReport: SecurityPostureReport;
  narrative: string;
  thinking?: string;
  usage: { inputTokens: number; outputTokens: number; model: string };
}

export const securityGovernanceAgent = new SecurityGovernanceAgent();
