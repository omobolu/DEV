import { v4 as uuidv4 } from 'uuid';
import { BuildJob, BuildArtifact, BuildType } from '../build.types';

/**
 * Build Artifact Generator
 *
 * Generates platform-specific configuration artifacts from collected data.
 * Each artifact is a complete, ready-to-apply configuration object.
 */
export class BuildArtifactGenerator {

  generate(job: BuildJob): BuildArtifact[] {
    const artifacts: BuildArtifact[] = [];
    const data = job.collectedData;

    switch (job.buildType) {
      case 'ENTRA_SSO_SAML':
        artifacts.push(this.entraAppRegistration(job, 'SAML'));
        artifacts.push(this.entraSamlConfig(job));
        artifacts.push(this.claimsMapping(job));
        break;

      case 'ENTRA_SSO_OIDC':
        artifacts.push(this.entraAppRegistration(job, 'OIDC'));
        artifacts.push(this.entraOidcConfig(job));
        break;

      case 'ENTRA_SCIM':
        artifacts.push(this.entraScimConfig(job));
        break;

      case 'ENTRA_CONDITIONAL_ACCESS':
        artifacts.push(this.entraConditionalAccessPolicy(job));
        break;

      case 'SAILPOINT_SOURCE_ONBOARDING':
        artifacts.push(this.sailpointSourceConfig(job));
        artifacts.push(this.sailpointCorrelationRule(job));
        artifacts.push(this.sailpointJmlWorkflow(job));
        break;

      case 'SAILPOINT_CERTIFICATION':
        artifacts.push(this.sailpointCertificationCampaign(job));
        break;

      case 'SAILPOINT_RULE_GENERATION':
        artifacts.push(this.sailpointBeanShellRule(job));
        break;

      case 'CYBERARK_SAFE_CREATION':
        artifacts.push(this.cyberArkSafeDesign(job));
        artifacts.push(this.cyberArkAccountList(job));
        break;

      case 'CYBERARK_ACCOUNT_ONBOARDING':
        artifacts.push(this.cyberArkAccountList(job));
        break;

      case 'OKTA_CIAM_FLOW':
        artifacts.push(this.oktaAppConfig(job));
        artifacts.push(this.oktaMfaPolicy(job));
        break;

      default:
        artifacts.push(this.implementationGuide(job));
    }

    return artifacts;
  }

  // ─── Entra Artifacts ───────────────────────────────────────────────────────

  private entraAppRegistration(job: BuildJob, protocol: 'SAML' | 'OIDC'): BuildArtifact {
    return artifact('entra_saml_config', `${job.appName} - Entra App Registration`, 'json', {
      displayName: job.appName,
      signInAudience: 'AzureADMyOrg',
      protocol,
      web: protocol === 'OIDC' ? {
        redirectUris: [job.collectedData['redirect_uri']],
        logoutUrl: job.collectedData['logout_uri'],
      } : undefined,
      identifierUris: protocol === 'SAML' ? [job.collectedData['entity_id']] : undefined,
      _instructions: [
        'Navigate to Entra ID → Enterprise Applications → New Application → Create your own application',
        `Enter display name: "${job.appName}"`,
        protocol === 'SAML' ? 'Select "Integrate any other application you don\'t find in the gallery"' : 'Register application for OIDC',
        'Complete configuration using the SAML/OIDC config artifact below',
      ],
    });
  }

  private entraSamlConfig(job: BuildJob): BuildArtifact {
    return artifact('entra_saml_config', `${job.appName} - SAML Configuration`, 'json', {
      basicSamlConfiguration: {
        identifier: job.collectedData['entity_id'],
        replyUrl: job.collectedData['acs_url'],
        signOnUrl: job.collectedData['sign_on_url'] || null,
        relayState: null,
        logoutUrl: job.collectedData['sign_out_url'] || null,
      },
      userAttributesClaims: {
        nameIdFormat: job.collectedData['name_id_format'] || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        nameIdValue: 'user.userprincipalname',
      },
      _instructions: [
        'In the Enterprise Application → Single sign-on → SAML',
        'Set Identifier (Entity ID) to the value in basicSamlConfiguration.identifier',
        'Set Reply URL (ACS URL) to the value in basicSamlConfiguration.replyUrl',
        'Download the Federation Metadata XML and provide to the application team',
        'Test SAML sign-on before assigning users',
      ],
    });
  }

  private claimsMapping(job: BuildJob): BuildArtifact {
    return artifact('entra_saml_config', `${job.appName} - Claims Mapping`, 'json', {
      claims: [
        { claimName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', source: 'user.displayname' },
        { claimName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', source: 'user.mail' },
        { claimName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname', source: 'user.givenname' },
        { claimName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname', source: 'user.surname' },
        ...(job.collectedData['claims'] ? JSON.parse(String(job.collectedData['claims']) || '[]') : []),
      ],
      _instructions: [
        'In Enterprise App → Single sign-on → Attributes & Claims',
        'Verify standard claims are mapped correctly',
        'Add any custom claims required by the application',
        'Confirm with the application team which attributes they consume',
      ],
    });
  }

  private entraOidcConfig(job: BuildJob): BuildArtifact {
    return artifact('entra_oidc_config', `${job.appName} - OIDC Configuration`, 'json', {
      redirectUris: [job.collectedData['redirect_uri']],
      postLogoutRedirectUris: job.collectedData['logout_uri'] ? [job.collectedData['logout_uri']] : [],
      implicitGrantSettings: { enableAccessTokenIssuance: false, enableIdTokenIssuance: false },
      requiredScopes: ['openid', 'profile', 'email'],
      clientType: job.collectedData['client_secret_required'] === 'yes' ? 'confidential' : 'public',
      _instructions: [
        'Navigate to App Registrations → New Registration',
        `Name: ${job.appName}`,
        'Redirect URI: Web → enter the redirect URI',
        'If confidential client: Certificates & Secrets → New client secret',
        'Copy Application (client) ID and Directory (tenant) ID for the app team',
        'Share OpenID Connect metadata URL: https://login.microsoftonline.com/{tenantId}/v2.0/.well-known/openid-configuration',
      ],
    });
  }

  private entraScimConfig(job: BuildJob): BuildArtifact {
    return artifact('entra_saml_config', `${job.appName} - SCIM Provisioning Configuration`, 'json', {
      provisioningMode: 'Automatic',
      tenantUrl: job.collectedData['scim_tenant_url'],
      secretToken: '*** STORED IN VAULT ***',
      mappings: {
        userMappings: [
          { sourceExpression: 'userPrincipalName', targetAttributeName: 'userName' },
          { sourceExpression: 'displayName', targetAttributeName: 'displayName' },
          { sourceExpression: 'mail', targetAttributeName: 'emails[type eq "work"].value' },
          { sourceExpression: 'givenName', targetAttributeName: 'name.givenName' },
          { sourceExpression: 'surname', targetAttributeName: 'name.familyName' },
          { sourceExpression: 'active', targetAttributeName: 'active' },
        ],
      },
      _instructions: [
        'Enterprise Application → Provisioning → Get Started',
        'Set Provisioning Mode to Automatic',
        'Enter Tenant URL and Secret Token',
        'Click Test Connection to verify',
        'Expand Mappings → Provision Azure Active Directory Users',
        'Verify attribute mappings match application schema',
        `Use test user: ${job.collectedData['scim_test_user']}`,
        'Set Scope to "Sync assigned users and groups"',
        'Start provisioning after pilot validation',
      ],
    });
  }

  private entraConditionalAccessPolicy(job: BuildJob): BuildArtifact {
    return artifact('entra_ca_policy', `${job.appName} - Conditional Access MFA Policy`, 'json', {
      displayName: `MFA - ${job.appName} - All Users`,
      state: 'enabledForReportingButNotEnforced', // Start in report-only mode
      conditions: {
        users: {
          includeGroups: job.collectedData['target_groups']
            ? String(job.collectedData['target_groups']).split(',').map(g => g.trim())
            : ['All'],
          excludeGroups: job.collectedData['exclude_groups']
            ? String(job.collectedData['exclude_groups']).split(',').map(g => g.trim())
            : [],
        },
        applications: {
          includeApplications: [job.collectedData['app_display_name'] || job.appName],
        },
      },
      grantControls: {
        operator: 'OR',
        builtInControls: ['mfa'],
        authenticationStrength: job.collectedData['mfa_strength'] || 'multifactor',
      },
      sessionControls: {
        signInFrequency: { value: 8, type: 'hours' },
        persistentBrowser: { mode: 'never' },
      },
      _instructions: [
        'Navigate to Entra ID → Protection → Conditional Access → New Policy',
        'Set Name as shown in displayName',
        '⚠️ Start in Report-only mode to assess impact before enabling',
        'Assign to target users/groups as specified',
        'Under Cloud apps: select the target application',
        'Under Grant: require MFA',
        'Monitor report-only results for 2 weeks before switching to Enabled',
        'Confirm break-glass accounts are excluded before enabling',
      ],
    });
  }

  // ─── SailPoint Artifacts ───────────────────────────────────────────────────

  private sailpointSourceConfig(job: BuildJob): BuildArtifact {
    return artifact('sailpoint_source', `${job.appName} - SailPoint Source Configuration`, 'json', {
      name: `${job.appName} Source`,
      connectorName: job.collectedData['connector_type'],
      configuration: {
        url: job.collectedData['connection_url'],
        user: job.collectedData['service_account_user'],
        password: '*** STORED IN VAULT ***',
        baseDN: job.collectedData['base_dn'] || undefined,
        searchDN: job.collectedData['base_dn'] || undefined,
      },
      schemas: [{
        objectType: 'account',
        identityAttribute: 'uid',
        attributes: (String(job.collectedData['account_schema'] || 'uid,displayName,email,department')).split(',').map(a => ({
          name: a.trim(),
          type: 'STRING',
        })),
      }],
      _instructions: [
        'SailPoint IdentityNow → Connections → Sources → New Source',
        `Select connector: ${job.collectedData['connector_type']}`,
        'Enter connection URL and service account credentials',
        'Test connection before saving',
        'Configure account schema — verify attributes match',
        'Run initial aggregation after source configuration',
        'Configure correlation rules using the correlation rule artifact',
        'Create provisioning policies for Joiner/Leaver',
      ],
    });
  }

  private sailpointCorrelationRule(job: BuildJob): BuildArtifact {
    const source = `
import sailpoint.object.Identity;
import sailpoint.object.Application;
import java.util.Iterator;
import java.util.ArrayList;
import org.apache.log4j.Logger;

Logger log = Logger.getLogger("rule.${job.appName}.correlation");

// Generated by IDVIZE — ${job.appName} Correlation Rule
// Correlates accounts in ${job.appName} to SailPoint identities

String accountEmail = (String) account.getAttribute("email");
String accountUid = (String) account.getAttribute("uid");

if (accountEmail != null && !accountEmail.isEmpty()) {
  return context.getObjectByName(Identity.class, accountEmail.toLowerCase());
}

if (accountUid != null && !accountUid.isEmpty()) {
  return context.getObjectByName(Identity.class, accountUid.toLowerCase());
}

log.warn("${job.appName} correlation: no match for account " + account.getNativeIdentity());
return null;
`.trim();

    return artifact('sailpoint_rule', `${job.appName} - Correlation Rule (BeanShell)`, 'beanshell', {
      name: `${job.appName} - Account Correlation`,
      type: 'Correlation',
      language: 'beanshell',
      source,
      description: `Auto-generated correlation rule for ${job.appName}`,
      _instructions: [
        'SailPoint → Global Settings → Rules → Create Rule',
        'Select type: Correlation',
        'Paste the BeanShell source from this artifact',
        'Attach rule to the source configuration',
        'Test correlation with a sample account before full aggregation',
      ],
    });
  }

  private sailpointJmlWorkflow(job: BuildJob): BuildArtifact {
    return artifact('sailpoint_workflow', `${job.appName} - JML Workflow`, 'json', {
      name: `${job.appName} - Joiner/Leaver Provisioning`,
      type: 'LCM',
      description: `Automated JML lifecycle workflow for ${job.appName}`,
      triggers: [
        { event: 'IDENTITY_CREATED', action: 'provision_account' },
        { event: 'IDENTITY_ATTRIBUTE_CHANGED', condition: 'department changed', action: 'update_account' },
        { event: 'IDENTITY_DISABLED', action: 'disable_account' },
        { event: 'IDENTITY_DELETED', action: 'delete_account' },
      ],
      _instructions: [
        'SailPoint → Lifecycle Events → Create Event',
        'Define Joiner workflow: trigger on identity create → provision account in this source',
        'Define Mover workflow: trigger on attribute change → update group membership',
        'Define Leaver workflow: trigger on identity disable/delete → disable/remove account',
        'Test all three lifecycle events before activating',
      ],
    });
  }

  private sailpointCertificationCampaign(job: BuildJob): BuildArtifact {
    return artifact('sailpoint_rule', `${job.appName} - Access Certification Campaign`, 'json', {
      name: `${job.appName} - ${job.collectedData['review_frequency'] || 'Quarterly'} Access Review`,
      type: job.collectedData['campaign_type'] || 'SOURCE_OWNER',
      description: `Access certification for ${job.appName} — all accounts and entitlements`,
      campaign_owner: job.collectedData['campaign_owner'],
      deadline_days: job.collectedData['deadline_days'] || 14,
      sources: [job.appName],
      schedule: {
        frequency: job.collectedData['review_frequency'] || 'quarterly',
        startDate: new Date().toISOString().split('T')[0],
      },
      _instructions: [
        'SailPoint → Access Certifications → Create Campaign',
        `Name the campaign as shown`,
        `Set type to ${job.collectedData['campaign_type'] || 'SOURCE_OWNER'}`,
        'Select the source for this application',
        `Assign campaign owner: ${job.collectedData['campaign_owner']}`,
        `Set deadline to ${job.collectedData['deadline_days'] || 14} days`,
        'Configure escalation rules for non-responses',
        'Activate and monitor completion rates',
      ],
    });
  }

  private sailpointBeanShellRule(job: BuildJob): BuildArtifact {
    return artifact('sailpoint_rule', `${job.appName} - Custom BeanShell Rule`, 'beanshell', {
      name: `${job.appName} - AttributeGenerator`,
      type: 'AttributeGenerator',
      source: `// Generated by IDVIZE\nimport sailpoint.object.Identity;\n\n// TODO: Add custom logic\nreturn null;`,
      _instructions: ['Customize the BeanShell rule logic and import via SailPoint Rule XML.'],
    });
  }

  // ─── CyberArk Artifacts ───────────────────────────────────────────────────

  private cyberArkSafeDesign(job: BuildJob): BuildArtifact {
    const safeName = `${job.appName.replace(/\s+/g, '-')}-Privileged`;
    return artifact('cyberark_safe', `${job.appName} - CyberArk Safe Design`, 'json', {
      safeName,
      description: `Privileged accounts for ${job.appName} — managed by IDVIZE`,
      managingCPM: job.collectedData['cpm_name'] || 'PasswordManager',
      numberOfVersionsRetention: 5,
      members: [
        { memberName: 'IAM-Team', memberType: 'Group', permissions: { useAccounts: true, retrieveAccounts: true, listAccounts: true, addAccounts: true, manageSafe: true } },
        { memberName: 'Vault-Admins', memberType: 'Group', permissions: { useAccounts: false, retrieveAccounts: true, listAccounts: true, manageSafe: true } },
      ],
      _instructions: [
        'CyberArk PVWA → Safes → Add Safe',
        `Safe Name: ${safeName}`,
        `Assign Managing CPM: ${job.collectedData['cpm_name'] || 'PasswordManager'}`,
        'Set retention to 5 versions',
        'Add safe members as defined (IAM-Team, Vault-Admins)',
        'After safe creation, onboard accounts using the Account List artifact',
        'Verify CPM rotation runs successfully on first rotation cycle',
      ],
    });
  }

  private cyberArkAccountList(job: BuildJob): BuildArtifact {
    const accounts = String(job.collectedData['privileged_accounts'] || '')
      .split('\n')
      .filter(a => a.trim())
      .map(accountName => ({
        name: accountName.trim(),
        address: job.collectedData['account_hostnames'] || 'TBD',
        userName: accountName.trim(),
        platformId: job.collectedData['platform_id'] || 'WinServerLocal',
        safeName: `${job.appName.replace(/\s+/g, '-')}-Privileged`,
        secretType: 'password',
        automaticManagementEnabled: true,
        rotationDays: job.collectedData['rotation_days'] || 30,
      }));

    return artifact('cyberark_account', `${job.appName} - Privileged Account Onboarding List`, 'json', {
      accounts,
      totalAccounts: accounts.length,
      _instructions: [
        'For each account in the list:',
        'CyberArk PVWA → Accounts → Add Account',
        'Select the safe created in the Safe Design artifact',
        'Enter account details as specified',
        'Set platform and enable automatic management',
        'Verify CPM can connect to the account',
        'Remove direct access to the system after vaulting',
        'Test account retrieval by authorized users',
      ],
    });
  }

  // ─── Okta Artifacts ───────────────────────────────────────────────────────

  private oktaAppConfig(job: BuildJob): BuildArtifact {
    return artifact('okta_app_config', `${job.appName} - Okta CIAM Application`, 'json', {
      label: job.appName,
      signOnMode: job.collectedData['app_type'] === 'spa' ? 'OPENID_CONNECT' : 'OPENID_CONNECT',
      credentials: { scheme: 'IMPLICIT', userNameTemplate: { template: '${source.login}', type: 'BUILT_IN' } },
      settings: {
        oauthClient: {
          redirect_uris: String(job.collectedData['redirect_uris'] || '').split(',').map(u => u.trim()),
          post_logout_redirect_uris: job.collectedData['logout_uri'] ? [job.collectedData['logout_uri']] : [],
          response_types: ['code'],
          grant_types: ['authorization_code', 'refresh_token'],
          application_type: job.collectedData['app_type'] || 'web',
          consent_method: 'TRUSTED',
        },
      },
      _instructions: [
        'Okta Admin Console → Applications → Create App Integration',
        'Select OIDC → Web Application',
        `Name: ${job.appName}`,
        'Enter redirect URIs and logout redirect URIs',
        'Assign to appropriate user groups',
        'Configure sign-on policy for this application',
        'Provide Client ID and Client Secret to application team',
        'Enable refresh token rotation for long-lived sessions',
      ],
    });
  }

  private oktaMfaPolicy(job: BuildJob): BuildArtifact {
    return artifact('okta_app_config', `${job.appName} - Okta MFA Sign-On Policy`, 'json', {
      name: `MFA Policy - ${job.appName}`,
      status: 'ACTIVE',
      rules: [{
        name: 'Require MFA for All',
        conditions: { network: { connection: 'ANYWHERE' } },
        actions: {
          signon: {
            requireFactor: job.collectedData['mfa_required'] !== 'no',
            factorPromptMode: 'ALWAYS',
            session: { usePersistentCookie: false, maxSessionIdleMinutes: 120, maxSessionLifetimeMinutes: 480 },
          },
        },
      }],
      socialProviders: String(job.collectedData['social_providers'] || '').split(',').filter(p => p.trim()),
      _instructions: [
        'Okta → Security → Authentication Policies',
        `Create policy: ${job.collectedData['mfa_required'] === 'no' ? 'passwordless or standard' : 'MFA required'}`,
        'Add catch-all rule requiring MFA',
        'Configure session lifetime as specified',
        'If social providers required, configure Identity Providers',
        'Test with a pilot customer account before full rollout',
      ],
    });
  }

  // ─── Fallback ─────────────────────────────────────────────────────────────

  private implementationGuide(job: BuildJob): BuildArtifact {
    return artifact('documentation', `${job.appName} - Implementation Guide`, 'markdown', {
      title: `IAM Implementation Guide: ${job.appName}`,
      buildType: job.buildType,
      gap: job.controlGap,
      notes: job.collectedData['notes'] || 'No notes provided.',
      generatedAt: new Date().toISOString(),
    });
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function artifact(
  type: BuildArtifact['type'],
  name: string,
  format: BuildArtifact['format'],
  content: Record<string, unknown>
): BuildArtifact {
  return {
    artifactId: uuidv4(),
    type,
    name,
    content,
    format,
    generatedAt: new Date().toISOString(),
    status: 'draft',
  };
}

export const buildArtifactGenerator = new BuildArtifactGenerator();
