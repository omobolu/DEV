// ─── IAM Domain Types ───────────────────────────────────────────────────────

export type IamDomain = 'IGA' | 'AM' | 'PAM' | 'CIAM';

export type CapabilityProtocol = 'OIDC' | 'SAML' | 'SCIM' | 'REST' | 'LDAP' | 'RADIUS';

export type GapSeverity = 'critical' | 'high' | 'medium' | 'low';

export type ConnectorStatus = 'connected' | 'disconnected' | 'error' | 'not_configured';

// ─── Application ─────────────────────────────────────────────────────────────

export interface Application {
  id: string;
  name: string;
  owner: string;
  ownerEmail: string;
  department: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  userCount: number;
  source: string; // CMDB source
  iamCoverage: Partial<Record<IamDomain, boolean>>;
  capabilities: CapabilityProtocol[];
  lastReviewed?: string;
  tags?: string[];
}

// ─── Gap Detection ────────────────────────────────────────────────────────────

export interface IamGap {
  id: string;
  appId: string;
  appName: string;
  domain: IamDomain;
  severity: GapSeverity;
  description: string;
  recommendation: string;
  detectedAt: string;
  status: 'open' | 'in_remediation' | 'resolved';
}

export interface GapSummary {
  totalGaps: number;
  bySeverity: Record<GapSeverity, number>;
  byDomain: Record<IamDomain, number>;
  gaps: IamGap[];
}

// ─── Capabilities ─────────────────────────────────────────────────────────────

export interface AppCapability {
  appId: string;
  appName: string;
  detectedProtocols: CapabilityProtocol[];
  oidcMetadataUrl?: string;
  samlMetadataUrl?: string;
  scimEndpoint?: string;
  apiEndpoint?: string;
  detectionMethod: 'manual' | 'autodiscovery' | 'cmdb';
  confidence: number; // 0–100
  lastScanned: string;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export type ConnectorType = 'entra' | 'sailpoint' | 'cyberark';

export interface ConnectorHealth {
  connector: ConnectorType;
  status: ConnectorStatus;
  lastChecked: string;
  message?: string;
  version?: string;
}

export interface ConnectorConfig {
  type: ConnectorType;
  baseUrl?: string;
  clientId?: string;
  tenantId?: string;
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export type OrchestrationAction =
  | 'detect_gaps'
  | 'discover_capabilities'
  | 'push_entra_config'
  | 'generate_sailpoint_rule'
  | 'onboard_cyberark_account'
  | 'notify_app_owner'
  | 'log_decision';

export interface OrchestrationRequest {
  intent: string;           // Natural language intent
  appId?: string;
  domain?: IamDomain;
  dryRun?: boolean;
}

export interface OrchestrationResult {
  requestId: string;
  intent: string;
  actions: ActionResult[];
  summary: string;
  timestamp: string;
}

export interface ActionResult {
  action: OrchestrationAction;
  status: 'success' | 'failed' | 'skipped' | 'pending';
  payload?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
