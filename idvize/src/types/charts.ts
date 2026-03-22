export interface PieSegment {
  name: string
  value: number
  fill: string
}

export interface GaugeSegment {
  name: string
  value: number
  fill: string
}

export interface BarPoint {
  name: string
  value: number
  fill?: string
}
