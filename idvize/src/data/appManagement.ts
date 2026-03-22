export const ORPHAN_DONUT_DATA = [
  { name: 'Active Orphans', value: 34, fill: '#ef4444' },
  { name: 'Pending Review', value: 28, fill: '#f97316' },
  { name: 'Remediated',     value: 38, fill: '#22c55e' },
]

export interface LoginFailurePoint {
  month: string
  failures: number
  resolved: number
}

export const LOGIN_FAILURE_DATA: LoginFailurePoint[] = [
  { month: 'Aug', failures: 1240, resolved: 980  },
  { month: 'Sep', failures: 1480, resolved: 1100 },
  { month: 'Oct', failures: 1120, resolved: 1050 },
  { month: 'Nov', failures: 980,  resolved: 960  },
  { month: 'Dec', failures: 1650, resolved: 1200 },
  { month: 'Jan', failures: 1380, resolved: 1300 },
]

export interface TerminatedPoint {
  week: string
  count: number
}

export const TERMINATED_TREND_DATA: TerminatedPoint[] = [
  { week: 'W1', count: 45 },
  { week: 'W2', count: 62 },
  { week: 'W3', count: 38 },
  { week: 'W4', count: 71 },
  { week: 'W5', count: 55 },
  { week: 'W6', count: 48 },
  { week: 'W7', count: 83 },
  { week: 'W8', count: 67 },
]

export interface CompletionRatePoint {
  month: string
  rate: number
}

export const COMPLETION_RATE_DATA: CompletionRatePoint[] = [
  { month: 'Aug', rate: 87 },
  { month: 'Sep', rate: 91 },
  { month: 'Oct', rate: 84 },
  { month: 'Nov', rate: 95 },
  { month: 'Dec', rate: 78 },
  { month: 'Jan', rate: 93 },
]
