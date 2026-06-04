import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * ZITADEL project roles claim. Roles arrive as an object keyed by role name.
 * The generic key is used for the primary/single project; some instances emit
 * a project-scoped key instead (`...:project:{id}:roles`).
 */
const ROLES_CLAIM = 'urn:zitadel:iam:org:project:roles';

export interface AuthUser {
  sub: string;
  email?: string;
  username?: string;
  roles: Record<string, unknown>;
}

/** Pull the roles object out of a claims set, tolerating the project-scoped key. */
function extractRoles(claims: Record<string, unknown>): Record<string, unknown> {
  if (claims[ROLES_CLAIM] && typeof claims[ROLES_CLAIM] === 'object') {
    return claims[ROLES_CLAIM] as Record<string, unknown>;
  }
  const scopedKey = Object.keys(claims).find(
    (k) => k.includes('project') && k.endsWith(':roles'),
  );
  return scopedKey
    ? ((claims[scopedKey] as Record<string, unknown>) ?? {})
    : {};
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'zitadel-jwt') {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly domain: string;
  // token -> { roles, expiry(ms) }; avoids hitting userinfo on every request.
  private readonly userinfoCache = new Map<
    string,
    { roles: Record<string, unknown>; exp: number }
  >();

  constructor(config: ConfigService) {
    const domain = config.getOrThrow<string>('ZITADEL_DOMAIN');
    const apiClientId = config.getOrThrow<string>('ZITADEL_API_CLIENT_ID');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${domain}/oauth/v2/keys`,
      }),
      issuer: domain,
      audience: apiClientId,
      algorithms: ['RS256'],
      passReqToCallback: true,
    });

    this.domain = domain;
  }

  // Return value becomes request.user.
  async validate(
    req: Request,
    payload: Record<string, unknown>,
  ): Promise<AuthUser> {
    let roles = extractRoles(payload);

    // ZITADEL often asserts roles only into the ID token / userinfo, not the
    // access token. If the JWT carries none, fall back to the userinfo endpoint.
    if (Object.keys(roles).length === 0) {
      const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      if (token) roles = await this.fetchRolesFromUserinfo(token);
    }

    return {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      username: payload['preferred_username'] as string | undefined,
      roles,
    };
  }

  private async fetchRolesFromUserinfo(
    token: string,
  ): Promise<Record<string, unknown>> {
    const now = Date.now();
    const cached = this.userinfoCache.get(token);
    if (cached && cached.exp > now) return cached.roles;

    try {
      const res = await fetch(`${this.domain}/oidc/v1/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        this.logger.warn(`userinfo lookup failed: ${res.status}`);
        return {};
      }
      const info = (await res.json()) as Record<string, unknown>;
      const roles = extractRoles(info);
      this.logger.log(`roles from userinfo: ${JSON.stringify(roles)}`);
      this.userinfoCache.set(token, { roles, exp: now + 60_000 });
      return roles;
    } catch (err) {
      this.logger.warn(`userinfo lookup error: ${String(err)}`);
      return {};
    }
  }
}
