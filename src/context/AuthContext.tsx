import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import {
  login as apiLogin,
  logout as apiLogout,
  getSession,
  setSessionId,
  clearSession,
} from '../api/client'
import type { ApiUser, ApiTenant } from '../api/client'

interface AuthState {
  user: ApiUser | null
  tenant: ApiTenant | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [tenant, setTenant] = useState<ApiTenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = !!user

  // Check existing session on mount
  useEffect(() => {
    const sessionId = sessionStorage.getItem('idvize_session_id')
    if (!sessionId) {
      setIsLoading(false)
      return
    }

    getSession()
      .then((data) => {
        setUser(data.user)
        setTenant(data.tenant)
      })
      .catch(() => {
        clearSession()
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setError(null)
    setIsLoading(true)
    try {
      const data = await apiLogin(username, password)
      setSessionId(data.sessionId)
      setUser(data.user)
      setTenant(data.tenant)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // ignore logout errors
    }
    setUser(null)
    setTenant(null)
    clearSession()
  }, [])

  return (
    <AuthContext.Provider value={{ user, tenant, isAuthenticated, isLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
