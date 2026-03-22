import { RiskTier, DataClassification, Application, RawApplication, IngestionSource } from '../application.types';
import { v4 as uuidv4 } from 'uuid';

// ─── Field Alias Map ──────────────────────────────────────────────────────────
// Maps known column name variants → canonical field names

const FIELD_ALIASES: Record<string, string> = {
  // Name
  'application name': 'name', 'app name': 'name', 'application': 'name', 'app': 'name', 'system name': 'name',
  // Owner
  'application owner': 'owner', 'app owner': 'owner', 'business owner': 'owner', 'product owner': 'owner',
  // Owner Email
  'owner email': 'ownerEmail', 'app owner email': 'ownerEmail', 'contact email': 'ownerEmail', 'email': 'ownerEmail',
  // Vendor
  'vendor name': 'vendor', 'software vendor': 'vendor', 'provider': 'vendor', 'manufacturer': 'vendor',
  // Department
  'business unit': 'department', 'dept': 'department', 'division': 'department', 'team': 'department',
  // Risk
  'risk level': 'riskTier', 'risk tier': 'riskTier', 'criticality': 'riskTier', 'risk rating': 'riskTier', 'app criticality': 'riskTier',
  // Data classification
  'data class': 'dataClassification', 'data classification': 'dataClassification', 'information classification': 'dataClassification',
  // User population
  'user count': 'userPopulation', 'users': 'userPopulation', 'number of users': 'userPopulation', 'user base': 'userPopulation', 'active users': 'userPopulation',
  // App type
  'deployment type': 'appType', 'hosting': 'appType', 'app type': 'appType', 'type': 'appType',
  // Support
  'support contact': 'supportContact', 'it contact': 'supportContact', 'technical contact': 'supportContact',
};

// ─── Normalizers ──────────────────────────────────────────────────────────────

export function normalizeAppName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-\.]/g, '')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function normalizeRiskTier(raw: string | undefined): RiskTier {
  if (!raw) return 'medium';
  const v = raw.toLowerCase().trim();
  if (['critical', 'tier 1', 'tier1', 'p1', '1', 'very high'].includes(v)) return 'critical';
  if (['high', 'tier 2', 'tier2', 'p2', '2'].includes(v)) return 'high';
  if (['medium', 'moderate', 'tier 3', 'tier3', 'p3', '3'].includes(v)) return 'medium';
  if (['low', 'minimal', 'tier 4', 'tier4', 'p4', '4'].includes(v)) return 'low';
  return 'medium';
}

export function normalizeDataClassification(raw: string | undefined): DataClassification {
  if (!raw) return 'internal';
  const v = raw.toLowerCase().trim();
  if (['restricted', 'highly confidential', 'secret', 'top secret'].includes(v)) return 'restricted';
  if (['confidential', 'private', 'sensitive'].includes(v)) return 'confidential';
  if (['public', 'open', 'external'].includes(v)) return 'public';
  return 'internal';
}

export function normalizeAppType(raw: string | undefined): Application['appType'] {
  if (!raw) return 'unknown';
  const v = raw.toLowerCase().trim();
  if (['saas', 'cloud saas', 'software as a service', 'hosted'].includes(v)) return 'saas';
  if (['on-premise', 'on premise', 'onprem', 'on-prem', 'local'].includes(v)) return 'on-premise';
  if (['cloud', 'iaas', 'paas', 'aws', 'azure', 'gcp'].includes(v)) return 'cloud';
  if (['custom', 'in-house', 'bespoke', 'internal app'].includes(v)) return 'custom';
  if (['legacy', 'mainframe', 'as400', 'cobol'].includes(v)) return 'legacy';
  return 'unknown';
}

export function normalizeUserPopulation(raw: string | number | undefined): number {
  if (raw === undefined || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/[,\s]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

// ─── Field Resolution ─────────────────────────────────────────────────────────

export function resolveFieldName(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return FIELD_ALIASES[lower] ?? lower;
}

export function flattenRawRow(row: RawApplication): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    const canonical = resolveFieldName(key);
    resolved[canonical] = String(val ?? '').trim();
  }
  return resolved;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export function buildDedupeKey(name: string, vendor?: string): string {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedVendor = (vendor ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${normalizedName}:${normalizedVendor}`;
}

// ─── Full Row → Application ───────────────────────────────────────────────────

export function parseRawApplication(row: RawApplication, source: IngestionSource, rowIndex: number): Application {
  const fields = flattenRawRow(row);

  const rawName = fields['name'] ?? fields['application name'] ?? `Unknown App #${rowIndex}`;
  const name = normalizeAppName(rawName);

  return {
    appId: `APP-${uuidv4().split('-')[0].toUpperCase()}`,
    name,
    rawName,
    owner: fields['owner'] ?? fields['application owner'] ?? 'Unknown',
    ownerEmail: fields['ownerEmail'] ?? fields['owner email'] ?? '',
    vendor: fields['vendor'] ?? 'Unknown',
    supportContact: fields['supportContact'] ?? undefined,
    department: fields['department'] ?? fields['business unit'] ?? 'Unknown',
    riskTier: normalizeRiskTier(fields['riskTier'] ?? fields['risk tier'] ?? fields['criticality']),
    dataClassification: normalizeDataClassification(fields['dataClassification'] ?? fields['data classification']),
    userPopulation: normalizeUserPopulation(fields['userPopulation'] ?? fields['user count'] ?? fields['users']),
    appType: normalizeAppType(fields['appType'] ?? fields['app type'] ?? fields['type']),
    tags: [],
    source,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
