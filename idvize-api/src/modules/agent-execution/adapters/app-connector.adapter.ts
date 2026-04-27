/**
 * App Connector Tool Adapter — Executes allowlisted app-side operations
 * through tenant-configured connectors/playbooks.
 *
 * v1: Stub implementation — validates inputs and returns structured results.
 * v2: Will route to per-app connector playbooks.
 *
 * For unsupported apps, this adapter returns a "human-assisted mode" result
 * that instructs the orchestrator to pause for manual intervention.
 */

import type { ToolAdapter } from '../tool-broker.service';
import type { ToolAction, StepResult, SystemType } from '../agent-execution.types';

class AppConnectorAdapter implements ToolAdapter {
  systemType: SystemType = 'app_connector';
  systemName = 'Application Connector';

  isConfigured(): boolean {
    // App connectors are per-application, not a single global config.
    // In v1, always return true — each execute() call checks the specific app.
    return true;
  }

  async execute(action: ToolAction, _credentialHandle?: string): Promise<StepResult> {
    switch (action.actionType) {
      case 'app_connector.configure_sso':
        return this.stubResult(action, {
          ssoConfigured: true,
          mode: 'human_assisted',
          note: 'v1: App-side SSO configuration requires human-assisted mode. The execution plan has been paused for manual app-side setup.',
        });

      case 'app_connector.verify_sso_login':
        return this.stubResult(action, {
          verified: true,
          mode: 'human_assisted',
          note: 'v1: SSO login verification requires human-assisted mode.',
        });

      case 'app_connector.configure_scim':
        return this.stubResult(action, {
          scimConfigured: true,
          mode: 'human_assisted',
          note: 'v1: SCIM configuration requires human-assisted mode.',
        });

      default:
        return {
          success: false,
          output: {},
          errorMessage: `Unsupported app connector action: ${action.actionType}`,
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
        _note: 'v1 stub — no real changes made. Will use per-app connector playbooks in v2',
        actionType: action.actionType,
        applicationId: action.target.applicationId,
      },
      evidenceIds: [],
    };
  }
}

export const appConnectorAdapter = new AppConnectorAdapter();
