import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { detectGapsForApp, detectGaps } from '../services/gapDetection';
import { discoverCapabilities, recommendIntegrationPath } from '../services/capabilityDiscovery';
import { sailpointConnector } from '../connectors/sailpoint';
import { entraConnector } from '../connectors/entra';
import { cyberarkConnector } from '../connectors/cyberark';
import { OrchestrationRequest, OrchestrationResult, ActionResult } from '../types';
import { applications } from '../data/applications';

const router = Router();

/**
 * POST /api/orchestrate
 * Rule-based orchestration engine (Phase 1).
 * Phase 2 will replace this with a Claude AI agent.
 *
 * Body: { intent, appId?, domain?, dryRun? }
 */
router.post('/', async (req: Request, res: Response) => {
  const { intent, appId, domain, dryRun = false } = req.body as OrchestrationRequest;

  if (!intent) {
    res.status(400).json({ success: false, error: 'intent is required', timestamp: new Date().toISOString() });
    return;
  }

  const requestId = uuidv4();
  const actions: ActionResult[] = [];
  const intentLower = intent.toLowerCase();

  try {
    // ── Intent: detect gaps ──────────────────────────────────────────────────
    if (intentLower.includes('gap') || intentLower.includes('coverage')) {
      const summary = appId ? detectGapsForApp(appId) : detectGaps();
      actions.push({
        action: 'detect_gaps',
        status: 'success',
        payload: { appId, scope: appId ? 'single_app' : 'all_apps' },
        result: summary,
      });
    }

    // ── Intent: discover capabilities ────────────────────────────────────────
    if (intentLower.includes('capabilit') || intentLower.includes('discover') || intentLower.includes('protocol')) {
      if (appId) {
        const caps = discoverCapabilities(appId);
        if (caps) {
          const recommendation = recommendIntegrationPath(caps.detectedProtocols);
          actions.push({
            action: 'discover_capabilities',
            status: 'success',
            payload: { appId },
            result: { ...caps, recommendation },
          });
        }
      }
    }

    // ── Intent: configure Entra / SSO ────────────────────────────────────────
    if (intentLower.includes('entra') || intentLower.includes('sso') || intentLower.includes('conditional access') || intentLower.includes('azure')) {
      if (appId) {
        const app = applications.find(a => a.id === appId);
        if (app && !dryRun) {
          const caps = discoverCapabilities(appId);
          const protocol = caps?.detectedProtocols.includes('OIDC') ? 'OIDC' : 'SAML';
          const result = await entraConnector.registerApplication({ name: app.name, protocol });
          actions.push({
            action: 'push_entra_config',
            status: 'success',
            payload: { appId, protocol, dryRun },
            result,
          });
        } else if (dryRun) {
          actions.push({
            action: 'push_entra_config',
            status: 'skipped',
            payload: { appId, dryRun: true },
            result: { message: 'Dry run — no changes made' },
          });
        }
      }
    }

    // ── Intent: generate SailPoint rule ──────────────────────────────────────
    if (intentLower.includes('sailpoint') || intentLower.includes('rule') || intentLower.includes('provision')) {
      if (appId) {
        const app = applications.find(a => a.id === appId);
        if (app) {
          const rule = sailpointConnector.generateAttributeGeneratorRule({
            appName: app.name,
            attribute: 'email',
            logic: `return identity.getAttribute("email");`,
          });
          if (!dryRun) {
            const created = await sailpointConnector.createRule(rule);
            actions.push({
              action: 'generate_sailpoint_rule',
              status: 'success',
              payload: { appId, ruleName: rule.name, dryRun },
              result: created,
            });
          } else {
            actions.push({
              action: 'generate_sailpoint_rule',
              status: 'skipped',
              payload: { appId, ruleName: rule.name, dryRun: true },
              result: { message: 'Dry run — rule generated but not pushed', rule },
            });
          }
        }
      }
    }

    // ── Intent: CyberArk / PAM ───────────────────────────────────────────────
    if (intentLower.includes('cyberark') || intentLower.includes('pam') || intentLower.includes('privileged') || intentLower.includes('safe')) {
      if (appId) {
        const app = applications.find(a => a.id === appId);
        if (app && !dryRun) {
          const safe = await cyberarkConnector.createSafe({
            safeName: `${app.name.replace(/\s+/g, '-')}-Privileged`,
            description: `Auto-created safe for ${app.name} by idvize orchestration`,
            managingCPM: 'PasswordManager',
          });
          actions.push({
            action: 'onboard_cyberark_account',
            status: 'success',
            payload: { appId, safeName: safe.safeName, dryRun },
            result: safe,
          });
        } else if (dryRun) {
          actions.push({
            action: 'onboard_cyberark_account',
            status: 'skipped',
            payload: { appId, dryRun: true },
            result: { message: 'Dry run — no safe created' },
          });
        }
      }
    }

    // ── Intent: notify owner ─────────────────────────────────────────────────
    if (intentLower.includes('notify') || intentLower.includes('email') || intentLower.includes('owner')) {
      if (appId) {
        const app = applications.find(a => a.id === appId);
        if (app) {
          // Phase 1: log the notification (Phase 2 will send real emails)
          const notification = {
            to: app.ownerEmail,
            subject: `IAM Action Required: ${app.name}`,
            body: `Your application ${app.name} has been identified as requiring IAM remediation. Please review the attached gap report.`,
          };
          actions.push({
            action: 'notify_app_owner',
            status: dryRun ? 'skipped' : 'success',
            payload: { appId, dryRun },
            result: dryRun ? { message: 'Dry run — email not sent', notification } : { message: 'Notification logged (email delivery in Phase 2)', notification },
          });
        }
      }
    }

    // ── Fallback if no intent matched ────────────────────────────────────────
    if (actions.length === 0) {
      actions.push({
        action: 'log_decision',
        status: 'skipped',
        payload: { intent },
        result: {
          message: 'Intent not recognized. Supported: gap detection, capability discovery, entra config, sailpoint rule, cyberark/PAM, notify owner.',
        },
      });
    }

    // ── Log the decision ─────────────────────────────────────────────────────
    actions.push({
      action: 'log_decision',
      status: 'success',
      payload: { requestId, intent, appId, dryRun },
      result: { logged: true, timestamp: new Date().toISOString() },
    });

    const successCount = actions.filter(a => a.status === 'success').length;
    const result: OrchestrationResult = {
      requestId,
      intent,
      actions,
      summary: `Orchestration complete. ${successCount} action(s) executed${dryRun ? ' (dry run)' : ''}.`,
      timestamp: new Date().toISOString(),
    };

    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
  }
});

export default router;
