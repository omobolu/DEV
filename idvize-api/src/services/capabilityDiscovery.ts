import { Application, AppCapability, CapabilityProtocol } from '../types';
import { applications } from '../data/applications';

/**
 * Discover integration capabilities for an application.
 * Phase 1: Returns from data store (mock).
 * Phase 2: Will perform live HTTP probing (OIDC discovery URL, SAML metadata, SCIM probe).
 */
export function discoverCapabilities(appId: string): AppCapability | null {
  const app = applications.find(a => a.id === appId);
  if (!app) return null;

  return buildCapabilityProfile(app);
}

export function discoverAllCapabilities(): AppCapability[] {
  return applications.map(buildCapabilityProfile);
}

function buildCapabilityProfile(app: Application): AppCapability {
  const profile: AppCapability = {
    appId: app.id,
    appName: app.name,
    detectedProtocols: app.capabilities,
    detectionMethod: 'cmdb',
    confidence: computeConfidence(app),
    lastScanned: new Date().toISOString(),
  };

  if (app.capabilities.includes('OIDC')) {
    profile.oidcMetadataUrl = `https://${slugify(app.name)}/.well-known/openid-configuration`;
  }
  if (app.capabilities.includes('SAML')) {
    profile.samlMetadataUrl = `https://${slugify(app.name)}/saml/metadata`;
  }
  if (app.capabilities.includes('SCIM')) {
    profile.scimEndpoint = `https://${slugify(app.name)}/scim/v2`;
  }
  if (app.capabilities.includes('REST')) {
    profile.apiEndpoint = `https://${slugify(app.name)}/api/v1`;
  }

  return profile;
}

/**
 * Assess confidence based on how recent the review was and available capabilities.
 */
function computeConfidence(app: Application): number {
  let score = 40; // base
  if (app.capabilities.length > 0) score += 20;
  if (app.capabilities.length > 1) score += 10;
  if (app.lastReviewed) {
    const daysSince = (Date.now() - new Date(app.lastReviewed).getTime()) / 86400000;
    if (daysSince < 90) score += 20;
    else if (daysSince < 365) score += 10;
  }
  if (app.source === 'CMDB') score += 10;
  return Math.min(score, 100);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Recommend the best integration path given detected capabilities.
 */
export function recommendIntegrationPath(protocols: CapabilityProtocol[]): string {
  if (protocols.includes('OIDC') && protocols.includes('SCIM')) {
    return 'OIDC for SSO/MFA + SCIM for automated provisioning — optimal path.';
  }
  if (protocols.includes('OIDC')) {
    return 'OIDC for SSO/MFA. SCIM not detected — consider manual provisioning or scripted connector.';
  }
  if (protocols.includes('SAML') && protocols.includes('SCIM')) {
    return 'SAML for SSO + SCIM for automated provisioning.';
  }
  if (protocols.includes('SAML')) {
    return 'SAML for SSO. No SCIM — manual provisioning or connector required.';
  }
  if (protocols.includes('REST')) {
    return 'REST API available — build custom connector for provisioning. No native SSO protocol detected.';
  }
  return 'No standard IAM protocols detected. Manual process or identity gateway required. Conduct integration assessment.';
}
