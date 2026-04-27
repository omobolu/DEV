export const ONBOARDING_KPIS = [
  { id: 'onboarded', label: 'Apps Onboarded',     value: 40,       unit: '',       accentColor: '#6366f1' },
  { id: 'promoted',  label: 'Apps Promoted',       value: 28,       unit: '',       accentColor: '#22c55e' },
  { id: 'high-pri',  label: 'High Priority Apps',  value: 106,      unit: '',       accentColor: '#ef4444' },
  { id: 'avg-time',  label: 'Avg Onboarding Time', value: '15 days', unit: '',      accentColor: '#f59e0b' },
]

export const APP_PRIORITY_DATA = [
  { name: 'Critical', value: 22, fill: '#ef4444' },
  { name: 'High',     value: 41, fill: '#f97316' },
  { name: 'Medium',   value: 28, fill: '#eab308' },
  { name: 'Low',      value: 15, fill: '#22c55e' },
]

export interface QuarterlyStatusPoint {
  quarter: string
  planning: number
  inProgress: number
  completed: number
  onHold: number
}

export const QUARTERLY_STATUS_DATA: QuarterlyStatusPoint[] = [
  { quarter: 'Q1 2024', planning: 12, inProgress: 8,  completed: 15, onHold: 3 },
  { quarter: 'Q2 2024', planning: 9,  inProgress: 14, completed: 22, onHold: 2 },
  { quarter: 'Q3 2024', planning: 15, inProgress: 11, completed: 18, onHold: 5 },
  { quarter: 'Q4 2024', planning: 8,  inProgress: 16, completed: 28, onHold: 1 },
]
