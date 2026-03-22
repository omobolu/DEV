import { PlatformIntegration } from '../integration.types';
import { IamPlatformLink } from '../../application/application.types';

interface CyberArkSafeRecord {
  safeName: string;
  description: string;
  accountsCount: number;
  cpmEnabled: boolean;
}

export class CyberArkAdapter {
  private readonly isConfigured = !!(
    process.env.CYBERARK_BASE_URL &&
    process.env.CYBERARK_USERNAME &&
    process.env.CYBERARK_PASSWORD
  );

  getIntegrationStatus(): PlatformIntegration {
    return {
      platform: 'CyberArk PAM',
      status: this.isConfigured ? 'connected' : 'mock',
      baseUrl: process.env.CYBERARK_BASE_URL,
      lastChecked: new Date().toISOString(),
      capabilities: ['Privileged Account Vaulting', 'CPM Rotation', 'Session Isolation', 'Secret Management', 'Dual Control'],
    };
  }

  async listSafes(): Promise<CyberArkSafeRecord[]> {
    if (!this.isConfigured) {
      return [
        { safeName: 'Windows-Server-Admins', description: 'Windows local admin accounts', accountsCount: 45, cpmEnabled: true },
        { safeName: 'Linux-Root-Accounts', description: 'Linux root accounts', accountsCount: 22, cpmEnabled: true },
        { safeName: 'AWS-IAM-Keys', description: 'AWS IAM access keys', accountsCount: 12, cpmEnabled: true },
        { safeName: 'SAP-ServiceAccounts', description: 'SAP service accounts', accountsCount: 8, cpmEnabled: true },
      ];
    }
    throw new Error('Live CyberArk adapter not yet implemented');
  }

  async correlateApp(appName: string): Promise<IamPlatformLink> {
    const safes = await this.listSafes();
    const normalizedName = appName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const match = safes.find(s =>
      s.safeName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedName) ||
      s.description.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedName)
    );

    if (match) {
      return { platform: 'PAM', tool: 'CyberArk', onboarded: true, status: match.cpmEnabled ? 'active' : 'partial' };
    }

    return { platform: 'PAM', tool: 'CyberArk', onboarded: false, status: 'not_onboarded' };
  }

  async arePrivilegedAccountsVaulted(appName: string): Promise<boolean> {
    const link = await this.correlateApp(appName);
    return link.onboarded && link.status === 'active';
  }
}

export const cyberarkAdapter = new CyberArkAdapter();
