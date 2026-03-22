export interface KpiData {
  id: string
  label: string
  value: string | number
  unit?: string
  trend?: number
  accentColor?: string
}
