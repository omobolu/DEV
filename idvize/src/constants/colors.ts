export const COLORS = {
  /* Enterprise security palette — navy/blue primary, status-driven accents.
     Purple is neutralized to slate (subtle accent only). */
  indigo: ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd'], // navy → blue scale
  cyan:   ['#0891b2', '#06b6d4', '#22d3ee', '#67e8f9'],
  amber:  ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d'], // ATTN
  green:  ['#16a34a', '#22c55e', '#4ade80', '#86efac'], // OK
  red:    ['#dc2626', '#ef4444', '#f87171', '#fca5a5'], // GAP
  orange: ['#ea580c', '#f97316', '#fb923c', '#fdba74'],
  purple: ['#475569', '#64748b', '#94a3b8', '#cbd5e1'], // neutralized → slate
  teal:   ['#0f766e', '#14b8a6', '#2dd4bf', '#5eead4'],
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
