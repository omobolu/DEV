import { PlatformIntegration } from '../integration.types';
import { IamPlatformLink } from '../../application/application.types';

interface SailPointSourceRecord {
  sourceId: string;
  name: string;
  connectorName: string;
  status: 'healthy' | 'needs_configuration' | 'error';
  accountsCount: number;
  lastAggregated?: string;
}

/**
 * SailPoint IdentityNow Adapter — queries sources and identity data.
 * Phase 1: Mock mode. Phase 2: Live IdentityNow V3 API calls.
 */
export class SailPointAdapter {
  private readonly isConfigured = !!(
    process.env.SAILPOINT_BASE_URL &&
    process.env.SAILPOINT_CLIENT_ID &&
    process.env.SAILPOINT_CLIENT_SECRET
  );

  getIntegrationStatus(): PlatformIntegration {
    return {
      platform: 'SailPoint IdentityNow',
      status: this.isConfigured ? 'connected' : 'mock',
      baseUrl: process.env.SAILPOINT_BASE_URL,
      lastChecked: new Date().toISOString(),
      capabilities: ['Identity Lifecycle (JML)', 'Access Certifications', 'Provisioning', 'Role Management', 'Separation of Duties'],
    };
  }

  async listSources(): Promise<SailPointSourceRecord[]> {
    if (!this.isConfigured) {
      return [
        { sourceId: 'src-ad', name: 'Active Directory', connectorName: 'active-directory', status: 'healthy', accountsCount: 3200, lastAggregated: '2026-03-20T02:00:00Z' },
        { sourceId: 'src-sf', name: 'Salesforce', connectorName: 'salesforce', status: 'healthy', accountsCount: 420, lastAggregated: '2026-03-20T03:00:00Z' },
        { sourceId: 'src-sap', name: 'SAP ERP', connectorName: 'sap', status: 'needs_configuration', accountsCount: 0 },
        { sourceId: 'src-jira', name: 'Jira', connectorName: 'jira', status: 'healthy', accountsCount: 850, lastAggregated: '2026-03-20T04:00:00Z' },
      ];
    }
    // TODO: GET {base}/v3/sources
    throw new Error('Live SailPoint adapter not yet implemented');
  }

  async correlateApp(appName: string): Promise<IamPlatformLink> {
    const sources = await this.listSources();
    const normalizedName = appName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const match = sources.find(s =>
      s.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedName) ||
      normalizedName.includes(s.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );

    if (match) {
      return {
        platform: 'IGA',
        tool: 'SailPoint',
        onboarded: true,
        status: match.status === 'healthy' ? 'active' : 'partial',
      };
    }

    return { platform: 'IGA', tool: 'SailPoint', onboarded: false, status: 'not_onboarded' };
  }

  /**
   * Check if JML (Joiner-Mover-Leaver) lifecycle is automated for an app.
   */
  async isJmlAutomated(appName: string): Promise<boolean> {
    const sources = await this.listSources();
    const normalizedName = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = sources.find(s =>
      s.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedName) &&
      s.status === 'healthy' &&
      s.accountsCount > 0
    );
    return !!match;
  }

  /**
   * Check if certifications are configured for an app.
   * Simplified: if source exists and has accounts, assume certs are possible.
   */
  async areCertificationsConfigured(appName: string): Promise<boolean> {
    const sources = await this.listSources();
    const normalizedName = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return sources.some(s =>
      s.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedName) &&
      s.accountsCount > 0
    );
  }
}

export const sailpointAdapter = new SailPointAdapter();
