/**
 * IDVIZE Tools / Adapters Layer
 * External system adapters for future integration
 * Each adapter follows a common interface for consistency
 */

export interface AdapterConfig {
  id: string
  name: string
  type: AdapterType
  enabled: boolean
  endpoint?: string
  metadata: Record<string, string>
}

export type AdapterType =
  | 'iam_platform'
  | 'itsm'
  | 'email'
  | 'calendar'
  | 'document_management'
  | 'vault'
  | 'risk_platform'
  | 'llm_provider'

export interface AdapterResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  adapterName: string
  executionTimeMs: number
}

/**
 * Base adapter contract — all external adapters implement this
 */
export interface BaseAdapter {
  readonly config: AdapterConfig

  /** Test connectivity */
  testConnection(): Promise<AdapterResult<boolean>>

  /** Execute an adapter-specific operation */
  execute<T>(operation: string, params: Record<string, unknown>): Promise<AdapterResult<T>>
}

/**
 * Adapter registry — manages all external adapters
 */
class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map()

  register(adapter: BaseAdapter): void {
    this.adapters.set(adapter.config.id, adapter)
  }

  unregister(adapterId: string): void {
    this.adapters.delete(adapterId)
  }

  get(adapterId: string): BaseAdapter | undefined {
    return this.adapters.get(adapterId)
  }

  getByType(type: AdapterType): BaseAdapter[] {
    return Array.from(this.adapters.values()).filter(a => a.config.type === type)
  }

  getAll(): BaseAdapter[] {
    return Array.from(this.adapters.values())
  }

  getConfigs(): AdapterConfig[] {
    return Array.from(this.adapters.values()).map(a => a.config)
  }
}

/** Singleton adapter registry */
export const adapterRegistry = new AdapterRegistry()

/**
 * Predefined adapter configurations (scaffolding for future integration)
 */
export const PREDEFINED_ADAPTERS: AdapterConfig[] = [
  // IAM Platforms
  {
    id: 'adapter-sailpoint-iiq',
    name: 'SailPoint IdentityIQ v8.x',
    type: 'iam_platform',
    enabled: false,
    endpoint: 'https://sailpoint.example.com/identityiq/api',
    metadata: { version: '8.x', protocol: 'REST' },
  },
  {
    id: 'adapter-microsoft-entra',
    name: 'Microsoft Entra ID',
    type: 'iam_platform',
    enabled: false,
    endpoint: 'https://graph.microsoft.com/v1.0',
    metadata: { protocol: 'Graph API' },
  },
  {
    id: 'adapter-cyberark-pac',
    name: 'CyberArk Privileged Access Cloud',
    type: 'iam_platform',
    enabled: false,
    endpoint: 'https://cyberark.example.com/PasswordVault/api',
    metadata: { protocol: 'REST' },
  },
  {
    id: 'adapter-okta',
    name: 'Okta',
    type: 'iam_platform',
    enabled: false,
    endpoint: 'https://org.okta.com/api/v1',
    metadata: { protocol: 'REST' },
  },
  // ITSM
  {
    id: 'adapter-servicenow',
    name: 'ServiceNow',
    type: 'itsm',
    enabled: false,
    endpoint: 'https://instance.service-now.com/api',
    metadata: { protocol: 'REST' },
  },
  // Email
  {
    id: 'adapter-exchange',
    name: 'Microsoft Exchange / Graph Mail',
    type: 'email',
    enabled: false,
    endpoint: 'https://graph.microsoft.com/v1.0/me/messages',
    metadata: { protocol: 'Graph API' },
  },
  // Calendar
  {
    id: 'adapter-calendar',
    name: 'Microsoft Graph Calendar',
    type: 'calendar',
    enabled: false,
    endpoint: 'https://graph.microsoft.com/v1.0/me/events',
    metadata: { protocol: 'Graph API' },
  },
  // Document Management
  {
    id: 'adapter-confluence',
    name: 'Atlassian Confluence',
    type: 'document_management',
    enabled: false,
    endpoint: 'https://confluence.example.com/wiki/rest/api',
    metadata: { protocol: 'REST' },
  },
  // Risk Platform
  {
    id: 'adapter-risk-platform',
    name: 'Third-Party Risk Platform',
    type: 'risk_platform',
    enabled: false,
    metadata: { protocol: 'REST' },
  },
  // LLM Providers (not tightly coupled to one)
  {
    id: 'adapter-llm-openai',
    name: 'OpenAI API',
    type: 'llm_provider',
    enabled: false,
    endpoint: 'https://api.openai.com/v1',
    metadata: { model: 'gpt-4' },
  },
  {
    id: 'adapter-llm-azure-openai',
    name: 'Azure OpenAI',
    type: 'llm_provider',
    enabled: false,
    metadata: { model: 'gpt-4' },
  },
  {
    id: 'adapter-llm-anthropic',
    name: 'Anthropic Claude',
    type: 'llm_provider',
    enabled: false,
    endpoint: 'https://api.anthropic.com/v1',
    metadata: { model: 'claude-3' },
  },
]
