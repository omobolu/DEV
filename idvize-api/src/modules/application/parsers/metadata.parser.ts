import { Application } from '../application.types';

/**
 * Enrich application metadata based on inferred signals.
 * Adds tags, infers missing fields, and flags anomalies.
 */
export function enrichMetadata(app: Application): Application {
  const tags = new Set(app.tags);

  // Infer tags from app type
  if (app.appType === 'saas') tags.add('saas');
  if (app.appType === 'on-premise') tags.add('on-premise');
  if (app.appType === 'legacy') tags.add('legacy');
  if (app.appType === 'cloud') tags.add('cloud');

  // Infer tags from user population
  if (app.userPopulation > 10000) tags.add('high-volume');
  if (app.userPopulation === 0) tags.add('user-count-unknown');

  // Infer tags from risk tier
  if (app.riskTier === 'critical') tags.add('critical-app');

  // Infer tags from data classification
  if (app.dataClassification === 'restricted') tags.add('restricted-data');
  if (app.dataClassification === 'confidential') tags.add('confidential-data');

  // Infer tags from vendor patterns
  const vendorLower = app.vendor.toLowerCase();
  if (vendorLower.includes('sap')) tags.add('erp');
  if (vendorLower.includes('salesforce') || app.name.toLowerCase().includes('salesforce')) tags.add('crm');
  if (vendorLower.includes('atlassian') || app.name.toLowerCase().includes('jira') || app.name.toLowerCase().includes('confluence')) tags.add('itsm');
  if (vendorLower.includes('microsoft') || app.name.toLowerCase().includes('office') || app.name.toLowerCase().includes('teams')) tags.add('productivity');
  if (vendorLower.includes('aws') || vendorLower.includes('azure') || vendorLower.includes('gcp')) tags.add('cloud-provider');
  if (vendorLower.includes('github') || vendorLower.includes('gitlab') || vendorLower.includes('bitbucket')) tags.add('devtools');

  // Infer tags from name patterns
  const nameLower = app.name.toLowerCase();
  if (nameLower.includes('payroll') || nameLower.includes('hr') || nameLower.includes('human resource')) tags.add('hr-system');
  if (nameLower.includes('finance') || nameLower.includes('accounting') || nameLower.includes('erp')) tags.add('finance');
  if (nameLower.includes('customer') || nameLower.includes('portal') || nameLower.includes('external')) tags.add('customer-facing');
  if (nameLower.includes('legacy') || nameLower.includes('old')) tags.add('legacy');

  // Flag missing owner email
  if (!app.ownerEmail || app.ownerEmail === '') tags.add('missing-owner-email');

  // Flag stale apps (no review recently — if we have date info)
  if (app.userPopulation === 0 && app.riskTier !== 'low') tags.add('needs-user-count-validation');

  return {
    ...app,
    tags: Array.from(tags),
  };
}

/**
 * Infer risk tier from app characteristics if not provided.
 */
export function inferRiskTier(app: Partial<Application>): Application['riskTier'] {
  if (app.dataClassification === 'restricted') return 'critical';
  if (app.userPopulation && app.userPopulation > 50000) return 'critical';
  if (app.dataClassification === 'confidential') return 'high';
  if (app.userPopulation && app.userPopulation > 5000) return 'high';
  if (app.appType === 'legacy') return 'high'; // Legacy is always high-risk
  if (app.userPopulation && app.userPopulation > 100) return 'medium';
  return 'low';
}

/**
 * Validate that the application has minimum required fields.
 */
export function validateApplication(app: Partial<Application>): string[] {
  const errors: string[] = [];
  if (!app.name || app.name.trim() === '') errors.push('Application name is required');
  if (!app.owner || app.owner === 'Unknown') errors.push('Application owner is missing');
  if (app.userPopulation === undefined) errors.push('User population is missing');
  return errors;
}
