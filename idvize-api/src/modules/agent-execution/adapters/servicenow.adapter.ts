/**
 * ServiceNow Tool Adapter — Executes allowlisted ServiceNow operations.
 *
 * v1: Stub implementation — validates inputs and returns structured results.
 * v2: Will use ServiceNow REST API (Table API + Catalog API).
 */

import type { ToolAdapter } from '../tool-broker.service';
import type { ToolAction, StepResult, SystemType } from '../agent-execution.types';

class ServiceNowAdapter implements ToolAdapter {
  systemType: SystemType = 'servicenow';
  systemName = 'ServiceNow';

  isConfigured(): boolean {
    return !!(process.env.SERVICENOW_INSTANCE_URL && process.env.SERVICENOW_CLIENT_ID && process.env.SERVICENOW_CLIENT_SECRET);
  }

  async execute(action: ToolAction, _credentialHandle?: string): Promise<StepResult> {
    switch (action.actionType) {
      case 'servicenow.create_catalog_item':
        return this.stubResult(action, {
          catalogItemId: `stub-ci-${Date.now()}`,
          name: action.inputs.name,
          category: action.inputs.category,
        });

      case 'servicenow.create_request_mapping':
        return this.stubResult(action, {
          mappingId: `stub-rm-${Date.now()}`,
          sourceSystem: action.inputs.sourceSystem,
        });

      case 'servicenow.create_workflow':
        return this.stubResult(action, {
          workflowId: `stub-wf-${Date.now()}`,
          name: action.inputs.name,
        });

      default:
        return {
          success: false,
          output: {},
          errorMessage: `Unsupported ServiceNow action: ${action.actionType}`,
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
        _note: 'v1 stub — will use ServiceNow REST API in v2',
        actionType: action.actionType,
      },
      evidenceIds: [],
    };
  }
}

export const servicenowAdapter = new ServiceNowAdapter();
