import { BaseConnector } from './base';
import { ConnectorType } from '../types';

interface CyberArkSafe {
  safeName: string;
  description?: string;
  managingCPM?: string;
  numberOfVersionsRetention?: number;
}

interface CyberArkAccount {
  id?: string;
  name: string;
  address: string;
  userName: string;
  platformId: string;
  safeName: string;
  secretType: 'password' | 'key';
  secret?: string;
  platformAccountProperties?: Record<string, string>;
}

interface CyberArkSafeMember {
  memberName: string;
  memberType: 'User' | 'Group' | 'Role';
  permissions: CyberArkPermissions;
}

interface CyberArkPermissions {
  useAccounts?: boolean;
  retrieveAccounts?: boolean;
  listAccounts?: boolean;
  addAccounts?: boolean;
  updateAccountContent?: boolean;
  updateAccountProperties?: boolean;
  initiateCPMAccountManagementOperations?: boolean;
  specifyNextAccountContent?: boolean;
  renameAccounts?: boolean;
  deleteAccounts?: boolean;
  unlockAccounts?: boolean;
  manageSafe?: boolean;
  manageSafeMembers?: boolean;
  backupSafe?: boolean;
  viewAuditLog?: boolean;
  viewSafeMembers?: boolean;
  requestsAuthorizationLevel1?: boolean;
  accessWithoutConfirmation?: boolean;
  createFolders?: boolean;
  deleteFolders?: boolean;
  moveAccountsAndFolders?: boolean;
}

export class CyberArkConnector extends BaseConnector {
  readonly type: ConnectorType = 'cyberark';

  protected get isConfigured(): boolean {
    return !!(
      process.env.CYBERARK_BASE_URL &&
      process.env.CYBERARK_USERNAME &&
      process.env.CYBERARK_PASSWORD
    );
  }

  /**
   * List all safes.
   * Live: GET {base}/PasswordVault/API/Safes
   */
  async listSafes(): Promise<CyberArkSafe[]> {
    if (!this.isConfigured) {
      return this.mockResponse<CyberArkSafe[]>([
        { safeName: 'Windows-Server-Admins', description: 'Windows server local admin accounts', managingCPM: 'PasswordManager' },
        { safeName: 'Linux-Root-Accounts', description: 'Linux root/sudo accounts', managingCPM: 'PasswordManager' },
        { safeName: 'AWS-IAM-Keys', description: 'AWS IAM access keys', managingCPM: 'AWSKeyManager' },
        { safeName: 'ServiceAccounts-SAP', description: 'SAP service accounts', managingCPM: 'PasswordManager' },
      ]);
    }
    throw new Error('Live CyberArk API not yet implemented');
  }

  /**
   * Create a new safe.
   * Live: POST {base}/PasswordVault/API/Safes
   */
  async createSafe(safe: CyberArkSafe): Promise<CyberArkSafe & { safeUrlId: string }> {
    if (!this.isConfigured) {
      return this.mockResponse({ ...safe, safeUrlId: safe.safeName.replace(/\s+/g, '-') });
    }
    throw new Error('Live CyberArk API not yet implemented');
  }

  /**
   * Onboard a privileged account into a safe.
   * Live: POST {base}/PasswordVault/API/Accounts
   */
  async onboardAccount(account: CyberArkAccount): Promise<CyberArkAccount & { id: string }> {
    if (!this.isConfigured) {
      return this.mockResponse({ ...account, id: `acct-mock-${Date.now()}` });
    }
    throw new Error('Live CyberArk API not yet implemented');
  }

  /**
   * Add a member to a safe.
   * Live: POST {base}/PasswordVault/API/Safes/{safeUrlId}/Members
   */
  async addSafeMember(safeUrlId: string, member: CyberArkSafeMember): Promise<CyberArkSafeMember> {
    if (!this.isConfigured) {
      return this.mockResponse(member);
    }
    throw new Error('Live CyberArk API not yet implemented');
  }

  /**
   * Rotate/reconcile credentials for an account.
   * Live: POST {base}/PasswordVault/API/Accounts/{accountId}/Change
   */
  async rotateCredentials(accountId: string): Promise<{ status: string }> {
    if (!this.isConfigured) {
      return this.mockResponse({ status: 'initiated' });
    }
    throw new Error('Live CyberArk API not yet implemented');
  }

  /**
   * List accounts in a safe.
   * Live: GET {base}/PasswordVault/API/Accounts?filter=safeName eq {safeName}
   */
  async listAccounts(safeName?: string): Promise<CyberArkAccount[]> {
    if (!this.isConfigured) {
      return this.mockResponse<CyberArkAccount[]>([
        { id: 'acct-001', name: 'admin@webserver01', address: '10.0.1.10', userName: 'administrator', platformId: 'WinServerLocal', safeName: 'Windows-Server-Admins', secretType: 'password' as const },
        { id: 'acct-002', name: 'root@dbserver02', address: '10.0.1.20', userName: 'root', platformId: 'LinuxSSH', safeName: 'Linux-Root-Accounts', secretType: 'key' as const },
      ].filter(a => !safeName || a.safeName === safeName));
    }
    throw new Error('Live CyberArk API not yet implemented');
  }
}

export const cyberarkConnector = new CyberArkConnector();
