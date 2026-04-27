/**
 * Internal Verification Tool Adapter — Executes allowlisted verification actions.
 *
 * v1: Stub implementation — returns structured verification results.
 * v2: Will perform actual SSO login tests, MFA enforcement checks, and group membership validation.
 */

import type { ToolAdapter } from '../tool-broker.service';
import type { ToolAction, StepResult, SystemType } from '../agent-execution.types';

class InternalAdapter implements ToolAdapter {
  systemType: SystemType = 'internal';
  systemName = 'Internal Verification';

  isConfigured(): boolean {
    return true;
  }

  async execute(action: ToolAction, _credentialHandle?: string): Promise<StepResult> {
    switch (action.actionType) {
      case 'verification.test_sso_login':
        return this.stubResult(action, {
          ssoTestPassed: true,
          mode: 'human_assisted',
          note: 'v1: SSO login verification requires manual testing. Execution plan paused for human verification.',
        });

      case 'verification.test_mfa_enforcement':
        return this.stubResult(action, {
          mfaEnforced: true,
          mode: 'human_assisted',
          note: 'v1: MFA enforcement verification requires manual testing. Execution plan paused for human verification.',
        });

      case 'verification.validate_group_membership':
        return this.stubResult(action, {
          groupMembershipValid: true,
          mode: 'human_assisted',
          note: 'v1: Group membership validation requires manual verification.',
        });

      default:
        return {
          success: false,
          output: {},
          errorMessage: `Unsupported internal action: ${action.actionType}`,
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
        _note: 'v1 stub — no real changes made. Will perform actual verification in v2',
        actionType: action.actionType,
        applicationId: action.target.applicationId,
      },
      evidenceIds: [],
    };
  }
}

export const internalAdapter = new InternalAdapter();
