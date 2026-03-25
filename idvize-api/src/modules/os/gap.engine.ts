/**
 * IDVIZE IAM OS — Gap Engine
 *
 * Evaluates an application's IAM control posture and returns structured
 * gap findings with severity classification.
 *
 * Input fields:
 *   name                — application display name
 *   isInternetFacing    — exposed to the public internet
 *   containsSensitiveData — holds PII, financial, or regulated data
 *   hasSSO              — SSO is configured and enforced
 *   hasMFA              — MFA is enforced for all users
 *   hasIGA              — IGA lifecycle management is configured
 *   hasPAM              — PAM vaulting is configured
 *   hasPrivilegedAccess — application has privileged / admin accounts
 *
 * Output:
 *   { appName, gaps, severity }
 */

export type GapSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AppGapInput {
  name: string;
  isInternetFacing: boolean;
  containsSensitiveData: boolean;
  hasSSO: boolean;
  hasMFA: boolean;
  hasIGA: boolean;
  hasPAM: boolean;
  hasPrivilegedAccess: boolean;
}

export interface AppGapResult {
  appName: string;
  gaps: string[];
  severity: GapSeverity;
}

// ── Gap detection rules ───────────────────────────────────────────────────────

/**
 * Evaluate a single application object and return its gap result.
 */
export function evaluateApp(app: AppGapInput): AppGapResult {
  const gaps: string[] = [];

  // Rule 1: SSO is missing
  if (!app.hasSSO) {
    gaps.push('SSO Missing');
  }

  // Rule 2: MFA missing on an internet-facing application
  if (!app.hasMFA && app.isInternetFacing) {
    gaps.push('MFA Missing (Critical)');
  }

  // Rule 3: IGA not onboarded
  if (!app.hasIGA) {
    gaps.push('IGA Not Onboarded');
  }

  // Rule 4: Application has privileged access but no PAM vaulting
  if (app.hasPrivilegedAccess && !app.hasPAM) {
    gaps.push('PAM Missing');
  }

  // ── Severity classification ───────────────────────────────────────────────
  const severity = classifySeverity(app, gaps);

  return { appName: app.name, gaps, severity };
}

/**
 * Evaluate a list of applications and return all results.
 */
export function evaluateApps(apps: AppGapInput[]): AppGapResult[] {
  return apps.map(evaluateApp);
}

// ── Severity rules ────────────────────────────────────────────────────────────
function classifySeverity(app: AppGapInput, gaps: string[]): GapSeverity {
  // CRITICAL: internet-facing with no MFA
  if (app.isInternetFacing && !app.hasMFA) {
    return 'CRITICAL';
  }

  // HIGH: contains sensitive data with no IGA
  if (app.containsSensitiveData && !app.hasIGA) {
    return 'HIGH';
  }

  // MEDIUM: SSO is missing (but none of the above conditions)
  if (!app.hasSSO) {
    return 'MEDIUM';
  }

  // LOW: any remaining gaps (e.g. PAM missing but not internet-facing)
  if (gaps.length > 0) {
    return 'LOW';
  }

  // No gaps — return LOW as a baseline (caller may filter these out)
  return 'LOW';
}
