export const PAM_KPIS = [
  { id: 'priv-accounts', label: 'Privileged Accounts',       value: '1,247', unit: '',  accentColor: '#f59e0b' },
  { id: 'vaulted',       label: 'Vaulted Credentials',       value: '89.3',  unit: '%', accentColor: '#22c55e' },
  { id: 'sessions',      label: 'Active Privileged Sessions', value: '42',    unit: '',  accentColor: '#06b6d4' },
  { id: 'violations',    label: 'Policy Violations (30d)',    value: '7',     unit: '',  accentColor: '#ef4444' },
]

export const PAM_ACCOUNT_TYPES = [
  { name: 'Service Accounts',     value: 38, fill: '#f59e0b' },
  { name: 'Admin Accounts',       value: 29, fill: '#fbbf24' },
  { name: 'Emergency Accounts',   value: 18, fill: '#fcd34d' },
  { name: 'Application Accounts', value: 15, fill: '#fde68a' },
]

export interface SessionActivityPoint {
  week: string
  opened: number
  closed: number
  avgDurationMin: number
}

export const SESSION_ACTIVITY_DATA: SessionActivityPoint[] = [
  { week: 'W1', opened: 124, closed: 118, avgDurationMin: 28 },
  { week: 'W2', opened: 98,  closed: 102, avgDurationMin: 22 },
  { week: 'W3', opened: 145, closed: 139, avgDurationMin: 35 },
  { week: 'W4', opened: 112, closed: 108, avgDurationMin: 30 },
  { week: 'W5', opened: 137, closed: 131, avgDurationMin: 26 },
  { week: 'W6', opened: 158, closed: 152, avgDurationMin: 32 },
  { week: 'W7', opened: 103, closed: 99,  avgDurationMin: 24 },
  { week: 'W8', opened: 167, closed: 161, avgDurationMin: 38 },
]

export interface VaultCoveragePoint {
  app: string
  coverage: number
}

export const VAULT_COVERAGE_DATA: VaultCoveragePoint[] = [
  { app: 'AWS Console',  coverage: 96 },
  { app: 'Azure AD',     coverage: 94 },
  { app: 'Oracle DB',    coverage: 91 },
  { app: 'SQL Server',   coverage: 88 },
  { app: 'Linux Servers',coverage: 85 },
  { app: 'Network Devices',coverage: 79 },
  { app: 'Legacy ERP',   coverage: 68 },
]

export interface PolicyViolationPoint {
  type: string
  count: number
}

export const POLICY_VIOLATIONS_DATA: PolicyViolationPoint[] = [
  { type: 'Excessive Privilege', count: 14 },
  { type: 'Shared Account Use',  count: 11 },
  { type: 'No MFA',              count: 8  },
  { type: 'Session Timeout',     count: 5  },
  { type: 'Off-Hours Access',    count: 4  },
]
