import { BuildType, IAMPlatform, RequiredInput, BuildJob } from '../build.types';
import { ControlName } from '../../control/control.types';
import { Application } from '../../application/application.types';

interface BuildSpec {
  buildType: BuildType;
  platform: IAMPlatform;
  requiredInputs: RequiredInput[];
  estimatedHours: number;
  priority: BuildJob['priority'];
}

/**
 * Gap-to-Build Engine
 *
 * Maps a missing control gap → a concrete build specification.
 * Determines the right build type, platform, required inputs, and priority.
 */
export class GapToBuildEngine {

  resolve(controlGap: ControlName, app: Application): BuildSpec {
    switch (controlGap) {
      case 'SSO_ENABLED':
        return this.ssoSpec(app);

      case 'MFA_ENFORCED':
        return {
          buildType: 'ENTRA_CONDITIONAL_ACCESS',
          platform: 'Entra',
          priority: app.riskTier === 'critical' ? 'immediate' : 'high',
          estimatedHours: 4,
          requiredInputs: [
            input('app_display_name', 'Application Display Name (in Entra)', 'Exact name of the enterprise app in Entra ID', true),
            input('target_groups', 'Target User Groups', 'Groups to apply MFA policy to (comma-separated)', false),
            input('exclude_groups', 'Excluded Groups', 'Break-glass or excluded groups (comma-separated)', false),
            input('mfa_strength', 'MFA Strength', 'Authentication strength requirement', false, 'select', ['any', 'multifactor', 'phishing_resistant']),
          ],
        };

      case 'SCIM_PROVISIONING':
        return {
          buildType: 'ENTRA_SCIM',
          platform: 'Entra',
          priority: 'high',
          estimatedHours: 8,
          requiredInputs: [
            input('scim_tenant_url', 'SCIM Tenant URL', 'The SCIM endpoint URL provided by the application', true, 'url'),
            input('scim_secret_token', 'SCIM Secret Token', 'Bearer token for authenticating SCIM requests', true),
            input('scim_test_user', 'Test User UPN', 'User to test provisioning with', true, 'email'),
            input('attribute_mappings', 'Custom Attribute Mappings', 'Any custom attribute mappings (JSON or leave blank)', false),
          ],
        };

      case 'JML_AUTOMATED':
        return {
          buildType: 'SAILPOINT_SOURCE_ONBOARDING',
          platform: 'SailPoint',
          priority: 'high',
          estimatedHours: 16,
          requiredInputs: [
            input('connector_type', 'Connector Type', 'SailPoint connector to use', true, 'select',
              ['active-directory', 'ldap', 'scim', 'jdbc', 'salesforce', 'sap', 'workday', 'rest-service-desk']),
            input('connection_url', 'Connection URL/Host', 'Target system URL or hostname', true, 'url'),
            input('service_account_user', 'Service Account Username', 'Service account for connector authentication', true),
            input('service_account_pass', 'Service Account Password', 'Service account password (stored in vault)', true),
            input('base_dn', 'Base DN (LDAP only)', 'Base distinguished name for LDAP connectors', false),
            input('account_schema', 'Account Schema Attributes', 'Comma-separated list of account attributes to sync', false),
          ],
        };

      case 'CERTIFICATIONS_CONFIGURED':
        return {
          buildType: 'SAILPOINT_CERTIFICATION',
          platform: 'SailPoint',
          priority: 'medium',
          estimatedHours: 4,
          requiredInputs: [
            input('campaign_type', 'Campaign Type', 'Type of access review', true, 'select',
              ['MANAGER', 'SOURCE_OWNER', 'SEARCH', 'ROLE_COMPOSITION']),
            input('review_frequency', 'Review Frequency', 'How often to run the campaign', true, 'select',
              ['monthly', 'quarterly', 'semi-annual', 'annual']),
            input('campaign_owner', 'Campaign Owner Email', 'IAM team member to own the campaign', true, 'email'),
            input('deadline_days', 'Review Deadline (days)', 'Days for reviewers to complete the review', false),
          ],
        };

      case 'PRIVILEGED_ACCOUNTS_VAULTED':
        return {
          buildType: 'CYBERARK_SAFE_CREATION',
          platform: 'CyberArk',
          priority: app.riskTier === 'critical' ? 'immediate' : 'high',
          estimatedHours: 8,
          requiredInputs: [
            input('privileged_accounts', 'Privileged Account List', 'List of admin/service accounts to vault (one per line)', true),
            input('platform_id', 'Platform ID', 'CyberArk platform to assign accounts to', true, 'select',
              ['WinServerLocal', 'WinDomain', 'LinuxSSH', 'OracleDB', 'MSSQL', 'SAP', 'AWSAccessKeys', 'UnixSSH']),
            input('cpm_name', 'CPM Name', 'Central Policy Manager handling rotation', false),
            input('account_hostnames', 'Account Hostnames/IPs', 'Comma-separated hostnames or IPs for the accounts', true),
            input('rotation_days', 'Rotation Interval (days)', 'How often to rotate passwords (default: 30)', false),
          ],
        };

      case 'CIAM_INTEGRATED':
        return {
          buildType: 'OKTA_CIAM_FLOW',
          platform: 'Okta',
          priority: 'high',
          estimatedHours: 24,
          requiredInputs: [
            input('app_type', 'Application Type', 'Web, SPA, or Native', true, 'select', ['web', 'spa', 'native']),
            input('redirect_uris', 'Redirect URIs', 'OAuth callback URIs (comma-separated)', true, 'url'),
            input('logout_uri', 'Post-Logout Redirect URI', 'URL to redirect to after logout', false, 'url'),
            input('mfa_required', 'Require MFA for Customers', 'Whether to enforce MFA for customer accounts', true, 'select', ['yes', 'no', 'risk-based']),
            input('social_providers', 'Social Login Providers', 'Google, Facebook, Apple, etc. (comma-separated)', false),
          ],
        };

      default:
        return {
          buildType: 'MANUAL_GUIDED',
          platform: 'Entra',
          priority: 'medium',
          estimatedHours: 8,
          requiredInputs: [
            input('notes', 'Implementation Notes', 'Describe the required implementation', true),
          ],
        };
    }
  }

  private ssoSpec(app: Application): BuildSpec {
    // Determine SSO build type based on known/inferred protocol preference
    const preferOidc = app.appType === 'saas' || app.appType === 'cloud';

    return {
      buildType: preferOidc ? 'ENTRA_SSO_OIDC' : 'ENTRA_SSO_SAML',
      platform: 'Entra',
      priority: app.riskTier === 'critical' ? 'immediate' : 'high',
      estimatedHours: preferOidc ? 8 : 12,
      requiredInputs: preferOidc
        ? [
            input('redirect_uri', 'OAuth Redirect URI', 'The callback URL the app will redirect to after authentication', true, 'url'),
            input('logout_uri', 'Post-Logout Redirect URI', 'URL to redirect after sign-out', false, 'url'),
            input('scopes', 'OAuth Scopes', 'Required scopes (openid, profile, email, etc.)', false),
            input('client_secret_required', 'Confidential Client?', 'Does the app require a client secret?', true, 'select', ['yes', 'no']),
          ]
        : [
            input('entity_id', 'Entity ID (Identifier URI)', 'The SAML entity identifier (SP Entity ID)', true, 'url'),
            input('acs_url', 'ACS URL (Reply URL)', 'Assertion Consumer Service URL where SAML response is sent', true, 'url'),
            input('sign_on_url', 'Sign-On URL', 'SP-initiated sign-on URL', false, 'url'),
            input('sign_out_url', 'Sign-Out URL', 'SP-initiated sign-out URL', false, 'url'),
            input('name_id_format', 'NameID Format', 'SAML NameID format', false, 'select',
              ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress', 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent', 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient']),
            input('claims', 'Custom Claims', 'Additional claims/attributes to include in SAML assertion (JSON)', false),
          ],
    };
  }
}

function input(
  key: string,
  label: string,
  description: string,
  required: boolean,
  type: RequiredInput['type'] = 'string',
  options?: string[]
): RequiredInput {
  return { key, label, description, type, options, required, collected: false };
}

export const gapToBuildEngine = new GapToBuildEngine();
