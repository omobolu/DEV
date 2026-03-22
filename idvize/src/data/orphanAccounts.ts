export type AccountStatus = 'Active' | 'Disabled' | 'Pending Review' | 'Suspended'
export type RiskLevel = 'High' | 'Medium' | 'Low'

export interface OrphanAccount {
  id: string
  applicationName: string
  accountName: string
  accountStatus: AccountStatus
  lastLogin: string
  riskLevel: RiskLevel
}

export const ORPHAN_ACCOUNTS_TABLE: OrphanAccount[] = [
  { id: '1',  applicationName: 'Salesforce',     accountName: 'john.doe.sf',     accountStatus: 'Active',         lastLogin: '2024-01-15', riskLevel: 'High'   },
  { id: '2',  applicationName: 'Workday',         accountName: 'jane.smith.wd',   accountStatus: 'Active',         lastLogin: '2024-01-10', riskLevel: 'High'   },
  { id: '3',  applicationName: 'SAP ERP',         accountName: 'admin_svc_01',    accountStatus: 'Active',         lastLogin: '2023-12-28', riskLevel: 'High'   },
  { id: '4',  applicationName: 'ServiceNow',      accountName: 'it.helpdesk.sn',  accountStatus: 'Disabled',       lastLogin: '2023-11-20', riskLevel: 'Medium' },
  { id: '5',  applicationName: 'Confluence',      accountName: 'wiki.editor.99',  accountStatus: 'Pending Review', lastLogin: '2024-01-18', riskLevel: 'Medium' },
  { id: '6',  applicationName: 'Jira',            accountName: 'proj.mgr.old',    accountStatus: 'Active',         lastLogin: '2023-10-05', riskLevel: 'High'   },
  { id: '7',  applicationName: 'GitHub Ent.',     accountName: 'dev.bot.x12',     accountStatus: 'Suspended',      lastLogin: '2023-09-14', riskLevel: 'Medium' },
  { id: '8',  applicationName: 'AWS Console',     accountName: 'svc_lambda_04',   accountStatus: 'Active',         lastLogin: '2024-01-22', riskLevel: 'High'   },
  { id: '9',  applicationName: 'Azure Portal',    accountName: 'infra.admin.bk',  accountStatus: 'Active',         lastLogin: '2023-12-01', riskLevel: 'High'   },
  { id: '10', applicationName: 'Oracle DB',       accountName: 'dba_legacy_03',   accountStatus: 'Disabled',       lastLogin: '2023-08-30', riskLevel: 'High'   },
  { id: '11', applicationName: 'Slack',           accountName: 'bot.notif.old',   accountStatus: 'Pending Review', lastLogin: '2024-01-05', riskLevel: 'Low'    },
  { id: '12', applicationName: 'Zoom',            accountName: 'conf.room.02',    accountStatus: 'Active',         lastLogin: '2024-01-12', riskLevel: 'Low'    },
  { id: '13', applicationName: 'Okta',            accountName: 'svc.okta.sync',   accountStatus: 'Active',         lastLogin: '2024-01-20', riskLevel: 'High'   },
  { id: '14', applicationName: 'Box',             accountName: 'ext.contractor1', accountStatus: 'Suspended',      lastLogin: '2023-07-22', riskLevel: 'Medium' },
  { id: '15', applicationName: 'Dropbox',         accountName: 'mkt.shared.acct', accountStatus: 'Active',         lastLogin: '2023-11-11', riskLevel: 'Medium' },
  { id: '16', applicationName: 'Tableau',         accountName: 'report.svc.04',   accountStatus: 'Disabled',       lastLogin: '2023-10-18', riskLevel: 'Low'    },
  { id: '17', applicationName: 'Salesforce',      accountName: 'api.integ.v2',    accountStatus: 'Active',         lastLogin: '2024-01-08', riskLevel: 'High'   },
  { id: '18', applicationName: 'ServiceNow',      accountName: 'admin.svc.old',   accountStatus: 'Pending Review', lastLogin: '2023-12-15', riskLevel: 'High'   },
  { id: '19', applicationName: 'SAP ERP',         accountName: 'batch.job.02',    accountStatus: 'Active',         lastLogin: '2024-01-03', riskLevel: 'Medium' },
  { id: '20', applicationName: 'Microsoft 365',   accountName: 'shared.mailbox',  accountStatus: 'Active',         lastLogin: '2024-01-25', riskLevel: 'Medium' },
]

export const ORPHAN_BY_APP_DATA = [
  { app: 'Salesforce',   count: 12 },
  { app: 'SAP ERP',      count: 9  },
  { app: 'ServiceNow',   count: 8  },
  { app: 'AWS Console',  count: 7  },
  { app: 'Azure Portal', count: 6  },
  { app: 'Jira',         count: 5  },
  { app: 'Oracle DB',    count: 4  },
  { app: 'Workday',      count: 3  },
]
