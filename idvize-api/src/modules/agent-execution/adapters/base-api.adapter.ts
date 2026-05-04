/**
 * Base API Adapter — Shared infrastructure for all external API adapters.
 *
 * Provides:
 *   - OAuth2 client_credentials token management (tenant-scoped cache)
 *   - HTTP request execution with timeout, max response size, retry
 *   - Circuit breaker (tenant/provider scoped)
 *   - SSRF protection (block private IPs, localhost, metadata endpoints)
 *   - Evidence capture with automatic credential/secret redaction
 *   - URL validation (HTTPS-only in production)
 *
 * Security invariants:
 *   - No credentials in logs, evidence, or error messages
 *   - No arbitrary base URLs from user input (trusted config only)
 *   - Token cache is tenant-isolated via composite keys
 *   - All external calls have timeouts and response size limits
 *   - Retry only for safe transient failures (429, 502, 503, 504)
 *   - No retry for 400, 401, 403, or mutation conflicts
 */

import { evidenceStoreService } from '../evidence-store.service';
import type { SystemType, StepResult } from '../agent-execution.types';

// ── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const CIRCUIT_BREAKER_THRESHOLD = 5;   // failures before opening
const CIRCUIT_BREAKER_RESET_MS = 60_000; // 1 minute cooldown

// ── SSRF Protection ──────────────────────────────────────────────────────────

const BLOCKED_IP_PATTERNS = [
  /^127\./,                              // loopback
  /^10\./,                               // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./,         // RFC 1918
  /^192\.168\./,                         // RFC 1918
  /^0\./,                                // "this" network
  /^169\.254\./,                         // link-local / cloud metadata
  /^fc00:/i,                             // IPv6 unique local
  /^fe80:/i,                             // IPv6 link-local
  /^::1$/,                               // IPv6 loopback
  /^fd/i,                                // IPv6 unique local
  /^::ffff:127\./i,                      // IPv4-mapped IPv6 loopback
  /^::ffff:10\./i,                       // IPv4-mapped RFC 1918
  /^::ffff:172\.(1[6-9]|2\d|3[01])\./i, // IPv4-mapped RFC 1918
  /^::ffff:192\.168\./i,                 // IPv4-mapped RFC 1918
  /^::ffff:169\.254\./i,                 // IPv4-mapped link-local
  /^::ffff:0\./i,                        // IPv4-mapped "this" network
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.com',
  '169.254.169.254',   // AWS/GCP metadata
  'fd00::1',
]);

/**
 * Convert IPv4-mapped IPv6 hex form (e.g. ::ffff:7f00:1) to dotted notation
 * (e.g. ::ffff:127.0.0.1) so existing IPv4 blocklist patterns can match.
 * Node's URL normalizes ::ffff:127.0.0.1 → ::ffff:7f00:1.
 */
function normalizeIPv4MappedIPv6(host: string): string {
  const match = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (!match) return host;
  const hi = parseInt(match[1], 16);
  const lo = parseInt(match[2], 16);
  return `::ffff:${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isBlockedHost(hostname: string): boolean {
  // Node's URL.hostname returns bracketed IPv6 like [::1] — strip brackets for matching
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (BLOCKED_IP_PATTERNS.some(pattern => pattern.test(lower))) return true;
  // Also check the normalized dotted form for IPv4-mapped IPv6 hex addresses
  const normalized = normalizeIPv4MappedIPv6(lower);
  if (normalized !== lower) {
    return BLOCKED_IP_PATTERNS.some(pattern => pattern.test(normalized));
  }
  return false;
}

/**
 * Validate a base URL is safe for external API calls.
 * Rejects private IPs, localhost, non-HTTPS, and metadata endpoints.
 */
export function validateBaseUrl(url: string, allowHttp = false): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  const isProduction = process.env.NODE_ENV === 'production' || process.env.SEED_MODE === 'production';

  if (parsed.protocol !== 'https:') {
    if (parsed.protocol === 'http:' && !allowHttp && isProduction) {
      throw new Error('HTTPS required for external API calls in production');
    }
    if (parsed.protocol !== 'http:') {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }
  }

  if (isBlockedHost(parsed.hostname)) {
    throw new Error('URL targets a blocked host (localhost, private IP, or cloud metadata endpoint)');
  }
}

// ── OAuth2 Token Cache ───────────────────────────────────────────────────────

interface CachedToken {
  accessToken: string;
  expiresAt: number;   // epoch ms
  scope?: string;
}

/**
 * Composite cache key: tenantId|provider|baseUrl|clientId|scope
 * Ensures no cross-tenant token sharing.
 */
function tokenCacheKey(parts: {
  tenantId: string;
  provider: SystemType;
  baseUrl: string;
  clientId: string;
  scope?: string;
}): string {
  return `${parts.tenantId}|${parts.provider}|${parts.baseUrl}|${parts.clientId}|${parts.scope ?? ''}`;
}

const tokenCache = new Map<string, CachedToken>();

// Jitter: subtract 30-90 seconds to refresh before actual expiry
function jitteredExpiry(expiresInSec: number): number {
  const jitter = 30 + Math.floor(Math.random() * 60);
  const effectiveExpiry = Math.max(expiresInSec - jitter, 10);
  return Date.now() + effectiveExpiry * 1000;
}

// ── Circuit Breaker ──────────────────────────────────────────────────────────

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitState>();

function circuitKey(tenantId: string, provider: SystemType): string {
  return `${tenantId}|${provider}`;
}

function checkCircuit(tenantId: string, provider: SystemType): void {
  const key = circuitKey(tenantId, provider);
  const state = circuitBreakers.get(key);
  if (!state || !state.isOpen) return;

  if (Date.now() - state.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
    state.isOpen = false;
    state.failures = 0;
    return;
  }

  throw new Error(
    `Circuit breaker OPEN for ${provider} (tenant: ${tenantId}). ` +
    `${state.failures} consecutive failures. Retry after ${Math.ceil((CIRCUIT_BREAKER_RESET_MS - (Date.now() - state.lastFailure)) / 1000)}s.`,
  );
}

function recordCircuitFailure(tenantId: string, provider: SystemType): void {
  const key = circuitKey(tenantId, provider);
  const state = circuitBreakers.get(key) ?? { failures: 0, lastFailure: 0, isOpen: false };
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.isOpen = true;
  }
  circuitBreakers.set(key, state);
}

function recordCircuitSuccess(tenantId: string, provider: SystemType): void {
  const key = circuitKey(tenantId, provider);
  circuitBreakers.set(key, { failures: 0, lastFailure: 0, isOpen: false });
}

// ── Sensitive Data Redaction ─────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'authorization', 'client_secret', 'clientsecret', 'access_token', 'accesstoken',
  'refresh_token', 'refreshtoken', 'password', 'secret', 'token', 'apikey',
  'api_key', 'cookie', 'set-cookie', 'x-api-key', 'private_key', 'privatekey',
  'certificate', 'cert', 'saml_certificate', 'scim_token', 'bearer',
  'credential', 'admin_password', 'adminpassword',
]);

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lower) || containsSensitiveSubstring(lower)) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? redactObject(item as Record<string, unknown>)
          : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

function containsSensitiveSubstring(key: string): boolean {
  const substrings = ['password', 'secret', 'credential', 'apikey', 'accesstoken', 'privatekey', 'bearer'];
  return substrings.some(s => key.includes(s));
}

// ── Retryable Status Codes ───────────────────────────────────────────────────

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 409, 422]);

// ── Input Validation Helpers ─────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STRING_LENGTH = 1024;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUUID(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }
  return value;
}

export function validateString(value: unknown, fieldName: string, maxLen = MAX_STRING_LENGTH): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldName} is required and must be a non-empty string`);
  }
  if (value.length > maxLen) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLen}`);
  }
  return value;
}

export function validateUrl(value: unknown, fieldName: string, requireHttps = true): string {
  const str = validateString(value, fieldName, 2048);
  let parsed: URL;
  try {
    parsed = new URL(str);
  } catch {
    throw new Error(`${fieldName} must be a valid URL`);
  }
  if (requireHttps && parsed.protocol !== 'https:') {
    throw new Error(`${fieldName} must use HTTPS`);
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error(`${fieldName} targets a blocked host`);
  }
  return str;
}

export function validateEmail(value: unknown, fieldName: string): string {
  const str = validateString(value, fieldName, 320);
  if (!EMAIL_REGEX.test(str)) {
    throw new Error(`${fieldName} must be a valid email address`);
  }
  return str;
}

export function validateEnum<T extends string>(value: unknown, fieldName: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function rejectUnknownFields(input: Record<string, unknown>, allowed: Set<string>, context: string): void {
  const unknown = Object.keys(input).filter(k => !allowed.has(k));
  if (unknown.length > 0) {
    throw new Error(`${context}: unknown fields: ${unknown.join(', ')}`);
  }
}

// ── Base API Adapter ─────────────────────────────────────────────────────────

export interface OAuthConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export interface ApiCallOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** If true, skip retry even for retryable status codes (for mutations where idempotency is not guaranteed) */
  noRetry?: boolean;
}

export interface ApiCallResult {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

export abstract class BaseApiAdapter {
  abstract readonly systemType: SystemType;
  abstract readonly systemName: string;

  /**
   * Acquire an OAuth2 access token via client_credentials flow.
   * Tokens are cached per tenant+provider+baseUrl+clientId+scope.
   */
  protected async getOAuthToken(tenantId: string, config: OAuthConfig): Promise<string> {
    const key = tokenCacheKey({
      tenantId,
      provider: this.systemType,
      baseUrl: config.tokenUrl,
      clientId: config.clientId,
      scope: config.scope,
    });

    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.accessToken;
    }

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    if (config.scope) {
      params.set('scope', config.scope);
    }

    validateBaseUrl(config.tokenUrl, process.env.NODE_ENV !== 'production' && process.env.SEED_MODE !== 'production');
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`OAuth token request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number; scope?: string };
    if (!data.access_token) {
      throw new Error('OAuth token response missing access_token');
    }

    tokenCache.set(key, {
      accessToken: data.access_token,
      expiresAt: jitteredExpiry(data.expires_in ?? 3600),
      scope: data.scope ?? config.scope,
    });

    return data.access_token;
  }

  /**
   * Execute an HTTP request with timeout, retry, circuit breaker, and SSRF protection.
   * Returns the parsed response or throws on non-retryable failure.
   */
  protected async apiCall(tenantId: string, options: ApiCallOptions): Promise<ApiCallResult> {
    validateBaseUrl(options.url, process.env.NODE_ENV !== 'production' && process.env.SEED_MODE !== 'production');

    checkCircuit(tenantId, this.systemType);

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let lastError: Error | undefined;

    const maxAttempts = options.noRetry ? 1 : MAX_RETRIES;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), timeoutMs);

        const fetchOptions: RequestInit = {
          method: options.method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
          },
          signal: controller.signal,
        };

        if (options.body && ['POST', 'PATCH', 'PUT'].includes(options.method)) {
          fetchOptions.body = JSON.stringify(options.body);
        }

        const response = await fetch(options.url, fetchOptions);

        // Check Content-Length before reading body to reject oversized responses early
        const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
        if (contentLength > MAX_RESPONSE_SIZE) {
          throw new ApiError(`Response Content-Length (${contentLength}) exceeds maximum of ${MAX_RESPONSE_SIZE} bytes`, 413, {});
        }

        // Keep timeout active during body read to protect against slow-loris
        const text = await response.text();
        clearTimeout(timeout);
        const byteLength = Buffer.byteLength(text, 'utf8');
        if (byteLength > MAX_RESPONSE_SIZE) {
          throw new ApiError(`Response body (${byteLength} bytes) exceeds maximum of ${MAX_RESPONSE_SIZE} bytes`, 413, {});
        }

        const responseBody = text ? JSON.parse(text) as Record<string, unknown> : {};

        // Extract response headers as plain object
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        if (!response.ok) {
          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxAttempts && !options.noRetry) {
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
            continue;
          }

          if (NON_RETRYABLE_STATUS_CODES.has(response.status)) {
            // Client errors (4xx) do NOT trip the circuit breaker — they indicate
            // bad input or auth issues, not service unavailability
            const safeBody = redactObject(responseBody);
            throw new ApiError(
              `${this.systemName} API error: ${response.status} ${response.statusText}`,
              response.status,
              safeBody,
            );
          }

          // Server errors (5xx not in retryable set) DO trip the circuit breaker
          recordCircuitFailure(tenantId, this.systemType);
          throw new ApiError(
            `${this.systemName} API error: ${response.status}`,
            response.status,
            redactObject(responseBody),
          );
        }

        recordCircuitSuccess(tenantId, this.systemType);

        return {
          status: response.status,
          body: responseBody,
          headers: responseHeaders,
        };
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        if (err instanceof ApiError) throw err;
        lastError = err as Error;
        if (attempt < maxAttempts) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    recordCircuitFailure(tenantId, this.systemType);
    throw lastError ?? new Error(`${this.systemName} API call failed after ${maxAttempts} attempts`);
  }

  /**
   * Record evidence for an API call (request + response summary, redacted).
   */
  protected async recordApiEvidence(
    tenantId: string,
    sessionId: string,
    stepId: string,
    actionType: string,
    request: { method: string; url: string; body?: Record<string, unknown>; headers?: Record<string, string> },
    response: { status: number; body: Record<string, unknown> },
    externalObjectId?: string,
  ): Promise<string> {
    const evidence = await evidenceStoreService.record(
      tenantId,
      sessionId,
      'api_response',
      `${actionType} — ${request.method} ${new URL(request.url).pathname}`,
      `Status ${response.status}${externalObjectId ? ` — Created: ${externalObjectId}` : ''}`,
      {
        provider: this.systemType,
        actionType,
        tenantId,
        sessionId,
        stepId,
        externalObjectId: externalObjectId ?? null,
        request: {
          method: request.method,
          url: request.url,
          headers: request.headers ? redactHeaders(request.headers) : undefined,
          body: request.body ? redactObject(request.body) : undefined,
        },
        response: {
          statusCode: response.status,
          body: redactObject(response.body),
        },
        timestamp: new Date().toISOString(),
      },
      stepId,
    );
    return evidence.evidenceId;
  }

  /**
   * Build a StepResult from an API call.
   */
  protected successResult(output: Record<string, unknown>, evidenceIds: string[] = []): StepResult {
    return { success: true, output, evidenceIds };
  }

  protected failResult(errorMessage: string, evidenceIds: string[] = [], output: Record<string, unknown> = {}): StepResult {
    return { success: false, output, errorMessage, evidenceIds };
  }

  /**
   * Safely encode a path segment to prevent injection.
   */
  protected encodePath(segment: string): string {
    return encodeURIComponent(segment);
  }

  /**
   * Build a URL with OData query parameters safely URL-encoded.
   * Prevents URL parsing issues when filter values contain &, #, + etc.
   */
  protected buildODataUrl(base: string, filter?: string, select?: string): string {
    const url = new URL(base);
    if (filter) url.searchParams.set('$filter', filter);
    if (select) url.searchParams.set('$select', select);
    return url.toString();
  }

  /**
   * Invalidate cached OAuth token for this tenant.
   */
  protected invalidateToken(tenantId: string, config: OAuthConfig): void {
    const key = tokenCacheKey({
      tenantId,
      provider: this.systemType,
      baseUrl: config.tokenUrl,
      clientId: config.clientId,
      scope: config.scope,
    });
    tokenCache.delete(key);
  }
}

// ── API Error Type ───────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
