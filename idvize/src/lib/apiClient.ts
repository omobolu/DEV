/**
 * Shared API client for idvize frontend.
 * Automatically handles 401 (token expired) by clearing localStorage and
 * redirecting to the login screen — no more "Token invalid or expired" dead ends.
 */

export const API_BASE = 'http://localhost:3001'
export const API_KEY  = 'idvize-dev-key-change-me'

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
    // Token expired or invalid — clear session and force re-login
    localStorage.removeItem('idvize_token')
    localStorage.removeItem('idvize_user')
    window.location.href = '/'
    // Return the response anyway so callers don't throw
  }

  return res
}
