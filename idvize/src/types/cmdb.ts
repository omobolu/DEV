export type AppType = 'SaaS' | 'On-Premise' | 'Hybrid' | 'Legacy'
export type Criticality = 'Critical' | 'High' | 'Medium' | 'Low'
export type DataClassification = 'Confidential' | 'Internal' | 'Public'
export type ProvisioningType = 'Manual' | 'Semi-Automated' | 'Automated'
export type ReviewFrequency = 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual'
export type OnboardingStatus = 'Onboarded' | 'In Progress' | 'Planned' | 'Not Started'

export interface CMDBApp {
  appId: string
  appName: string
  department: string
  appType: AppType
  businessCriticality: Criticality
  dataClassification: DataClassification
  businessOwner: string
  itOwner: string
  // IAM Controls
  ssoEnabled: boolean
  mfaRequired: boolean
  provisioningType: ProvisioningType
  deprovisioningType: ProvisioningType
  accessReviewFrequency: ReviewFrequency
  pamVaulted: boolean
  rbacEnabled: boolean
  jitAccess: boolean
  sodPoliciesDefined: boolean
  complianceFrameworks: string
  // Metrics
  totalAccounts: number
  activeAccounts: number
  orphanAccounts: number
  lastAccessReviewDate: string
  nextAccessReviewDate: string
  onboardingStatus: OnboardingStatus
}

export type CMDBFieldKey = keyof CMDBApp

export interface CMDBFieldDefinition {
  key: CMDBFieldKey
  label: string
  type: 'string' | 'boolean' | 'number' | 'enum'
}

export const CMDB_FIELD_DEFINITIONS: CMDBFieldDefinition[] = [
  { key: 'appId',                label: 'App ID',                       type: 'string'  },
  { key: 'appName',              label: 'Application Name',             type: 'string'  },
  { key: 'department',           label: 'Department',                   type: 'string'  },
  { key: 'appType',              label: 'Application Type',             type: 'enum'    },
  { key: 'businessCriticality',  label: 'Business Criticality',         type: 'enum'    },
  { key: 'dataClassification',   label: 'Data Classification',          type: 'enum'    },
  { key: 'businessOwner',        label: 'Business Owner',               type: 'string'  },
  { key: 'itOwner',              label: 'IT Owner',                     type: 'string'  },
  { key: 'ssoEnabled',           label: 'SSO Enabled',                  type: 'boolean' },
  { key: 'mfaRequired',          label: 'MFA Required',                 type: 'boolean' },
  { key: 'provisioningType',     label: 'Provisioning Type',            type: 'enum'    },
  { key: 'deprovisioningType',   label: 'Deprovisioning Type',          type: 'enum'    },
  { key: 'accessReviewFrequency',label: 'Access Review Frequency',      type: 'enum'    },
  { key: 'pamVaulted',           label: 'PAM Vaulted',                  type: 'boolean' },
  { key: 'rbacEnabled',          label: 'RBAC Enabled',                 type: 'boolean' },
  { key: 'jitAccess',            label: 'JIT Access',                   type: 'boolean' },
  { key: 'sodPoliciesDefined',   label: 'SoD Policies Defined',         type: 'boolean' },
  { key: 'complianceFrameworks', label: 'Compliance Frameworks',        type: 'string'  },
  { key: 'totalAccounts',        label: 'Total Accounts',               type: 'number'  },
  { key: 'activeAccounts',       label: 'Active Accounts',              type: 'number'  },
  { key: 'orphanAccounts',       label: 'Orphan Accounts',              type: 'number'  },
  { key: 'lastAccessReviewDate', label: 'Last Access Review Date',      type: 'string'  },
  { key: 'nextAccessReviewDate', label: 'Next Access Review Date',      type: 'string'  },
  { key: 'onboardingStatus',     label: 'Onboarding Status',            type: 'enum'    },
]

// Auto-suggest mapping: normalised source header -> internal field key
export const CMDB_HEADER_ALIASES: Record<string, CMDBFieldKey> = {
  'appid': 'appId', 'applicationid': 'appId', 'id': 'appId', 'app_id': 'appId',
  'appname': 'appName', 'applicationname': 'appName', 'app': 'appName', 'name': 'appName', 'application': 'appName',
  'department': 'department', 'dept': 'department', 'businessunit': 'department', 'bu': 'department',
  'apptype': 'appType', 'applicationtype': 'appType', 'type': 'appType', 'deploymenttype': 'appType',
  'businesscriticality': 'businessCriticality', 'criticality': 'businessCriticality', 'priority': 'businessCriticality',
  'dataclassification': 'dataClassification', 'classification': 'dataClassification', 'datalevel': 'dataClassification',
  'businessowner': 'businessOwner', 'owner': 'businessOwner', 'appowner': 'businessOwner',
  'itowner': 'itOwner', 'technicalowner': 'itOwner', 'sysadmin': 'itOwner',
  'ssoenabled': 'ssoEnabled', 'sso': 'ssoEnabled', 'singlesignon': 'ssoEnabled',
  'mfarequired': 'mfaRequired', 'mfa': 'mfaRequired', 'multifactor': 'mfaRequired',
  'provisioningtype': 'provisioningType', 'provisioning': 'provisioningType',
  'deprovisioningtype': 'deprovisioningType', 'deprovisioning': 'deprovisioningType',
  'accessreviewfrequency': 'accessReviewFrequency', 'reviewfrequency': 'accessReviewFrequency', 'reviewcycle': 'accessReviewFrequency',
  'pamvaulted': 'pamVaulted', 'pam': 'pamVaulted', 'vaulted': 'pamVaulted',
  'rbacenabled': 'rbacEnabled', 'rbac': 'rbacEnabled', 'rolebased': 'rbacEnabled',
  'jitaccess': 'jitAccess', 'jit': 'jitAccess', 'justintime': 'jitAccess',
  'sodpoliciesdefined': 'sodPoliciesDefined', 'sod': 'sodPoliciesDefined', 'segregationofduties': 'sodPoliciesDefined',
  'complianceframeworks': 'complianceFrameworks', 'compliance': 'complianceFrameworks', 'frameworks': 'complianceFrameworks',
  'totalaccounts': 'totalAccounts', 'total': 'totalAccounts', 'accountcount': 'totalAccounts',
  'activeaccounts': 'activeAccounts', 'active': 'activeAccounts',
  'orphanaccounts': 'orphanAccounts', 'orphans': 'orphanAccounts',
  'lastaccessreviewdate': 'lastAccessReviewDate', 'lastreview': 'lastAccessReviewDate',
  'nextaccessreviewdate': 'nextAccessReviewDate', 'nextreview': 'nextAccessReviewDate',
  'onboardingstatus': 'onboardingStatus', 'status': 'onboardingStatus', 'onboarded': 'onboardingStatus',
}

export interface FieldMapping {
  sourceHeader: string
  targetField: CMDBFieldKey | null   // null = ignore
}

export interface APIConnectionConfig {
  url: string
  method: 'GET' | 'POST'
  authType: 'none' | 'bearer' | 'apiKey' | 'basic'
  bearerToken: string
  apiKeyHeader: string
  apiKeyValue: string
  basicUser: string
  basicPassword: string
  customHeaders: { id: string; key: string; value: string }[]
  jsonPath: string
}

export const DEFAULT_API_CONFIG: APIConnectionConfig = {
  url: '', method: 'GET', authType: 'none',
  bearerToken: '', apiKeyHeader: 'X-API-Key', apiKeyValue: '',
  basicUser: '', basicPassword: '',
  customHeaders: [], jsonPath: '',
}

export interface ImportMeta {
  source: 'csv' | 'api' | 'mock'
  timestamp: string
  count: number
  fileName?: string
}
