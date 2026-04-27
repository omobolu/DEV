/**
 * SailPoint IdentityNow Tool Adapter — Executes allowlisted SailPoint operations.
 *
 * v1: Stub implementation — validates inputs and returns structured results.
 * v2: Will use SailPoint IdentityNow REST API.
 */

import type { ToolAdapter } from '../tool-broker.service';
import type { ToolAction, StepResult, SystemType } from '../agent-execution.types';

class SailPointAdapter implements ToolAdapter {
  systemType: SystemType = 'sailpoint';
  systemName = 'SailPoint IdentityNow';

  isConfigured(): boolean {
    return !!(process.env.SAILPOINT_BASE_URL && process.env.SAILPOINT_CLIENT_ID && process.env.SAILPOINT_CLIENT_SECRET);
  }

  async execute(action: ToolAction, _credentialHandle?: string): Promise<StepResult> {
    switch (action.actionType) {
      case 'sailpoint.create_source':
        return this.stubResult(action, {
          sourceId: `stub-source-${Date.now()}`,
          name: action.inputs.name,
        });

      case 'sailpoint.create_access_profile':
        return this.stubResult(action, {
          accessProfileId: `stub-ap-${Date.now()}`,
          name: action.inputs.name,
          sourceGroup: action.inputs.sourceGroup,
        });

      case 'sailpoint.create_role':
        return this.stubResult(action, {
          roleId: `stub-role-${Date.now()}`,
          name: action.inputs.name,
        });

      case 'sailpoint.trigger_aggregation':
        return this.stubResult(action, {
          taskId: `stub-task-${Date.now()}`,
          status: 'queued',
        });

      case 'sailpoint.create_certification_campaign':
        return this.stubResult(action, {
          campaignId: `stub-campaign-${Date.now()}`,
          name: action.inputs.name,
        });

      default:
        return {
          success: false,
          output: {},
          errorMessage: `Unsupported SailPoint action: ${action.actionType}`,
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
        mode: 'simulation',
        _note: 'v1 stub — no real changes made. Will use SailPoint REST API in v2',
        actionType: action.actionType,
      },
      evidenceIds: [],
    };
  }
}

export const sailpointAdapter = new SailPointAdapter();
