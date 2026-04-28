/**
 * App Connector Tool Adapter — Executes allowlisted app-side operations
 * through tenant-configured connectors/playbooks.
 *
 * v1: Human-assisted mode — all operations require manual intervention.
 *     No generic browser automation with arbitrary app URLs.
 *
 * Security:
 *   - Credential escrow is one-time use
 *   - Credentials received via handle (never plaintext in logs/evidence/session)
 *   - App credentials destroyed after use, failure, cancellation, or expiry
 *   - No generic browser automation or arbitrary app URLs
 *   - For unsupported apps, returns human-assisted mode results
 */

import { credentialEscrowService } from '../credential-escrow.service';
import { evidenceStoreService } from '../evidence-store.service';
import type { ToolAdapter, ExecutionContext } from '../tool-broker.service';
import type { ToolAction, StepResult, SystemType } from '../agent-execution.types';

class AppConnectorAdapter implements ToolAdapter {
  systemType: SystemType = 'app_connector';
  systemName = 'Application Connector';

  isConfigured(): boolean {
    return true;
  }

  async execute(action: ToolAction, credentialHandle?: string, context?: ExecutionContext): Promise<StepResult> {
    switch (action.actionType) {
      case 'app_connector.configure_sso':
        return await this.configureSso(action, credentialHandle, context);
      case 'app_connector.verify_sso_login':
        return await this.verifySsoLogin(action, credentialHandle, context);
      case 'app_connector.configure_scim':
        return await this.configureScim(action, credentialHandle, context);
      default:
        return {
          success: false,
          output: {},
          errorMessage: `Unsupported app connector action: ${action.actionType}`,
          evidenceIds: [],
        };
    }
  }

  private async configureSso(
    action: ToolAction, credentialHandle?: string, context?: ExecutionContext,
  ): Promise<StepResult> {
    // In v1, app-side SSO configuration is always human-assisted
    // Credential handle is validated but the actual config is manual
    const evidenceIds: string[] = [];

    if (context && credentialHandle) {
      // Verify credential handle exists and is usable (one-time check)
      try {
        const handoff = credentialEscrowService.getHandoff(context.tenantId, credentialHandle);
        if (!handoff) {
          return this.failResult('Credential handle not found — may have been destroyed or expired');
        }
        if (handoff.status === 'expired' || handoff.status === 'destroyed') {
          return this.failResult(`Credential handle is ${handoff.status} — cannot proceed`);
        }

        // Record that credential was available (but NOT its value)
        const evidenceId = await this.recordEvidence(context, action, {
          credentialAvailable: true,
          credentialStatus: handoff.status,
          targetSystem: handoff.targetSystem,
          purpose: handoff.purpose,
          mode: 'human_assisted',
        });
        evidenceIds.push(evidenceId);
      } catch (err) {
        return this.failResult(`Credential validation failed: ${(err as Error).message}`);
      }
    }

    return {
      success: false,
      requiresManualAction: true,
      output: {
        ssoConfigured: false,
        mode: 'human_assisted',
        note: 'App-side SSO configuration requires human intervention. ' +
              'The execution session has been paused for manual app-side setup. ' +
              'Credential has been made available via the credential escrow.',
        actionType: action.actionType,
        applicationId: action.target.applicationId,
        credentialProvided: !!credentialHandle,
      },
      evidenceIds,
    };
  }

  private async verifySsoLogin(
    action: ToolAction, _credentialHandle?: string, context?: ExecutionContext,
  ): Promise<StepResult> {
    const evidenceIds: string[] = [];

    if (context) {
      const evidenceId = await this.recordEvidence(context, action, {
        mode: 'human_assisted',
        note: 'SSO login verification requires human testing',
      });
      evidenceIds.push(evidenceId);
    }

    return {
      success: false,
      requiresManualAction: true,
      output: {
        verified: false,
        mode: 'human_assisted',
        note: 'SSO login verification requires manual testing. ' +
              'An operator should test the SSO login flow and confirm it works.',
        actionType: action.actionType,
        applicationId: action.target.applicationId,
      },
      evidenceIds,
    };
  }

  private async configureScim(
    action: ToolAction, credentialHandle?: string, context?: ExecutionContext,
  ): Promise<StepResult> {
    const evidenceIds: string[] = [];

    if (context && credentialHandle) {
      try {
        const handoff = credentialEscrowService.getHandoff(context.tenantId, credentialHandle);
        if (!handoff) {
          return this.failResult('Credential handle not found');
        }
        if (handoff.status === 'expired' || handoff.status === 'destroyed') {
          return this.failResult(`Credential handle is ${handoff.status}`);
        }

        const evidenceId = await this.recordEvidence(context, action, {
          credentialAvailable: true,
          credentialStatus: handoff.status,
          mode: 'human_assisted',
        });
        evidenceIds.push(evidenceId);
      } catch (err) {
        return this.failResult(`Credential validation failed: ${(err as Error).message}`);
      }
    }

    return {
      success: false,
      requiresManualAction: true,
      output: {
        scimConfigured: false,
        mode: 'human_assisted',
        note: 'SCIM provisioning configuration requires human intervention. ' +
              'The execution session has been paused for manual app-side setup.',
        actionType: action.actionType,
        applicationId: action.target.applicationId,
        credentialProvided: !!credentialHandle,
      },
      evidenceIds,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private failResult(errorMessage: string): StepResult {
    return { success: false, output: {}, errorMessage, evidenceIds: [] };
  }

  private async recordEvidence(
    ctx: ExecutionContext, action: ToolAction, data: Record<string, unknown>,
  ): Promise<string> {
    const evidence = await evidenceStoreService.record(
      ctx.tenantId,
      ctx.sessionId,
      'api_response',
      `App Connector: ${action.actionType}`,
      `Human-assisted mode — ${action.target.applicationId ?? 'unknown app'}`,
      {
        provider: 'app_connector',
        actionType: action.actionType,
        tenantId: ctx.tenantId,
        sessionId: ctx.sessionId,
        stepId: ctx.stepId,
        ...data,
        timestamp: new Date().toISOString(),
      },
      ctx.stepId,
    );
    return evidence.evidenceId;
  }
}

export const appConnectorAdapter = new AppConnectorAdapter();
