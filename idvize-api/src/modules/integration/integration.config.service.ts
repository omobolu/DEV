/**
 * Integration Config Service
 *
 * Stores IAM platform credentials at runtime (in-memory + persists to .env).
 * Tests connections using the credentials supplied in the request — never falls
 * back to previously saved values so a wrong credential always fails.
 * Logs every save and test event to the audit log.
 */

import * as fs from 'fs';
import * as path from 'path';
import { auditService } from '../security/audit/audit.service';

export interface PlatformCredentials {
  entra?:     { tenantId: string; clientId: string; clientSecret: string };
  sailpoint?: { baseUrl: string; clientId: string; clientSecret: string };
  cyberark?:  { baseUrl: string; username: string; password: string };
  okta?:      { domain: string; apiToken: string };
}

export type PlatformKey = keyof PlatformCredentials;

export type ConnectionStatus = 'connected' | 'failed' | 'not_configured' | 'mock';

export interface TestResult {
  platform:  PlatformKey;
  status:    ConnectionStatus;
  message:   string;
  testedAt:  string;
  httpStatus?: number;
}

class IntegrationConfigService {
  private envPath = path.resolve(process.cwd(), '.env');

  // ── Persist credentials ────────────────────────────────────────────────────

  private applyToEnv(creds: PlatformCredentials) {
    if (creds.entra) {
      process.env.ENTRA_TENANT_ID     = creds.entra.tenantId;
      process.env.ENTRA_CLIENT_ID     = creds.entra.clientId;
      process.env.ENTRA_CLIENT_SECRET = creds.entra.clientSecret;
    }
    if (creds.sailpoint) {
      process.env.SAILPOINT_BASE_URL      = creds.sailpoint.baseUrl;
      process.env.SAILPOINT_CLIENT_ID     = creds.sailpoint.clientId;
      process.env.SAILPOINT_CLIENT_SECRET = creds.sailpoint.clientSecret;
    }
    if (creds.cyberark) {
      process.env.CYBERARK_BASE_URL  = creds.cyberark.baseUrl;
      process.env.CYBERARK_USERNAME  = creds.cyberark.username;
      process.env.CYBERARK_PASSWORD  = creds.cyberark.password;
    }
    if (creds.okta) {
      process.env.OKTA_DOMAIN    = creds.okta.domain;
      process.env.OKTA_API_TOKEN = creds.okta.apiToken;
    }
  }

  private persistToEnv(creds: PlatformCredentials) {
    let content = '';
    try { content = fs.readFileSync(this.envPath, 'utf-8'); } catch { /* file missing */ }

    const set = (key: string, value: string) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      content = regex.test(content)
        ? content.replace(regex, `${key}=${value}`)
        : content + `\n${key}=${value}`;
    };

    if (creds.entra) {
      set('ENTRA_TENANT_ID',     creds.entra.tenantId);
      set('ENTRA_CLIENT_ID',     creds.entra.clientId);
      set('ENTRA_CLIENT_SECRET', creds.entra.clientSecret);
    }
    if (creds.sailpoint) {
      set('SAILPOINT_BASE_URL',      creds.sailpoint.baseUrl);
      set('SAILPOINT_CLIENT_ID',     creds.sailpoint.clientId);
      set('SAILPOINT_CLIENT_SECRET', creds.sailpoint.clientSecret);
    }
    if (creds.cyberark) {
      set('CYBERARK_BASE_URL',  creds.cyberark.baseUrl);
      set('CYBERARK_USERNAME',  creds.cyberark.username);
      set('CYBERARK_PASSWORD',  creds.cyberark.password);
    }
    if (creds.okta) {
      set('OKTA_DOMAIN',    creds.okta.domain);
      set('OKTA_API_TOKEN', creds.okta.apiToken);
    }

    fs.writeFileSync(this.envPath, content, 'utf-8');
  }

  /** Save credentials: apply to runtime env + persist to .env + audit log */
  async save(creds: PlatformCredentials, actorId = 'system', actorName = 'System'): Promise<void> {
    const platforms = Object.keys(creds) as PlatformKey[];
    this.applyToEnv(creds);
    this.persistToEnv(creds);

    for (const platform of platforms) {
      await auditService.log({
        eventType: 'authz.allow',
        actorId,
        actorName,
        resource:  `/integrations/configure/${platform}`,
        outcome:   'success',
        reason:    `Credentials saved for ${platform}`,
        metadata:  { action: 'integration.credentials.saved', platform },
      });
      console.log(`[IntegrationConfig] Credentials saved for platform=${platform} by actor=${actorId}`);
    }
  }

  // ── Status helpers ─────────────────────────────────────────────────────────

  getStatuses(): Record<PlatformKey, ConnectionStatus> {
    return {
      entra:     !!(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET) ? 'connected' : 'not_configured',
      sailpoint: !!(process.env.SAILPOINT_BASE_URL && process.env.SAILPOINT_CLIENT_ID && process.env.SAILPOINT_CLIENT_SECRET) ? 'connected' : 'not_configured',
      cyberark:  !!(process.env.CYBERARK_BASE_URL && process.env.CYBERARK_USERNAME && process.env.CYBERARK_PASSWORD) ? 'connected' : 'not_configured',
      okta:      !!(process.env.OKTA_DOMAIN && process.env.OKTA_API_TOKEN) ? 'connected' : 'not_configured',
    };
  }

  getMaskedConfig() {
    const mask = (v: string | undefined) => v ? `${v.slice(0, 4)}${'*'.repeat(Math.max(0, v.length - 4))}` : '';
    return {
      entra:     { tenantId: process.env.ENTRA_TENANT_ID ?? '', clientId: process.env.ENTRA_CLIENT_ID ?? '', clientSecret: mask(process.env.ENTRA_CLIENT_SECRET) },
      sailpoint: { baseUrl: process.env.SAILPOINT_BASE_URL ?? '', clientId: process.env.SAILPOINT_CLIENT_ID ?? '', clientSecret: mask(process.env.SAILPOINT_CLIENT_SECRET) },
      cyberark:  { baseUrl: process.env.CYBERARK_BASE_URL ?? '', username: process.env.CYBERARK_USERNAME ?? '', password: mask(process.env.CYBERARK_PASSWORD) },
      okta:      { domain: process.env.OKTA_DOMAIN ?? '', apiToken: mask(process.env.OKTA_API_TOKEN) },
    };
  }

  // ── Test connection — ALWAYS uses the supplied credentials, never env vars ──

  async testConnection(
    platform: PlatformKey,
    creds: PlatformCredentials,
    actorId = 'system',
    actorName = 'System',
  ): Promise<TestResult> {
    const now = new Date().toISOString();
    let result: TestResult;

    result = await this._runTest(platform, creds, now);

    // Audit every test attempt — success or failure
    await auditService.log({
      eventType: result.status === 'connected' ? 'authz.allow' : 'authz.deny',
      actorId,
      actorName,
      resource:  `/integrations/test/${platform}`,
      outcome:   result.status === 'connected' ? 'success' : 'failure',
      reason:    result.message,
      metadata:  {
        action:     'integration.connection.test',
        platform,
        status:     result.status,
        httpStatus: result.httpStatus,
        testedAt:   result.testedAt,
      },
    });

    console.log(`[IntegrationConfig] Connection test platform=${platform} status=${result.status} message="${result.message}" actor=${actorId}`);

    return result;
  }

  private async _runTest(platform: PlatformKey, creds: PlatformCredentials, now: string): Promise<TestResult> {

    if (platform === 'entra') {
      const c = creds.entra;
      if (!c?.tenantId || !c?.clientId || !c?.clientSecret) {
        return { platform, status: 'not_configured', message: 'All three Entra fields are required (Tenant ID, Client ID, Client Secret)', testedAt: now };
      }
      // Reject obvious placeholder / whitespace-only values
      if ([c.tenantId, c.clientId, c.clientSecret].some(v => v.trim().length < 8)) {
        return { platform, status: 'failed', message: 'One or more credential fields are too short to be valid', testedAt: now };
      }
      try {
        const tokenUrl = `https://login.microsoftonline.com/${c.tenantId.trim()}/oauth2/v2.0/token`;
        const body = new URLSearchParams({
          grant_type:    'client_credentials',
          client_id:     c.clientId.trim(),
          client_secret: c.clientSecret.trim(),
          scope:         'https://graph.microsoft.com/.default',
        });
        const res = await fetch(tokenUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal:  AbortSignal.timeout(10000),
        });
        const httpStatus = res.status;
        if (res.ok) {
          return { platform, status: 'connected', message: 'Successfully authenticated with Microsoft Graph', testedAt: now, httpStatus };
        }
        const err = await res.json() as Record<string, string>;
        const detail = err.error_description ?? err.error ?? `HTTP ${httpStatus}`;
        return { platform, status: 'failed', message: `Authentication failed: ${detail}`, testedAt: now, httpStatus };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Network error';
        return { platform, status: 'failed', message: `Connection error: ${msg}`, testedAt: now };
      }
    }

    if (platform === 'sailpoint') {
      const c = creds.sailpoint;
      if (!c?.baseUrl || !c?.clientId || !c?.clientSecret) {
        return { platform, status: 'not_configured', message: 'All three SailPoint fields are required', testedAt: now };
      }
      try {
        const res = await fetch(`${c.baseUrl.trim()}/oauth/token`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    new URLSearchParams({ grant_type: 'client_credentials', client_id: c.clientId.trim(), client_secret: c.clientSecret.trim() }),
          signal:  AbortSignal.timeout(10000),
        });
        const httpStatus = res.status;
        return res.ok
          ? { platform, status: 'connected', message: 'Successfully authenticated with SailPoint IdentityNow', testedAt: now, httpStatus }
          : { platform, status: 'failed', message: `Authentication failed: HTTP ${httpStatus} — check URL and credentials`, testedAt: now, httpStatus };
      } catch (e: unknown) {
        return { platform, status: 'failed', message: `Connection error: ${e instanceof Error ? e.message : 'Network error'}`, testedAt: now };
      }
    }

    if (platform === 'cyberark') {
      const c = creds.cyberark;
      if (!c?.baseUrl || !c?.username || !c?.password) {
        return { platform, status: 'not_configured', message: 'All three CyberArk fields are required', testedAt: now };
      }
      try {
        const res = await fetch(`${c.baseUrl.trim()}/PasswordVault/API/Auth/CyberArk/Logon`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ username: c.username.trim(), password: c.password }),
          signal:  AbortSignal.timeout(10000),
        });
        const httpStatus = res.status;
        return res.ok
          ? { platform, status: 'connected', message: 'Successfully authenticated with CyberArk PAM', testedAt: now, httpStatus }
          : { platform, status: 'failed', message: `Authentication failed: HTTP ${httpStatus} — check URL and credentials`, testedAt: now, httpStatus };
      } catch (e: unknown) {
        return { platform, status: 'failed', message: `Connection error: ${e instanceof Error ? e.message : 'Network error'}`, testedAt: now };
      }
    }

    if (platform === 'okta') {
      const c = creds.okta;
      if (!c?.domain || !c?.apiToken) {
        return { platform, status: 'not_configured', message: 'Okta domain and API token are required', testedAt: now };
      }
      try {
        const res = await fetch(`https://${c.domain.trim()}/api/v1/org`, {
          headers: { Authorization: `SSWS ${c.apiToken.trim()}`, Accept: 'application/json' },
          signal:  AbortSignal.timeout(10000),
        });
        const httpStatus = res.status;
        return res.ok
          ? { platform, status: 'connected', message: 'Successfully connected to Okta org', testedAt: now, httpStatus }
          : { platform, status: 'failed', message: `Authentication failed: HTTP ${httpStatus} — check domain and API token`, testedAt: now, httpStatus };
      } catch (e: unknown) {
        return { platform, status: 'failed', message: `Connection error: ${e instanceof Error ? e.message : 'Network error'}`, testedAt: now };
      }
    }

    return { platform, status: 'failed', message: 'Unknown platform', testedAt: now };
  }
}

export const integrationConfigService = new IntegrationConfigService();
