import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import SessionExpiredBanner from '@/components/SessionExpiredBanner'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import Dashboard from '@/pages/Dashboard'
import ProgramInsights from '@/pages/insights/ProgramInsights'
import IdentityWarehouse from '@/pages/iga/IdentityWarehouse'
import AccessManagement from '@/pages/access/AccessManagement'
import PAMDashboard from '@/pages/pam/PAMDashboard'
import CIAMDashboard from '@/pages/ciam/CIAMDashboard'
import AppOnboarding from '@/pages/applications/AppOnboarding'
import AppManagement from '@/pages/applications/AppManagement'
import OrphanAccounts from '@/pages/applications/OrphanAccounts'
import CMDBPage from '@/pages/cmdb/CMDBPage'
import AppDetailPage from '@/features/cmdb/pages/AppDetailPage'
import StubPage from '@/pages/stubs/StubPage'
import DocumentsPage from '@/pages/documents/DocumentsPage'
import IntegrationsPage from '@/pages/integrations/IntegrationsPage'
import MaturityPage from '@/pages/maturity/MaturityPage'
import MaturityDomainDetail from '@/pages/maturity/MaturityDomainDetail'
import OSControlPanel from '@/pages/os/OSControlPanel'
import TopRisks from '@/pages/os/TopRisks'
import ControlDetailView from '@/pages/os/ControlDetailView'
import ControlsLibrary from '@/pages/controls/ControlsLibrary'
import ValueDashboard  from '@/pages/value/ValueDashboard'
import SystemEventsPage from '@/pages/os/SystemEventsPage'
import EmailSettings from '@/pages/settings/EmailSettings'
import { CMDBProvider } from '@/context/CMDBContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { SESSION_EXPIRED_EVENT } from '@/lib/apiClient'

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('idvize_token'))
  const [sessionExpired, setSessionExpired] = useState(false)

  const handleLogin = useCallback((newToken: string, name: string, tenantName: string) => {
    localStorage.setItem('idvize_token', newToken)
    localStorage.setItem('idvize_user', name)
    localStorage.setItem('idvize_tenant', tenantName)
    setToken(newToken)
    setSessionExpired(false)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('idvize_token')
    localStorage.removeItem('idvize_user')
    localStorage.removeItem('idvize_tenant')
    setToken(null)
    setSessionExpired(false)
  }, [])

  // Listen for session expiry events from apiClient
  useEffect(() => {
    const handler = () => {
      setSessionExpired(true)
      setToken(null)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handler)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler)
  }, [])

  if (!token) {
    return (
      <ThemeProvider>
        <ErrorBoundary>
          {sessionExpired && (
            <SessionExpiredBanner onLogin={() => setSessionExpired(false)} />
          )}
          <LoginPage onLogin={(t, n, tn) => handleLogin(t, n, tn)} />
        </ErrorBoundary>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <CMDBProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout onLogout={handleLogout} />}>
              <Route index element={<Navigate to="/os" replace />} />
              <Route path="os" element={<OSControlPanel />} />
              <Route path="risks" element={<TopRisks />} />
              <Route path="risks/:appId/controls" element={<ControlDetailView />} />
              <Route path="controls/library" element={<ControlsLibrary />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="insights/program-maturity" element={<ProgramInsights />} />
              <Route path="iga/*" element={<IdentityWarehouse />} />
              <Route path="access-management" element={<AccessManagement />} />
              <Route path="access-management/partners" element={<AccessManagement audience="partners" />} />
              <Route path="pam" element={<PAMDashboard />} />
              <Route path="ciam/*" element={<CIAMDashboard />} />
              <Route path="applications/onboarding" element={<AppOnboarding />} />
              <Route path="applications/management" element={<AppManagement />} />
              <Route path="applications/orphan-accounts" element={<OrphanAccounts />} />
              <Route path="cmdb">
                <Route index element={<CMDBPage />} />
                <Route path=":appId" element={<AppDetailPage />} />
              </Route>
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="maturity" element={<MaturityPage />} />
              <Route path="maturity/domains/:domainId" element={<MaturityDomainDetail />} />
              <Route path="value" element={<ValueDashboard />} />
              <Route path="system-events" element={<SystemEventsPage />} />
              <Route path="settings/email" element={<EmailSettings />} />
              <Route path="my-account" element={<StubPage title="My Account" />} />
              <Route path="users" element={<StubPage title="Users" />} />
              <Route path="admin" element={<StubPage title="Admin" />} />
              <Route path="setup" element={<StubPage title="Setup" />} />
              <Route path="security" element={<StubPage title="Security" />} />
              <Route path="*" element={<Navigate to="/os" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </CMDBProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
