import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import ControlsLibrary from '@/pages/controls/ControlsLibrary'
import { CMDBProvider } from '@/context/CMDBContext'

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('idvize_token'))

  const handleLogin = (newToken: string, name: string) => {
    localStorage.setItem('idvize_token', newToken)
    localStorage.setItem('idvize_user', name)
    setToken(newToken)
  }

  const handleLogout = () => {
    localStorage.removeItem('idvize_token')
    localStorage.removeItem('idvize_user')
    setToken(null)
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <CMDBProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout onLogout={handleLogout} />}>
            <Route index element={<Navigate to="/os" replace />} />
            <Route path="os" element={<OSControlPanel />} />
            <Route path="controls/library" element={<ControlsLibrary />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="insights/program-maturity" element={<ProgramInsights />} />
            <Route path="iga/*" element={<IdentityWarehouse />} />
            <Route path="access-management" element={<AccessManagement />} />
            <Route path="pam" element={<PAMDashboard />} />
            <Route path="ciam" element={<CIAMDashboard />} />
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
  )
}
