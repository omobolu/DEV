/**
 * Agent Service — Dispatcher for IAM Control Agents
 *
 * Resolves the appropriate agent for a given controlId, fetches tenant-scoped
 * control context from PostgreSQL, and returns the agent's output.
 *
 * Security:
 *   - tenantId MUST come from authenticated JWT context
 *   - Application ownership verified via PG query (tenant_id + app_id)
 *   - No cross-tenant access: unknown app → undefined (controller returns 404)
 *   - No in-memory fallback: PG unavailable → throws (controller returns 503)
 */

import { riskRepository } from '../risk.repository';
import { CONTROLS_CATALOG } from '../../control/control.catalog';
import type { AgentDefinition, AgentContext, AgentInvokeResponse } from './agent.types';
import { ssoAgent } from './sso.agent';
import { mfaAgent } from './mfa.agent';

// ── Agent Registry ───────────────────────────────────────────────────────────

const AGENT_REGISTRY = new Map<string, AgentDefinition>();

function registerAgent(agent: AgentDefinition): void {
  AGENT_REGISTRY.set(agent.controlId, agent);
}

registerAgent(ssoAgent);
registerAgent(mfaAgent);

// ── Service ──────────────────────────────────────────────────────────────────

class AgentService {
  /**
   * List all registered agents (no tenant-scoping needed — agents are global).
   */
  listAgents(): { agentId: string; name: string; controlId: string; description: string }[] {
    return Array.from(AGENT_REGISTRY.values()).map(a => ({
      agentId: a.agentId,
      name: a.name,
      controlId: a.controlId,
      description: a.description,
    }));
  }

  /**
   * Invoke an agent for a specific control + application + tenant.
   *
   * Returns undefined if:
   *   - The application doesn't belong to the tenant (cross-tenant → 404)
   *   - The controlId has no registered agent (→ 404)
   *   - The control assessment doesn't exist for this app (→ 404)
   *
   * Throws on PG errors (controller returns 503).
   */
  async invoke(
    tenantId: string,
    applicationId: string,
    controlId: string,
  ): Promise<AgentInvokeResponse | undefined> {
    // 1. Look up the agent for this controlId
    const agent = AGENT_REGISTRY.get(controlId);
    if (!agent) return undefined;

    // 2. Verify app belongs to tenant + fetch control data (PG-backed)
    const controls = await riskRepository.getApplicationControls(tenantId, applicationId);
    if (controls.length === 0) {
      // Either app doesn't exist in tenant or has no assessments — verify ownership
      const appRisk = await riskRepository.getApplicationRisk(tenantId, applicationId);
      if (!appRisk) return undefined;
    }

    // 3. Find the specific control assessment for this app
    const assessment = controls.find(c => c.controlId === controlId);
    if (!assessment) return undefined;

    // 4. Enrich with catalog metadata
    const catalog = CONTROLS_CATALOG.find(c => c.controlId === controlId);

    // 5. Build the agent context
    const ctx: AgentContext = {
      controlId: assessment.controlId,
      controlName: assessment.controlName,
      applicationId: assessment.appId,
      applicationName: assessment.applicationName,
      tenantId: assessment.tenantId,
      pillar: assessment.pillar,
      outcome: assessment.outcome,
      capabilities: catalog?.capabilities ?? [],
      policyDrivers: catalog?.policyDrivers ?? [],
      platformName: catalog?.platform.platformName ?? '',
      description: catalog?.description ?? '',
    };

    // 6. Generate agent output
    const output = agent.generate(ctx);

    return {
      agentId: agent.agentId,
      agentName: agent.name,
      controlId: ctx.controlId,
      controlName: ctx.controlName,
      applicationId: ctx.applicationId,
      applicationName: ctx.applicationName,
      tenantId: ctx.tenantId,
      pillar: ctx.pillar,
      outcome: ctx.outcome,
      questions: output.questions,
      guidance: output.guidance,
      recommendedActions: output.recommendedActions,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const agentService = new AgentService();
