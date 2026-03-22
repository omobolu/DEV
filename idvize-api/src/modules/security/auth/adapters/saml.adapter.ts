/**
 * SAML Adapter — Stub
 *
 * Phase 1: Not implemented. Throws 501 with guidance.
 * Phase 2: Implement using `passport-saml` or `samlify`.
 *
 * SAML flow outline for Phase 2:
 *  1. SP-initiated SSO: redirect user to IdP with SAMLRequest
 *  2. IdP posts SAMLResponse to /security/auth/saml/callback
 *  3. Parse and verify assertion, extract user attributes
 *  4. Map IdP NameID / attributes to IDVIZE User via authRepository
 *  5. Issue JWT via oidcAdapter.issueToken()
 */

export class SamlAdapter {
  initiateLogin(_idpMetadataUrl: string): never {
    throw Object.assign(
      new Error('SAML SSO is not yet implemented. Phase 2: integrate passport-saml.'),
      { statusCode: 501 },
    );
  }

  processCallback(_samlResponse: string): never {
    throw Object.assign(
      new Error('SAML callback processing is not yet implemented. Phase 2: integrate passport-saml.'),
      { statusCode: 501 },
    );
  }
}

export const samlAdapter = new SamlAdapter();
