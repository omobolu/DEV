import { ConnectorHealth, ConnectorType, ConnectorStatus } from '../types';

export abstract class BaseConnector {
  abstract readonly type: ConnectorType;

  protected get isConfigured(): boolean {
    return false;
  }

  health(): ConnectorHealth {
    return {
      connector: this.type,
      status: this.isConfigured ? 'connected' : 'not_configured',
      lastChecked: new Date().toISOString(),
      message: this.isConfigured
        ? 'Connector ready'
        : `${this.type} credentials not configured in .env`,
    };
  }

  protected notConfigured(method: string): never {
    throw new Error(`[${this.type}] ${method}: connector not configured. Set credentials in .env`);
  }

  protected mockResponse<T>(data: T): T {
    console.log(`[${this.type}] Running in MOCK mode — no live API call made`);
    return data;
  }
}
