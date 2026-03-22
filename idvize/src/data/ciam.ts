export const CIAM_KPIS = [
  { id: 'total-customers',  label: 'Total Customers',        value: '2.4M',  unit: '',  accentColor: '#22c55e' },
  { id: 'self-reg',         label: 'Self-Registration Rate', value: '67.2',  unit: '%', accentColor: '#4ade80' },
  { id: 'social-login',     label: 'Social Login Adoption',  value: '43.1',  unit: '%', accentColor: '#06b6d4' },
  { id: 'pwd-reset',        label: 'Password Reset Rate',    value: '8.7',   unit: '%', accentColor: '#f59e0b' },
]

export interface RegistrationTrendPoint {
  month: string
  newUsers: number
  cumulative: number
}

export const CIAM_REGISTRATION_DATA: RegistrationTrendPoint[] = [
  { month: 'Aug', newUsers: 42000,  cumulative: 1820000 },
  { month: 'Sep', newUsers: 58000,  cumulative: 1878000 },
  { month: 'Oct', newUsers: 71000,  cumulative: 1949000 },
  { month: 'Nov', newUsers: 65000,  cumulative: 2014000 },
  { month: 'Dec', newUsers: 88000,  cumulative: 2102000 },
  { month: 'Jan', newUsers: 112000, cumulative: 2214000 },
  { month: 'Feb', newUsers: 98000,  cumulative: 2312000 },
]

export const LOGIN_METHOD_DATA = [
  { name: 'Password',   value: 38, fill: '#22c55e' },
  { name: 'Google SSO', value: 27, fill: '#4ade80' },
  { name: 'Apple SSO',  value: 18, fill: '#86efac' },
  { name: 'OTP / SMS',  value: 12, fill: '#bbf7d0' },
  { name: 'Biometric',  value: 5,  fill: '#dcfce7' },
]

export interface CustomerJourneyPoint {
  stage: string
  count: number
}

export const CUSTOMER_JOURNEY_DATA: CustomerJourneyPoint[] = [
  { stage: 'Visited',    count: 5200000 },
  { stage: 'Registered', count: 2400000 },
  { stage: 'Verified',   count: 1980000 },
  { stage: 'Active',     count: 1450000 },
  { stage: 'Retained',   count: 980000  },
]

export const GEO_DISTRIBUTION_DATA = [
  { name: 'Americas', value: 38, fill: '#22c55e' },
  { name: 'EMEA',     value: 31, fill: '#4ade80' },
  { name: 'APAC',     value: 24, fill: '#86efac' },
  { name: 'Other',    value: 7,  fill: '#bbf7d0' },
]
