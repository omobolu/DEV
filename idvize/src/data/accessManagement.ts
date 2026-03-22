export const AM_KPIS = [
  { id: 'identity-base', label: 'Identity Base',      value: '670,234', unit: '',   accentColor: '#6366f1' },
  { id: 'mfa',           label: 'MFA Coverage',       value: '31.44',   unit: '%',  accentColor: '#a855f7' },
  { id: 'login-success', label: 'Login Success Rate', value: '96.01',   unit: '%',  accentColor: '#22c55e' },
  { id: 'login-time',    label: 'Avg Login Time',     value: '141.6',   unit: 'ms', accentColor: '#06b6d4' },
]

export interface RegistrationPoint {
  week: string
  registrations: number
  proofing: number
  successRate: number
}

export const REGISTRATION_DATA: RegistrationPoint[] = [
  { week: 'W1', registrations: 2400, proofing: 1800, successRate: 75 },
  { week: 'W2', registrations: 3200, proofing: 2600, successRate: 81 },
  { week: 'W3', registrations: 2800, proofing: 2100, successRate: 75 },
  { week: 'W4', registrations: 4100, proofing: 3500, successRate: 85 },
  { week: 'W5', registrations: 3700, proofing: 3100, successRate: 84 },
  { week: 'W6', registrations: 4500, proofing: 4000, successRate: 89 },
]

export interface LoginPerfPoint {
  app: string
  successRate: number
}

export const LOGIN_PERF_DATA: LoginPerfPoint[] = [
  { app: 'Office 365',  successRate: 99.1 },
  { app: 'Salesforce',  successRate: 98.2 },
  { app: 'Workday',     successRate: 97.5 },
  { app: 'ServiceNow',  successRate: 96.8 },
  { app: 'Jira',        successRate: 96.0 },
  { app: 'Confluence',  successRate: 95.7 },
  { app: 'SAP',         successRate: 94.3 },
]

export const APP_INTEGRATION_DATA = [
  { name: 'SAML 2.0',  value: 42, fill: '#06b6d4' },
  { name: 'OAuth 2.0', value: 31, fill: '#22d3ee' },
  { name: 'OIDC',      value: 18, fill: '#67e8f9' },
  { name: 'LDAP',      value: 9,  fill: '#a5f3fc' },
]

export interface LoginTimeTrendPoint {
  hour: string
  avgMs: number
}

export const LOGIN_TIME_DATA: LoginTimeTrendPoint[] = [
  { hour: '00:00', avgMs: 135 },
  { hour: '02:00', avgMs: 118 },
  { hour: '04:00', avgMs: 112 },
  { hour: '06:00', avgMs: 142 },
  { hour: '08:00', avgMs: 178 },
  { hour: '10:00', avgMs: 165 },
  { hour: '12:00', avgMs: 155 },
  { hour: '14:00', avgMs: 160 },
  { hour: '16:00', avgMs: 172 },
  { hour: '18:00', avgMs: 148 },
  { hour: '20:00', avgMs: 138 },
  { hour: '22:00', avgMs: 130 },
]
