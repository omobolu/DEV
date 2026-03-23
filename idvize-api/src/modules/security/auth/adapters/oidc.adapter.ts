/**
 * OIDC Adapter — Mock Implementation
 *
 * Phase 1: issues signed JWTs from the in-memory user store.
 * Phase 2: replace mock methods with real Okta/Entra OIDC flows
 *   using the same interface without changing callers.
 *
 * Supports:
 *  - Password grant (mock — development only)
 *  - Token verification
 *  - OIDC discovery document
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { TokenClaims, User } from '../../security.types';
import { secretsService } from '../../secrets/secrets.service';
import { resolvePermissions } from '../../authz/permission-matrix';

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

const TOKEN_TTL_SECONDS = 28800; // 8 hours (dev-friendly)

class OidcAdapter {
  private signingSecret: string | null = null;

  private async getSecret(): Promise<string> {
    if (!this.signingSecret) {
      this.signingSecret = await secretsService.get('JWT_SIGNING_SECRET');
    }
    return this.signingSecret;
  }

  /**
   * Issue a signed JWT for the given user.
   */
  async issueToken(user: User): Promise<TokenResponse> {
    const secret = await this.getSecret();
    const sessionId = uuidv4();
    const permissions = resolvePermissions(user.roles);

    const claims: TokenClaims = {
      sub: user.userId,
      email: user.email,
      name: user.displayName,
      roles: user.roles,
      permissions,
      sessionId,
    };

    const access_token = jwt.sign(claims, secret, {
      expiresIn: TOKEN_TTL_SECONDS,
      issuer: 'idvize-iam-platform',
      audience: 'idvize-api',
    });

    return { access_token, token_type: 'Bearer', expires_in: TOKEN_TTL_SECONDS, scope: 'openid profile email' };
  }

  /**
   * Verify and decode a JWT. Returns null if invalid or expired.
   */
  async verifyToken(token: string): Promise<TokenClaims | null> {
    try {
      const secret = await this.getSecret();
      const decoded = jwt.verify(token, secret, {
        issuer: 'idvize-iam-platform',
        audience: 'idvize-api',
      }) as TokenClaims;
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * OIDC Discovery Document (mock).
   * Phase 2: redirect to real provider discovery URL.
   */
  getDiscoveryDocument(baseUrl: string) {
    return {
      issuer: 'idvize-iam-platform',
      authorization_endpoint: `${baseUrl}/security/auth/oidc/authorize`,
      token_endpoint: `${baseUrl}/security/auth/token`,
      userinfo_endpoint: `${baseUrl}/security/auth/me`,
      jwks_uri: `${baseUrl}/security/auth/oidc/jwks`,
      response_types_supported: ['code', 'token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['HS256'],
      scopes_supported: ['openid', 'profile', 'email'],
      grant_types_supported: ['authorization_code', 'password'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      claims_supported: ['sub', 'email', 'name', 'roles', 'permissions'],
    };
  }
}

export const oidcAdapter = new OidcAdapter();
