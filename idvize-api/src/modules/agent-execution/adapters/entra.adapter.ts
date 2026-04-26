/**
 * Entra ID Tool Adapter — Executes allowlisted Entra ID operations.
 *
 * v1: Stub implementation — validates inputs and returns structured results.
 * v2: Will use Microsoft Graph API through the existing Entra connector.
 *
 * Credentials are NEVER passed through the adapter interface.
 * The adapter retrieves them from the Credential Escrow by handle if needed.
 */

import type { ToolAdapter } from '../tool-broker.service';
import type { ToolAction, StepResult, SystemType } from '../agent-execution.types';

class EntraAdapter implements ToolAdapter {
  systemType: SystemType = 'entra';
  systemName = 'Microsoft Entra ID';

  isConfigured(): boolean {
    return !!(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET);
  }

  async execute(action: ToolAction, _credentialHandle?: string): Promise<StepResult> {
    // v1: Validate inputs and return structured stub result
    // v2: Call Microsoft Graph API
    switch (action.actionType) {
      case 'entra.create_enterprise_app':
        return this.stubResult(action, {
          objectId: `stub-app-${Date.now()}`,
          appId: `stub-appid-${Date.now()}`,
          displayName: action.inputs.displayName as string,
        });

      case 'entra.configure_saml_sso':
        return this.stubResult(action, {
          entityId: action.inputs.entityId,
          acsUrl: action.inputs.acsUrl,
          ssoConfigured: true,
        });

      case 'entra.create_group':
        return this.stubResult(action, {
          groupId: `stub-group-${Date.now()}`,
          displayName: action.inputs.displayName as string,
        });

      case 'entra.assign_group_to_app':
        return this.stubResult(action, {
          assigned: true,
          groupName: action.inputs.groupName,
        });

      case 'entra.configure_conditional_access':
        return this.stubResult(action, {
          policyId: `stub-ca-${Date.now()}`,
          policyName: action.inputs.policyName,
          state: action.inputs.state,
        });

      case 'entra.configure_mfa_policy':
        return this.stubResult(action, {
          allowedMethods: action.inputs.allowedMethods,
          configured: true,
        });

      default:
        return {
          success: false,
          output: {},
          errorMessage: `Unsupported Entra action: ${action.actionType}`,
          evidenceIds: [],
        };
    }
  }

  private stubResult(action: ToolAction, output: Record<string, unknown>): StepResult {
    return {
      success: true,
      output: {
        ...output,
        _stub: true,
        _note: 'v1 stub — will use Microsoft Graph API in v2',
        actionType: action.actionType,
      },
      evidenceIds: [],
    };
  }
}

export const entraAdapter = new EntraAdapter();
