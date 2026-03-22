import { PlatformIntegration } from '../integration.types';
import { IamPlatformLink } from '../../application/application.types';

interface OktaAppRecord {
  id: string;
  label: string;
  status: 'ACTIVE' | 'INACTIVE';
  signOnMode: string;
  mfaRequired: boolean;
}

export class OktaAdapter {
  private readonly isConfigured = !!(
    process.env.OKTA_DOMAIN &&
    process.env.OKTA_API_TOKEN
  );

  getIntegrationStatus(): PlatformIntegration {
    return {
      platform: 'Okta',
      status: this.isConfigured ? 'connected' : 'mock',
      baseUrl: process.env.OKTA_DOMAIN ? `https://${process.env.OKTA_DOMAIN}` : undefined,
      lastChecked: new Date().toISOString(),
      capabilities: ['CIAM', 'Customer SSO', 'MFA/Passwordless', 'Universal Login', 'Social Identity Providers', 'Progressive Profiling'],
    };
  }

  async listApps(): Promise<OktaAppRecord[]> {
    if (!this.isConfigured) {
      return [
        { id: 'okta-customer-portal', label: 'Customer Portal', status: 'ACTIVE', signOnMode: 'OPENID_CONNECT', mfaRequired: false },
        { id: 'okta-partner-portal', label: 'Partner Portal', status: 'ACTIVE', signOnMode: 'SAML_2_0', mfaRequired: true },
      ];
    }
    throw new Error('Live Okta adapter not yet implemented');
  }

  async correlateApp(appName: string): Promise<IamPlatformLink> {
    const apps = await this.listApps();
    const normalizedName = appName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const match = apps.find(a =>
      a.label.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedName) ||
      normalizedName.includes(a.label.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );

    if (match) {
      return { platform: 'CIAM', tool: 'Okta', onboarded: true, status: match.status === 'ACTIVE' ? 'active' : 'partial' };
    }

    return { platform: 'CIAM', tool: 'Okta', onboarded: false, status: 'not_onboarded' };
  }
}

export const oktaAdapter = new OktaAdapter();
