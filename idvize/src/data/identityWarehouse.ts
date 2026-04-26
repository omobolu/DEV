export const IGA_KPIS = [
  { id: 'orphan',     label: 'Orphan Accounts',                   value: '34',   unit: '%', accentColor: '#ef4444' },
  { id: 'sod',        label: 'SOD Coverage',                      value: '23',   unit: '%', accentColor: '#f97316' },
  { id: 'apps',       label: 'Applications Coverage',             value: '57.3', unit: '%', accentColor: '#2563eb' },
  { id: 'terminated', label: 'Terminated Users w/ Active Access', value: '79',   unit: '%', accentColor: '#ef4444' },
]

export const ACTIVE_IDENTITIES_DATA = [
  { name: 'Americas', value: 142300, fill: '#2563eb' },
  { name: 'EMEA',     value: 98700,  fill: '#818cf8' },
  { name: 'APAC',     value: 76500,  fill: '#a5b4fc' },
  { name: 'Other',    value: 21000,  fill: '#c7d2fe' },
]

export const APP_TYPE_DATA = [
  { name: 'SaaS',       value: 45, fill: '#06b6d4' },
  { name: 'On-Premise', value: 30, fill: '#22d3ee' },
  { name: 'Hybrid',     value: 15, fill: '#67e8f9' },
  { name: 'Legacy',     value: 10, fill: '#a5f3fc' },
]

export const APPS_PORTFOLIO_DATA = [
  { name: 'HR',       value: 28, fill: '#2563eb' },
  { name: 'Finance',  value: 22, fill: '#818cf8' },
  { name: 'IT Ops',   value: 19, fill: '#a5b4fc' },
  { name: 'Sales',    value: 16, fill: '#c7d2fe' },
  { name: 'Other',    value: 15, fill: '#e0e7ff' },
]

export const ORPHAN_PIE_DATA = [
  { name: 'Active Orphans',  value: 34, fill: '#ef4444' },
  { name: 'Pending Review',  value: 28, fill: '#f97316' },
  { name: 'Remediated',      value: 38, fill: '#22c55e' },
]

export interface HireTrendPoint {
  month: string
  hired: number
  terminated: number
  netChange: number
}

export const HIRE_TREND_DATA: HireTrendPoint[] = [
  { month: 'Jul', hired: 120, terminated: 45,  netChange: 75  },
  { month: 'Aug', hired: 95,  terminated: 38,  netChange: 57  },
  { month: 'Sep', hired: 140, terminated: 52,  netChange: 88  },
  { month: 'Oct', hired: 110, terminated: 60,  netChange: 50  },
  { month: 'Nov', hired: 85,  terminated: 40,  netChange: 45  },
  { month: 'Dec', hired: 70,  terminated: 35,  netChange: 35  },
  { month: 'Jan', hired: 155, terminated: 48,  netChange: 107 },
]
