const API_BASE = import.meta.env.VITE_API_URL || ''

function getSessionId(): string | null {
  return sessionStorage.getItem('idvize_session_id')
}

export function setSessionId(sessionId: string): void {
  sessionStorage.setItem('idvize_session_id', sessionId)
}

export function clearSession(): void {
  sessionStorage.removeItem('idvize_session_id')
  sessionStorage.removeItem('idvize_user')
  sessionStorage.removeItem('idvize_tenant')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const sessionId = getSessionId()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (sessionId) {
    headers['x-session-id'] = sessionId
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    clearSession()
    throw new Error('Session expired')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }

  return res.json()
}

// --- Auth ---
export interface LoginResponse {
  sessionId: string
  user: ApiUser
  tenant: ApiTenant
  expiresAt: string
}

export interface ApiUser {
  id: string
  username: string
  displayName: string
  email: string
  role: string
  department: string
  title: string
}

export interface ApiTenant {
  id: string
  name: string
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' })
  clearSession()
}

export async function getSession(): Promise<{ user: ApiUser; tenant: ApiTenant }> {
  return request('/api/auth/session')
}

// --- Dashboard ---
export interface DashboardData {
  totalApplications: number
  totalControls: number
  controlsByStatus: Record<string, number>
  assessmentsByStatus: Record<string, number>
  totalRiskFindings: number
  openRiskFindings: number
  risksBySeverity: Record<string, number>
  metrics: Record<string, Record<string, unknown>>
}

export async function getDashboard(): Promise<DashboardData> {
  return request('/api/dashboard')
}

// --- Applications ---
export interface ApiApplication {
  id: string
  name: string
  criticality: string
  description: string | null
  owner: string | null
  business_unit: string | null
  auth_method: string | null
  data_classification: string | null
  sox_applicable: boolean
  created_at: string
}

export async function getApplications(): Promise<ApiApplication[]> {
  return request('/api/applications')
}

export async function deleteApplication(id: string): Promise<void> {
  await request(`/api/applications/${id}`, { method: 'DELETE' })
}

// --- Controls ---
export interface ApiControl {
  id: string
  application_id: string
  control_type: string
  status: string
  details: string | null
  created_at: string
  application_name: string
}

export async function getControls(): Promise<ApiControl[]> {
  return request('/api/controls')
}

export async function deleteControl(id: string): Promise<void> {
  await request(`/api/controls/${id}`, { method: 'DELETE' })
}

// --- Assessments ---
export interface ApiAssessment {
  id: string
  application_id: string
  control_type: string
  status: string
  assessed_by: string | null
  assessed_at: string
  notes: string | null
  created_at: string
  application_name: string
}

export async function getAssessments(): Promise<ApiAssessment[]> {
  return request('/api/assessments')
}

export async function deleteAssessment(id: string): Promise<void> {
  await request(`/api/assessments/${id}`, { method: 'DELETE' })
}

// --- Risks ---
export interface ApiRisk {
  id: string
  application_id: string | null
  category: string
  description: string
  severity: string
  status: string
  created_at: string
  resolved_at: string | null
  application_name: string | null
}

export async function getRisks(): Promise<ApiRisk[]> {
  return request('/api/risks')
}

export async function deleteRisk(id: string): Promise<void> {
  await request(`/api/risks/${id}`, { method: 'DELETE' })
}
