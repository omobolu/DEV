// ─── Application Module Types ─────────────────────────────────────────────────

export type RiskTier = 'critical' | 'high' | 'medium' | 'low';
export type DataClassification = 'restricted' | 'confidential' | 'internal' | 'public';
export type AppStatus = 'active' | 'decommissioned' | 'under_review' | 'unknown';
export type IngestionSource = 'csv' | 'api' | 'manual' | 'cmdb';

export interface RawApplication {
  // Flexible input — field names vary by source
  [key: string]: string | number | boolean | undefined;
}

export interface Application {
  appId: string;                        // Assigned unique ID
  name: string;                         // Normalized name
  rawName: string;                      // Original name from source
  owner: string;
  ownerEmail: string;
  vendor: string;
  supportContact?: string;
  department: string;
  riskTier: RiskTier;
  dataClassification: DataClassification;
  userPopulation: number;
  appType: 'saas' | 'on-premise' | 'custom' | 'legacy' | 'cloud' | 'unknown';
  tags: string[];
  source: IngestionSource;
  status: AppStatus;
  createdAt: string;
  updatedAt: string;
  // Enrichment
  iamPosture?: IamPosture;
}

export interface IamPosture {
  appId: string;
  ssoEnabled: boolean;
  mfaEnforced: boolean;
  scimEnabled: boolean;
  jmlAutomated: boolean;
  privilegedAccountsVaulted: boolean;
  certificationsConfigured: boolean;
  platforms: IamPlatformLink[];
  riskScore: number;             // 0–100 (100 = highest risk)
  missingControls: string[];
  remediationPriority: 'immediate' | 'high' | 'medium' | 'low';
  evaluatedAt: string;
}

export interface IamPlatformLink {
  platform: 'IGA' | 'AM' | 'PAM' | 'CIAM';
  tool: 'SailPoint' | 'Entra' | 'CyberArk' | 'Okta' | 'None';
  onboarded: boolean;
  status: 'active' | 'partial' | 'not_onboarded' | 'decommissioned';
}

export interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  errors: ImportError[];
  apps: Application[];
}

export interface ImportError {
  row: number;
  rawName?: string;
  error: string;
}

export interface ApplicationQuery {
  riskTier?: RiskTier;
  department?: string;
  hasSso?: boolean;
  hasMfa?: boolean;
  missingControl?: string;
  search?: string;
  page?: number;
  limit?: number;
}
