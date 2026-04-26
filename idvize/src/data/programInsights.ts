export interface ProgramMaturityItem {
  id: string
  title: string
  totalCount: number
  color: string
  segments: { name: string; value: number; fill: string }[]
}

export const PROGRAM_MATURITY_DATA: ProgramMaturityItem[] = [
  {
    id: 'iga',
    title: 'Identity Governance & Administration',
    totalCount: 1247,
    color: '#2563eb',
    segments: [
      { name: 'Access Request', value: 38, fill: '#2563eb' },
      { name: 'Account Mgmt',   value: 27, fill: '#818cf8' },
      { name: 'Role Mgmt',      value: 20, fill: '#a5b4fc' },
      { name: 'Compliance',     value: 15, fill: '#c7d2fe' },
    ],
  },
  {
    id: 'am',
    title: 'Access Management',
    totalCount: 892,
    color: '#06b6d4',
    segments: [
      { name: 'SSO',           value: 45, fill: '#06b6d4' },
      { name: '2FA',           value: 30, fill: '#22d3ee' },
      { name: 'Federation',    value: 15, fill: '#67e8f9' },
      { name: 'Adaptive Auth', value: 10, fill: '#a5f3fc' },
    ],
  },
  {
    id: 'pam',
    title: 'Privileged Access Management',
    totalCount: 534,
    color: '#f59e0b',
    segments: [
      { name: 'Vaulting',      value: 40, fill: '#f59e0b' },
      { name: 'Session Mgmt',  value: 30, fill: '#fbbf24' },
      { name: 'Just-in-Time',  value: 20, fill: '#fcd34d' },
      { name: 'Audit Trail',   value: 10, fill: '#fde68a' },
    ],
  },
]
