/**
 * Shared API client for idvize frontend.
 *
 * Features:
 * - Automatic auth header injection
 * - 401 detection with error code distinction (TOKEN_EXPIRED vs TOKEN_INVALID)
 * - Session expiry event dispatch for UI notification
 * - Request correlation ID forwarding
 */

export const API_BASE = 'http://localhost:3001'
export const API_KEY  = 'idvize-dev-key-change-me'

/** Error codes returned by the backend */
export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

export interface ApiErrorResponse {
  success: false
  error: string
  code: ApiErrorCode
  details?: Record<string, unknown>
  requestId?: string
  timestamp: string
}

/** Dispatched when a 401 is received — App.tsx listens for this */
export const SESSION_EXPIRED_EVENT = 'idvize:session-expired'

function dispatchSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('idvize_token') ?? ''
  return {
    'Content-Type':  'application/json',
    'x-api-key':     API_KEY,
    'Authorization': `Bearer ${token}`,
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init?.headers ?? {}) },
  })

  if (res.status === 401) {
    // Only treat as session expiry if user was previously authenticated.
    // Pre-login 401s (e.g. wrong credentials) should pass through normally.
    const hadToken = !!localStorage.getItem('idvize_token')
    if (hadToken) {
      try {
        const body = await res.clone().json()
        if (body.code === 'TOKEN_EXPIRED' || body.code === 'TOKEN_INVALID' || body.code === 'AUTH_REQUIRED') {
          localStorage.removeItem('idvize_token')
          localStorage.removeItem('idvize_user')
          localStorage.removeItem('idvize_tenant')
          dispatchSessionExpired()
        }
      } catch {
        localStorage.removeItem('idvize_token')
        localStorage.removeItem('idvize_user')
        localStorage.removeItem('idvize_tenant')
        dispatchSessionExpired()
      }
    }
  }

  return res
}

/**
 * Convenience helper to parse a standard API response.
 * Throws on non-success responses with the error message.
 */
export async function apiJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init)
  const json = await res.json()
  if (!json.success) {
    const err = new Error(json.error ?? 'Request failed')
    ;(err as any).code = json.code
    ;(err as any).details = json.details
    throw err
  }
  return json.data as T
}
