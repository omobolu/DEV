import { BaseConnector } from './base';
import { ConnectorType } from '../types';

interface EntraApp {
  id: string;
  displayName: string;
  appId: string;
  signInAudience: string;
  web?: { redirectUris: string[] };
}

interface ConditionalAccessPolicy {
  displayName: string;
  conditions: Record<string, unknown>;
  grantControls: Record<string, unknown>;
  state: 'enabled' | 'disabled' | 'enabledForReportingButNotEnforced';
}

interface ScimProvisioning {
  appId: string;
  tenantUrl: string;
  secretToken: string;
  mappings?: Record<string, string>;
}

export class EntraConnector extends BaseConnector {
  readonly type: ConnectorType = 'entra';

  protected get isConfigured(): boolean {
    return !!(
      process.env.ENTRA_TENANT_ID &&
      process.env.ENTRA_CLIENT_ID &&
      process.env.ENTRA_CLIENT_SECRET
    );
  }

  /**
   * List all enterprise applications in Entra ID.
   * Live: GET https://graph.microsoft.com/v1.0/applications
   */
  async listApplications(): Promise<EntraApp[]> {
    if (!this.isConfigured) {
      return this.mockResponse<EntraApp[]>([
        {
          id: 'entra-app-001',
          displayName: 'Salesforce CRM',
          appId: 'sf-app-id-mock',
          signInAudience: 'AzureADMyOrg',
          web: { redirectUris: ['https://salesforce.com/oauth/callback'] },
        },
        {
          id: 'entra-app-002',
          displayName: 'Jira Service Management',
          appId: 'jira-app-id-mock',
          signInAudience: 'AzureADMyOrg',
        },
      ]);
    }
    // TODO: implement live Graph API call
    // const token = await this.getAccessToken();
    // const res = await fetch('https://graph.microsoft.com/v1.0/applications', { headers: { Authorization: `Bearer ${token}` } });
    // return (await res.json()).value;
    throw new Error('Live Graph API not yet implemented');
  }

  /**
   * Register a new app in Entra ID with OIDC/SAML configuration.
   * Live: POST https://graph.microsoft.com/v1.0/applications
   */
  async registerApplication(params: {
    name: string;
    protocol: 'OIDC' | 'SAML';
    redirectUri?: string;
  }): Promise<EntraApp> {
    if (!this.isConfigured) {
      return this.mockResponse<EntraApp>({
        id: `entra-new-${Date.now()}`,
        displayName: params.name,
        appId: `mock-app-id-${Date.now()}`,
        signInAudience: 'AzureADMyOrg',
        web: params.redirectUri ? { redirectUris: [params.redirectUri] } : undefined,
      });
    }
    throw new Error('Live Graph API not yet implemented');
  }

  /**
   * Create a Conditional Access policy.
   * Live: POST https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies
   */
  async createConditionalAccessPolicy(policy: ConditionalAccessPolicy): Promise<{ id: string }> {
    if (!this.isConfigured) {
      return this.mockResponse({ id: `ca-policy-mock-${Date.now()}` });
    }
    throw new Error('Live Graph API not yet implemented');
  }

  /**
   * Configure SCIM provisioning for an app.
   * Live: POST https://graph.microsoft.com/v1.0/servicePrincipals/{id}/synchronization/jobs
   */
  async configureScimProvisioning(config: ScimProvisioning): Promise<{ jobId: string }> {
    if (!this.isConfigured) {
      return this.mockResponse({ jobId: `scim-job-mock-${Date.now()}` });
    }
    throw new Error('Live Graph API not yet implemented');
  }

  /**
   * Assign a user or group to an app.
   * Live: POST https://graph.microsoft.com/v1.0/servicePrincipals/{id}/appRoleAssignments
   */
  async assignUserToApp(appId: string, userId: string, roleId: string): Promise<{ id: string }> {
    if (!this.isConfigured) {
      return this.mockResponse({ id: `assignment-mock-${Date.now()}` });
    }
    throw new Error('Live Graph API not yet implemented');
  }
}

export const entraConnector = new EntraConnector();
