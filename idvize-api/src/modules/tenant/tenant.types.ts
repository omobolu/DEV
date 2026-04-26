/**
 * Tenant — Multi-Tenant Data Model
 *
 * A Tenant represents one customer organisation using the IDVIZE IAM OS.
 * Every piece of data in the system (applications, users, builds, documents,
 * cost records, etc.) is scoped to a tenantId.
 */

export type TenantStatus = 'active' | 'suspended' | 'trial';
export type TenantPlan   = 'enterprise' | 'professional' | 'trial';

export interface Tenant {
  tenantId:   string;       // e.g. "ten-acme"
  name:       string;       // e.g. "ACME Financial Services"
  slug:       string;       // URL-safe, unique — e.g. "acme-financial"
  domain:     string;       // primary email domain — e.g. "acme.com"
  status:     TenantStatus;
  plan:       TenantPlan;
  adminUserId: string;      // userId of the tenant admin
  settings: {
    mfaRequired:             boolean;
    sessionTimeoutSeconds:   number;
    allowedAuthProviders:    string[];
    maxUsers:                number;
    maxApps:                 number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TenantSummary {
  tenantId:   string;
  name:       string;
  slug:       string;
  domain:     string;
  status:     TenantStatus;
  plan:       TenantPlan;
  userCount:  number;
  appCount:   number;
  createdAt:  string;
}
