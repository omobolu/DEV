import { PlatformIntegration } from '../integration.types';
import { IamPlatformLink } from '../../application/application.types';

interface EntraAppRecord {
  appId: string;
  displayName: string;
  ssoEnabled: boolean;
  mfaEnabled: boolean;
  scimEnabled: boolean;
  samlConfigured: boolean;
  oidcConfigured: boolean;
}

/**
 * Entra ID Adapter — queries Microsoft Graph API for application SSO/MFA state.
 * Phase 1: Mock mode. Phase 2: Live Graph API calls.
 */
export class EntraAdapter {
  private readonly isConfigured = !!(
    process.env.ENTRA_TENANT_ID &&
    process.env.ENTRA_CLIENT_ID &&
    process.env.ENTRA_CLIENT_SECRET
  );

  getIntegrationStatus(): PlatformIntegration {
    return {
      platform: 'Entra ID',
      status: this.isConfigured ? 'connected' : 'mock',
      baseUrl: `https://graph.microsoft.com/v1.0/tenants/${process.env.ENTRA_TENANT_ID ?? 'not-configured'}`,
      lastChecked: new Date().toISOString(),
      capabilities: ['SSO (SAML/OIDC)', 'MFA/Conditional Access', 'SCIM Provisioning', 'App Registration', 'Group Management'],
    };
  }

  /**
   * Fetch all enterprise apps from Entra ID.
   * Mock returns representative data for correlation.
   */
  async listEnterpriseApps(): Promise<EntraAppRecord[]> {
    if (!this.isConfigured) {
      return [
        { appId: 'entra-salesforce', displayName: 'Salesforce', ssoEnabled: true, mfaEnabled: true, scimEnabled: true, samlConfigured: true, oidcConfigured: false },
        { appId: 'entra-jira', displayName: 'Jira', ssoEnabled: true, mfaEnabled: false, scimEnabled: true, samlConfigured: false, oidcConfigured: true },
        { appId: 'entra-github', displayName: 'GitHub Enterprise', ssoEnabled: true, mfaEnabled: false, scimEnabled: false, samlConfigured: true, oidcConfigured: false },
        { appId: 'entra-aws', displayName: 'AWS SSO', ssoEnabled: true, mfaEnabled: true, scimEnabled: false, samlConfigured: true, oidcConfigured: false },
      ];
    }
    // TODO: GET https://graph.microsoft.com/v1.0/servicePrincipals?$filter=tags/any(x:x eq 'WindowsAzureActiveDirectoryIntegratedApp')
    throw new Error('Live Entra adapter not yet implemented');
  }

  /**
   * Correlate a local app name to an Entra enterprise app record.
   */
  async correlateApp(appName: string): Promise<IamPlatformLink> {
    const apps = await this.listEnterpriseApps();
    const normalizedName = appName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const match = apps.find(a =>
      a.displayName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedName) ||
      normalizedName.includes(a.displayName.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );

    if (match) {
      return {
        platform: 'AM',
        tool: 'Entra',
        onboarded: true,
        status: match.ssoEnabled ? 'active' : 'partial',
      };
    }

    return { platform: 'AM', tool: 'Entra', onboarded: false, status: 'not_onboarded' };
  }

  /**
   * Check if MFA is enforced for a given app via Conditional Access.
   */
  async isMfaEnforced(appName: string): Promise<boolean> {
    const apps = await this.listEnterpriseApps();
    const normalizedName = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = apps.find(a => a.displayName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedName));
    return match?.mfaEnabled ?? false;
  }

  /**
   * Check if SCIM provisioning is configured for a given app.
   */
  async isScimEnabled(appName: string): Promise<boolean> {
    const apps = await this.listEnterpriseApps();
    const normalizedName = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = apps.find(a => a.displayName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedName));
    return match?.scimEnabled ?? false;
  }
}

export const entraAdapter = new EntraAdapter();
