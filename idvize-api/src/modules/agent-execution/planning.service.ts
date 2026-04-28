/**
 * Planning Service — Generates structured execution plans from agent intent.
 *
 * The LLM produces structured intent (which systems, which actions, which inputs).
 * This service converts that intent into a deterministic, auditable ExecutionPlan
 * with ordered steps, blast radius estimation, prerequisites, and rollback steps.
 *
 * The agent NEVER executes directly — it only plans.
 */

import { v4 as uuidv4 } from 'uuid';
import { CONTROLS_CATALOG } from '../control/control.catalog';
import * as execRepo from './agent-execution.repository';
import type {
  AgentType,
  ExecutionPlan,
  ExecutionStep,
  BlastRadius,
  BlastRadiusLevel,
  SystemTarget,
  PlanPrerequisite,
  ActionType,
  ToolAction,
  SystemType,
} from './agent-execution.types';

// ── SSO Plan Templates ───────────────────────────────────────────────────────

interface PlanContext {
  tenantId: string;
  applicationId: string;
  applicationName: string;
  controlId: string;
  controlName: string;
  additionalContext?: Record<string, unknown>;
}

class PlanningService {

  async generatePlan(
    tenantId: string,
    agentType: AgentType,
    applicationId: string,
    controlId: string,
    context?: Record<string, unknown>,
  ): Promise<ExecutionPlan> {
    const application = await execRepo.getApplication(tenantId, applicationId);
    if (!application) {
      throw new Error(`Application ${applicationId} not found in tenant ${tenantId}`);
    }

    const catalogEntry = CONTROLS_CATALOG.find(c => c.controlId === controlId);
    const controlName = catalogEntry?.name ?? controlId;

    const planContext: PlanContext = {
      tenantId,
      applicationId,
      applicationName: application.name,
      controlId,
      controlName,
      additionalContext: context,
    };

    switch (agentType) {
      case 'sso':
        return this.generateSsoPlan(planContext);
      case 'mfa':
        return this.generateMfaPlan(planContext);
      default:
        throw new Error(`Agent type "${agentType}" does not have a plan template yet`);
    }
  }

  // ── SSO Plan ─────────────────────────────────────────────────────────────

  private generateSsoPlan(ctx: PlanContext): ExecutionPlan {
    const planId = `plan-${uuidv4()}`;
    const sessionId = ctx.additionalContext?.sessionId as string ?? '';

    const steps: ExecutionStep[] = [
      this.createStep(1, 'entra.create_enterprise_app', 'entra', 'Microsoft Entra ID',
        `Create enterprise application registration for ${ctx.applicationName}`,
        {
          actionType: 'entra.create_enterprise_app',
          target: { systemType: 'entra', applicationId: ctx.applicationId },
          inputs: { displayName: ctx.applicationName, signOnType: 'saml' },
          validationRules: [
            { field: 'displayName', rule: 'required', message: 'Application display name is required' },
            { field: 'signOnType', rule: 'enum', value: ['saml', 'oidc'], message: 'Sign-on type must be saml or oidc' },
          ],
        },
        false,
      ),
      this.createStep(2, 'entra.configure_saml_sso', 'entra', 'Microsoft Entra ID',
        `Configure SAML SSO for ${ctx.applicationName} (entity ID, ACS URL, attribute mapping)`,
        {
          actionType: 'entra.configure_saml_sso',
          target: { systemType: 'entra', applicationId: ctx.applicationId },
          inputs: {
            servicePrincipalId: '{{step:1:servicePrincipalId}}',
            entityId: `{{entityId}}`,
            acsUrl: `{{acsUrl}}`,
            nameIdFormat: 'emailAddress',
            attributeMappings: [
              { claim: 'emailaddress', source: 'user.mail' },
              { claim: 'displayname', source: 'user.displayname' },
              { claim: 'givenname', source: 'user.givenname' },
            ],
          },
          validationRules: [
            { field: 'entityId', rule: 'required', message: 'SAML Entity ID is required' },
            { field: 'acsUrl', rule: 'required', message: 'ACS URL is required' },
            { field: 'acsUrl', rule: 'format', value: '^https://', message: 'ACS URL must use HTTPS' },
          ],
        },
        false,
      ),
      this.createStep(3, 'entra.create_group', 'entra', 'Microsoft Entra ID',
        `Create security group for ${ctx.applicationName} SSO access`,
        {
          actionType: 'entra.create_group',
          target: { systemType: 'entra' },
          inputs: {
            displayName: `SG-SSO-${ctx.applicationName.replace(/\s+/g, '-')}`,
            description: `SSO access group for ${ctx.applicationName}`,
            membershipType: 'assigned',
          },
          validationRules: [
            { field: 'displayName', rule: 'required', message: 'Group display name is required' },
          ],
        },
        false,
      ),
      this.createStep(4, 'entra.assign_group_to_app', 'entra', 'Microsoft Entra ID',
        `Assign security group to ${ctx.applicationName} enterprise application`,
        {
          actionType: 'entra.assign_group_to_app',
          target: { systemType: 'entra', applicationId: ctx.applicationId },
          inputs: {
            servicePrincipalId: '{{step:1:servicePrincipalId}}',
            groupId: '{{step:3:groupId}}',
            groupName: `SG-SSO-${ctx.applicationName.replace(/\s+/g, '-')}`,
          },
          validationRules: [],
        },
        false,
      ),
      this.createStep(5, 'sailpoint.create_access_profile', 'sailpoint', 'SailPoint IdentityNow',
        `Create SailPoint access profile mapped to ${ctx.applicationName} SSO group`,
        {
          actionType: 'sailpoint.create_access_profile',
          target: { systemType: 'sailpoint', applicationId: ctx.applicationId },
          inputs: {
            name: `AP-SSO-${ctx.applicationName.replace(/\s+/g, '-')}`,
            description: `Access profile for ${ctx.applicationName} SSO`,
            sourceId: '{{sourceId}}',
            sourceGroup: `SG-SSO-${ctx.applicationName.replace(/\s+/g, '-')}`,
          },
          validationRules: [
            { field: 'name', rule: 'required', message: 'Access profile name is required' },
          ],
        },
        false,
      ),
      this.createStep(6, 'servicenow.create_catalog_item', 'servicenow', 'ServiceNow',
        `Create ServiceNow catalog item for ${ctx.applicationName} access request`,
        {
          actionType: 'servicenow.create_catalog_item',
          target: { systemType: 'servicenow', applicationId: ctx.applicationId },
          inputs: {
            name: `Request Access — ${ctx.applicationName}`,
            description: `Self-service SSO access request for ${ctx.applicationName}`,
            category: 'IAM Access',
            fulfillmentGroup: 'SG-SSO-' + ctx.applicationName.replace(/\s+/g, '-'),
          },
          validationRules: [],
        },
        false,
      ),
      this.createStep(7, 'app_connector.configure_sso', 'app_connector', ctx.applicationName,
        `Configure SSO on ${ctx.applicationName} application side`,
        {
          actionType: 'app_connector.configure_sso',
          target: { systemType: 'app_connector', applicationId: ctx.applicationId },
          inputs: {
            idpMetadataUrl: '{{idpMetadataUrl}}',
            idpEntityId: '{{idpEntityId}}',
            idpCertificate: '{{idpCertificate}}',
          },
          validationRules: [],
        },
        true, // Requires app admin credential
      ),
      this.createStep(8, 'verification.test_sso_login', 'internal', 'IDVIZE Verification',
        `Verify SSO login works end-to-end for ${ctx.applicationName}`,
        {
          actionType: 'verification.test_sso_login',
          target: { systemType: 'internal', applicationId: ctx.applicationId },
          inputs: {
            testUserEmail: '{{testUserEmail}}',
            servicePrincipalId: '{{step:1:servicePrincipalId}}',
          },
          validationRules: [],
        },
        false,
      ),
    ];

    const rollbackSteps: ExecutionStep[] = [
      this.createStep(1, 'entra.assign_group_to_app', 'entra', 'Microsoft Entra ID',
        `Remove group assignment from ${ctx.applicationName}`,
        {
          actionType: 'entra.assign_group_to_app',
          target: { systemType: 'entra', applicationId: ctx.applicationId },
          inputs: { action: 'remove' },
          validationRules: [],
        },
        false,
      ),
    ];

    const systemsTouched: SystemTarget[] = [
      { systemType: 'entra', systemName: 'Microsoft Entra ID', operations: ['create_enterprise_app', 'configure_saml', 'create_group', 'assign_group'] },
      { systemType: 'sailpoint', systemName: 'SailPoint IdentityNow', operations: ['create_access_profile'] },
      { systemType: 'servicenow', systemName: 'ServiceNow', operations: ['create_catalog_item'] },
      { systemType: 'app_connector', systemName: ctx.applicationName, operations: ['configure_sso'] },
    ];

    const blastRadius = this.estimateBlastRadius(steps, systemsTouched);

    const prerequisites: PlanPrerequisite[] = [
      {
        prerequisiteId: `prereq-${uuidv4()}`,
        type: 'data_collection',
        description: `Collect SAML Entity ID and ACS URL from ${ctx.applicationName} admin`,
        status: 'pending',
      },
      {
        prerequisiteId: `prereq-${uuidv4()}`,
        type: 'owner_confirmation',
        description: `${ctx.applicationName} owner must confirm SSO scope and user groups`,
        status: 'pending',
      },
      {
        prerequisiteId: `prereq-${uuidv4()}`,
        type: 'credential_handoff',
        description: `Temporary admin credentials for ${ctx.applicationName} app-side configuration`,
        status: 'pending',
      },
      {
        prerequisiteId: `prereq-${uuidv4()}`,
        type: 'system_access_verification',
        description: 'Verify IDVIZE has API access to Entra ID, SailPoint, and ServiceNow',
        status: 'pending',
      },
    ];

    return {
      planId,
      sessionId,
      tenantId: ctx.tenantId,
      agentType: 'sso',
      applicationId: ctx.applicationId,
      applicationName: ctx.applicationName,
      controlId: ctx.controlId,
      controlName: ctx.controlName,
      summary: `Configure end-to-end SSO for ${ctx.applicationName}: Entra enterprise app + SAML → security group → SailPoint access profile → ServiceNow catalog item → app-side SSO → verification`,
      systemsTouched,
      blastRadius,
      steps,
      prerequisites,
      estimatedDuration: 'PT45M',
      rollbackSteps,
      createdAt: new Date().toISOString(),
    };
  }

  // ── MFA Plan ─────────────────────────────────────────────────────────────

  private generateMfaPlan(ctx: PlanContext): ExecutionPlan {
    const planId = `plan-${uuidv4()}`;
    const sessionId = ctx.additionalContext?.sessionId as string ?? '';

    const steps: ExecutionStep[] = [
      this.createStep(1, 'entra.configure_conditional_access', 'entra', 'Microsoft Entra ID',
        `Create Conditional Access policy requiring MFA for ${ctx.applicationName}`,
        {
          actionType: 'entra.configure_conditional_access',
          target: { systemType: 'entra', applicationId: ctx.applicationId },
          inputs: {
            policyName: `CA-MFA-${ctx.applicationName.replace(/\s+/g, '-')}`,
            grantControls: { operator: 'OR', builtInControls: ['mfa'] },
            includeGroups: '{{includeGroups}}',
            state: 'enabledForReportingButNotEnforced',
          },
          validationRules: [
            { field: 'includeGroups', rule: 'required', message: 'Target user groups are required' },
          ],
        },
        false,
      ),
      this.createStep(2, 'entra.configure_mfa_policy', 'entra', 'Microsoft Entra ID',
        `Configure MFA authentication methods for ${ctx.applicationName} users`,
        {
          actionType: 'entra.configure_mfa_policy',
          target: { systemType: 'entra' },
          inputs: {
            allowedMethods: ['microsoftAuthenticator', 'fido2', 'softwareOath'],
            disallowedMethods: ['sms', 'voiceCall'],
          },
          validationRules: [],
        },
        false,
      ),
      this.createStep(3, 'verification.test_mfa_enforcement', 'internal', 'IDVIZE Verification',
        `Verify MFA enforcement is active for ${ctx.applicationName}`,
        {
          actionType: 'verification.test_mfa_enforcement',
          target: { systemType: 'internal', applicationId: ctx.applicationId },
          inputs: { testUserEmail: '{{testUserEmail}}' },
          validationRules: [],
        },
        false,
      ),
    ];

    const systemsTouched: SystemTarget[] = [
      { systemType: 'entra', systemName: 'Microsoft Entra ID', operations: ['configure_conditional_access', 'configure_mfa_policy'] },
    ];

    const blastRadius = this.estimateBlastRadius(steps, systemsTouched);

    const prerequisites: PlanPrerequisite[] = [
      {
        prerequisiteId: `prereq-${uuidv4()}`,
        type: 'data_collection',
        description: `Identify target user groups for MFA enforcement on ${ctx.applicationName}`,
        status: 'pending',
      },
      {
        prerequisiteId: `prereq-${uuidv4()}`,
        type: 'owner_confirmation',
        description: `${ctx.applicationName} owner must confirm MFA scope and rollout plan`,
        status: 'pending',
      },
    ];

    return {
      planId,
      sessionId,
      tenantId: ctx.tenantId,
      agentType: 'mfa',
      applicationId: ctx.applicationId,
      applicationName: ctx.applicationName,
      controlId: ctx.controlId,
      controlName: ctx.controlName,
      summary: `Configure MFA enforcement for ${ctx.applicationName}: Conditional Access policy (Report-Only) → MFA method configuration → verification`,
      systemsTouched,
      blastRadius,
      steps,
      prerequisites,
      estimatedDuration: 'PT20M',
      rollbackSteps: [],
      createdAt: new Date().toISOString(),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private createStep(
    order: number,
    actionType: ActionType,
    systemType: SystemType,
    systemName: string,
    description: string,
    toolAction: ToolAction,
    requiresCredential: boolean,
  ): ExecutionStep {
    return {
      stepId: `step-${uuidv4()}`,
      order,
      actionType,
      targetSystem: { systemType, systemName, operations: [actionType.split('.').pop() ?? actionType] },
      description,
      toolAction,
      status: 'pending',
      requiresCredential,
    };
  }

  estimateBlastRadius(steps: ExecutionStep[], systems: SystemTarget[]): BlastRadius {
    const systemCount = systems.length;
    const hasCredentialStep = steps.some(s => s.requiresCredential);

    let level: BlastRadiusLevel = 'low';
    if (systemCount >= 4 || hasCredentialStep) level = 'high';
    else if (systemCount >= 2) level = 'medium';

    return {
      level,
      affectedUsers: 0,  // Populated during execution from group membership
      affectedSystems: systemCount,
      reversible: steps.every(s => s.actionType !== 'app_connector.configure_sso'),
      justification: `${steps.length} steps across ${systemCount} system(s)${hasCredentialStep ? '; requires app admin credentials' : ''}`,
    };
  }
}

export const planningService = new PlanningService();
