// ─── Integration Module Types ─────────────────────────────────────────────────

export type IntegrationStatus = 'connected' | 'mock' | 'not_configured' | 'error';

export interface PlatformIntegration {
  platform: string;
  status: IntegrationStatus;
  baseUrl?: string;
  lastChecked: string;
  capabilities: string[];
}

// ─── Entra ID ─────────────────────────────────────────────────────────────────

export interface EntraAppRegistration {
  id?: string;
  displayName: string;
  signInAudience: 'AzureADMyOrg' | 'AzureADMultipleOrgs' | 'AzureADandPersonalMicrosoftAccount';
  protocol: 'OIDC' | 'SAML';
  web?: { redirectUris: string[]; logoutUrl?: string };
  identifierUris?: string[];
}

export interface EntraSamlConfig {
  appId: string;
  identifierUri: string;             // Entity ID
  replyUrl: string;                  // ACS URL
  signOnUrl?: string;
  logoutUrl?: string;
  claimsMappings?: ClaimsMapping[];
}

export interface EntraOidcConfig {
  appId: string;
  redirectUris: string[];
  scopes: string[];
  grantTypes: string[];
}

export interface ClaimsMapping {
  claimName: string;
  source: string;
  value?: string;
}

export interface ConditionalAccessPolicy {
  displayName: string;
  state: 'enabled' | 'disabled' | 'enabledForReportingButNotEnforced';
  conditions: {
    users?: { includeGroups?: string[]; excludeGroups?: string[] };
    applications?: { includeApplications?: string[] };
    locations?: Record<string, unknown>;
  };
  grantControls: {
    operator: 'AND' | 'OR';
    builtInControls: ('mfa' | 'compliantDevice' | 'domainJoinedDevice')[];
  };
}

// ─── SailPoint ────────────────────────────────────────────────────────────────

export interface SailPointSourceConfig {
  name: string;
  connectorName: string;
  connectorClass: string;
  configuration: Record<string, unknown>;
  schemas?: SailPointSchema[];
}

export interface SailPointSchema {
  objectType: 'account' | 'group';
  identityAttribute: string;
  attributes: SailPointAttribute[];
}

export interface SailPointAttribute {
  name: string;
  type: 'STRING' | 'INT' | 'BOOLEAN' | 'DATE';
  entitlement?: boolean;
  managed?: boolean;
}

export interface SailPointRule {
  name: string;
  type: 'AttributeGenerator' | 'Correlation' | 'Transformation' | 'BeforeProvisioning' | 'AfterProvisioning' | 'BuildMap';
  language: 'beanshell' | 'xml';
  source: string;
  description?: string;
  signature?: { parameters: { name: string; type: string }[] };
}

export interface SailPointWorkflow {
  name: string;
  description?: string;
  type: 'LCM' | 'Approval' | 'Provisioning';
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  name: string;
  action: string;
  condition?: string;
  transitions: { to: string; when?: string }[];
}

// ─── CyberArk ─────────────────────────────────────────────────────────────────

export interface CyberArkSafeDesign {
  safeName: string;
  description: string;
  managingCPM: string;
  numberOfVersionsRetention: number;
  members: CyberArkSafeMember[];
}

export interface CyberArkSafeMember {
  memberName: string;
  memberType: 'User' | 'Group' | 'Role';
  permissions: {
    useAccounts: boolean;
    retrieveAccounts: boolean;
    listAccounts: boolean;
    addAccounts?: boolean;
    manageSafe?: boolean;
  };
}

export interface CyberArkAccountSpec {
  name: string;
  address: string;
  userName: string;
  platformId: string;
  safeName: string;
  secretType: 'password' | 'key';
  automaticManagementEnabled: boolean;
}

// ─── Okta ─────────────────────────────────────────────────────────────────────

export interface OktaAppConfig {
  label: string;
  signOnMode: 'SAML_2_0' | 'OPENID_CONNECT' | 'BOOKMARK' | 'AUTO_LOGIN';
  credentials?: { scheme: string; userNameTemplate?: { template: string; type: string } };
  settings?: Record<string, unknown>;
}

export interface OktaMfaPolicy {
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  priorityOrder: number;
  conditions: { people?: Record<string, unknown>; apps?: { include: { type: string; id?: string }[] } };
  settings: { factors: Record<string, { enroll: { self: string } }> };
}
