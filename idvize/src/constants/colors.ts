export const COLORS = {
  indigo: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'],
  cyan:   ['#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc'],
  amber:  ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'],
  green:  ['#22c55e', '#4ade80', '#86efac', '#bbf7d0'],
  red:    ['#ef4444', '#f87171', '#fca5a5', '#fecaca'],
  orange: ['#f97316', '#fb923c', '#fdba74', '#fed7aa'],
  purple: ['#a855f7', '#c084fc', '#d8b4fe', '#ede9fe'],
  teal:   ['#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'],
}

// Legacy exports (kept for backward compat — prefer getChartTheme)
export const CHART_GRID = '#334155'
export const CHART_AXIS  = '#64748b'
export const TOOLTIP_BG  = '#1e293b'
export const TOOLTIP_BORDER = '#475569'

// Theme-aware chart chrome — use with useTheme()
export function getChartTheme(theme: 'light' | 'dark') {
  return theme === 'dark'
    ? { grid: '#334155', axis: '#64748b', tooltipBg: '#1e293b', tooltipBorder: '#475569', text: '#94a3b8' }
    : { grid: '#e5e7eb', axis: '#9ca3af', tooltipBg: '#ffffff', tooltipBorder: '#e5e7eb', text: '#6b7280' }
}
