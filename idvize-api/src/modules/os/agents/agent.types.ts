/**
 * Agent Framework v1 — Types
 *
 * Defines the request/response shapes for the Agent invocation API.
 * Agents provide control-specific questions, guidance, and recommended actions
 * to help users remediate IAM control gaps.
 */

import type { IamPillar } from '../../control/control.catalog';

// ── Request ──────────────────────────────────────────────────────────────────

export interface AgentInvokeRequest {
  controlId: string;
  applicationId: string;
  // tenantId comes from JWT context — never from request body
}

// ── Response ─────────────────────────────────────────────────────────────────

export interface AgentQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'multiselect' | 'boolean';
  options?: string[];
  hint?: string;
  required: boolean;
}

export interface AgentGuidance {
  title: string;
  description: string;
  steps: string[];
  references?: string[];
}

export interface AgentRecommendedAction {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedEffort: string;
  platform?: string;
}

export interface AgentNotificationOption {
  notificationType: string;
  label: string;
  description: string;
}

export interface AgentInvokeResponse {
  agentId: string;
  agentName: string;
  controlId: string;
  controlName: string;
  applicationId: string;
  applicationName: string;
  tenantId: string;
  pillar: IamPillar;
  outcome: 'OK' | 'ATTN' | 'GAP';
  questions: AgentQuestion[];
  guidance: AgentGuidance;
  recommendedActions: AgentRecommendedAction[];
  availableNotifications: AgentNotificationOption[];
  generatedAt: string;
}

// ── Agent Definition ─────────────────────────────────────────────────────────

export interface AgentDefinition {
  agentId: string;
  name: string;
  controlId: string;
  description: string;
  generate: (ctx: AgentContext) => AgentOutput;
}

export interface AgentContext {
  controlId: string;
  controlName: string;
  applicationId: string;
  applicationName: string;
  tenantId: string;
  pillar: IamPillar;
  outcome: 'OK' | 'ATTN' | 'GAP';
  capabilities: string[];
  policyDrivers: string[];
  platformName: string;
  description: string;
}

export interface AgentOutput {
  questions: AgentQuestion[];
  guidance: AgentGuidance;
  recommendedActions: AgentRecommendedAction[];
  notificationOptions?: AgentNotificationOption[];
}
