import pool from './pool.js'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

async function seed() {
  console.log('[SEED] Seeding database with demo data...')

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Clear existing data (in reverse FK order)
    await client.query('DELETE FROM audit_logs')
    await client.query('DELETE FROM sessions')
    await client.query('DELETE FROM dashboard_metrics')
    await client.query('DELETE FROM risk_findings')
    await client.query('DELETE FROM control_assessments')
    await client.query('DELETE FROM iam_controls')
    await client.query('DELETE FROM applications')
    await client.query('DELETE FROM users')
    await client.query('DELETE FROM tenants')

    // --- Tenant ---
    await client.query(`
      INSERT INTO tenants (id, name) VALUES
        ('tenant-001', 'IDVize Demo Corp')
    `)

    // --- Users (passwords are bcrypt-hashed) ---
    const seedUsers = [
      { id: 'user-admin-001',     username: 'admin',     password: 'admin123',   displayName: 'Platform Admin',  email: 'admin@idvize.com',           role: 'admin',     dept: 'IT',               title: 'Platform Administrator' },
      { id: 'user-architect-001', username: 'jarchitect',password: 'arch123',    displayName: 'James Architect', email: 'james.architect@idvize.com', role: 'architect', dept: 'IAM Architecture', title: 'Senior IAM Architect' },
      { id: 'user-analyst-001',   username: 'lanalyst',  password: 'analyst123', displayName: 'Lisa Analyst',    email: 'lisa.analyst@idvize.com',    role: 'analyst',   dept: 'IAM Operations',   title: 'IAM Business Analyst' },
      { id: 'user-manager-001',   username: 'smanager',  password: 'manager123', displayName: 'Sarah Manager',   email: 'sarah.manager@idvize.com',   role: 'manager',   dept: 'IAM Operations',   title: 'IAM Program Manager' },
      { id: 'user-engineer-001',  username: 'mengineer', password: 'eng123',     displayName: 'Mike Engineer',   email: 'mike.engineer@idvize.com',   role: 'engineer',  dept: 'IAM Engineering',  title: 'IAM Engineer' },
      { id: 'user-developer-001', username: 'adev',      password: 'dev123',     displayName: 'Alex Developer',  email: 'alex.developer@idvize.com',  role: 'developer', dept: 'IAM Development',  title: 'IAM Developer' },
    ]

    for (const u of seedUsers) {
      const hashed = await hashPassword(u.password)
      await client.query(
        `INSERT INTO users (id, username, password, display_name, email, role, department, title, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'tenant-001')`,
        [u.id, u.username, hashed, u.displayName, u.email, u.role, u.dept, u.title]
      )
    }

    // --- Applications (from CMDB demo data) ---
    const apps = [
      { id: 'app-1000', name: 'ServiceNow',       criticality: 'medium', owner: 'Lisa Wilson',     dept: 'Finance',  auth: 'OAuth 2.0/OIDC', dc: 'Confidential', sox: true },
      { id: 'app-1001', name: 'Salesforce',        criticality: 'medium', owner: 'Rachel Brown',    dept: 'Legal',    auth: 'OAuth 2.0/OIDC', dc: 'Restricted',   sox: false },
      { id: 'app-1002', name: 'SAP S4 HANA',       criticality: 'medium', owner: 'Emma Smith',      dept: 'Finance',  auth: 'Local Auth',     dc: 'Restricted',   sox: true },
      { id: 'app-1003', name: 'Workday',           criticality: 'high',   owner: 'Sarah Williams',  dept: 'R&D',      auth: 'Kerberos',       dc: 'Internal',     sox: true },
      { id: 'app-1004', name: 'Oracle EBS',        criticality: 'medium', owner: 'Mike Moore',      dept: 'R&D',      auth: 'MFA + SSO',      dc: 'Restricted',   sox: false },
      { id: 'app-1005', name: 'Microsoft 365',     criticality: 'medium', owner: 'David Moore',     dept: 'Security', auth: 'Local Auth',     dc: 'Internal',     sox: false },
      { id: 'app-1006', name: 'Okta',              criticality: 'critical',owner: 'Rachel Brown',   dept: 'IT',       auth: 'OAuth 2.0/OIDC', dc: 'Confidential', sox: true },
      { id: 'app-1007', name: 'CyberArk',          criticality: 'critical',owner: 'David Moore',    dept: 'Security', auth: 'MFA + SSO',      dc: 'Restricted',   sox: true },
      { id: 'app-1008', name: 'SailPoint',         criticality: 'high',   owner: 'Lisa Wilson',     dept: 'IT',       auth: 'OAuth 2.0/OIDC', dc: 'Confidential', sox: true },
      { id: 'app-1009', name: 'Splunk',            criticality: 'high',   owner: 'Pat Harris',      dept: 'Security', auth: 'SAML',           dc: 'Internal',     sox: false },
      { id: 'app-1010', name: 'Jira',              criticality: 'medium', owner: 'Sam Garcia',      dept: 'R&D',      auth: 'OAuth 2.0/OIDC', dc: 'Internal',     sox: false },
      { id: 'app-1011', name: 'Confluence',        criticality: 'low',    owner: 'Sam Garcia',      dept: 'R&D',      auth: 'OAuth 2.0/OIDC', dc: 'Internal',     sox: false },
      { id: 'app-1012', name: 'GitHub Enterprise', criticality: 'high',   owner: 'Jordan Anderson', dept: 'Engineering', auth: 'SAML',        dc: 'Confidential', sox: false },
    ]

    for (const app of apps) {
      await client.query(
        `INSERT INTO applications (id, name, criticality, owner, business_unit, auth_method, data_classification, sox_applicable, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'tenant-001')`,
        [app.id, app.name, app.criticality, app.owner, app.dept, app.auth, app.dc, app.sox]
      )
    }

    // --- IAM Controls ---
    const controlTypes = ['MFA', 'SSO', 'PAM', 'RBAC', 'PROVISIONING', 'CERTIFICATION', 'LIFECYCLE'] as const
    const statuses = ['OK', 'ATTN', 'GAP'] as const
    let controlIdx = 0

    for (const app of apps) {
      const numControls = 3 + Math.floor(Math.random() * 4) // 3-6 controls per app
      const shuffled = [...controlTypes].sort(() => Math.random() - 0.5).slice(0, numControls)
      for (const ct of shuffled) {
        controlIdx++
        const status = statuses[controlIdx % 3]
        await client.query(
          `INSERT INTO iam_controls (id, application_id, control_type, status, tenant_id)
           VALUES ($1,$2,$3,$4,'tenant-001')`,
          [`ctrl-${String(controlIdx).padStart(4, '0')}`, app.id, ct, status]
        )
      }
    }

    // --- Control Assessments ---
    let assessIdx = 0
    for (const app of apps.slice(0, 8)) {
      for (const ct of ['MFA', 'SSO', 'PAM'] as const) {
        assessIdx++
        const status = statuses[assessIdx % 3]
        await client.query(
          `INSERT INTO control_assessments (id, application_id, control_type, status, assessed_by, notes, tenant_id)
           VALUES ($1,$2,$3,$4,$5,$6,'tenant-001')`,
          [
            `assess-${String(assessIdx).padStart(4, '0')}`,
            app.id, ct, status,
            'James Architect',
            `${ct} assessment for ${app.name}`,
          ]
        )
      }
    }

    // --- Risk Findings ---
    const riskFindings = [
      { appId: 'app-1000', cat: 'MFA Gap',           desc: 'MFA not enforced for admin accounts on ServiceNow',           sev: 'high' },
      { appId: 'app-1001', cat: 'Orphan Account',     desc: '6 orphan accounts identified in Salesforce',                  sev: 'medium' },
      { appId: 'app-1002', cat: 'Access Review',      desc: 'SAP S4 HANA access review overdue by 45 days',               sev: 'high' },
      { appId: 'app-1003', cat: 'Provisioning Gap',   desc: 'Workday manual provisioning increases onboarding time',       sev: 'medium' },
      { appId: 'app-1004', cat: 'SOD Violation',      desc: 'Separation of duties conflict in Oracle EBS finance module',  sev: 'critical' },
      { appId: 'app-1005', cat: 'PAM Gap',            desc: 'Microsoft 365 privileged accounts not vaulted',               sev: 'high' },
      { appId: 'app-1006', cat: 'SSO Gap',            desc: 'Legacy app not integrated with Okta SSO',                     sev: 'medium' },
      { appId: 'app-1007', cat: 'Credential Rotation',desc: 'CyberArk credential rotation policy not enforced',            sev: 'high' },
      { appId: 'app-1008', cat: 'Certification Gap',  desc: 'SailPoint certification campaign incomplete',                 sev: 'medium' },
      { appId: 'app-1009', cat: 'Failed Login',       desc: 'Excessive failed login attempts detected on Splunk',          sev: 'high' },
    ]

    for (let i = 0; i < riskFindings.length; i++) {
      const rf = riskFindings[i]
      await client.query(
        `INSERT INTO risk_findings (id, application_id, category, description, severity, status, tenant_id)
         VALUES ($1,$2,$3,$4,$5,'open','tenant-001')`,
        [`risk-${String(i + 1).padStart(4, '0')}`, rf.appId, rf.cat, rf.desc, rf.sev]
      )
    }

    // --- Dashboard Metrics ---
    const metrics = [
      { key: 'iga_maturity',        value: { score: 72, label: 'IGA Maturity' } },
      { key: 'access_mgmt_maturity', value: { score: 68, label: 'Access Management Maturity' } },
      { key: 'pam_maturity',        value: { score: 55, label: 'PAM Maturity' } },
      { key: 'mfa_coverage',        value: { percentage: 87.5, enrolled: 14000, total: 16000 } },
      { key: 'sso_coverage',        value: { percentage: 76.9, integrated: 10, total: 13 } },
      { key: 'orphan_accounts',     value: { total: 180, byApp: [{ app: 'SAP S4 HANA', count: 42 }, { app: 'Oracle EBS', count: 49 }, { app: 'ServiceNow', count: 37 }] } },
      { key: 'sod_coverage',        value: { percentage: 94.2, violations: 12 } },
      { key: 'login_success_rate',  value: { percentage: 96.01 } },
      { key: 'avg_login_time_ms',   value: { value: 141.6 } },
      { key: 'total_applications',  value: { count: 13 } },
      { key: 'pam_sessions',        value: { active: 23, total: 1450 } },
      { key: 'privileged_accounts', value: { total: 156, vaulted: 120 } },
    ]

    for (const m of metrics) {
      await client.query(
        `INSERT INTO dashboard_metrics (id, tenant_id, metric_key, metric_value)
         VALUES ($1, 'tenant-001', $2, $3)`,
        [`metric-${m.key}`, m.key, JSON.stringify(m.value)]
      )
    }

    await client.query('COMMIT')
    console.log('[SEED] Database seeded successfully.')
    console.log(`  - 1 tenant`)
    console.log(`  - 6 users`)
    console.log(`  - ${apps.length} applications`)
    console.log(`  - ${controlIdx} IAM controls`)
    console.log(`  - ${assessIdx} control assessments`)
    console.log(`  - ${riskFindings.length} risk findings`)
    console.log(`  - ${metrics.length} dashboard metrics`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[SEED] Seeding failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
