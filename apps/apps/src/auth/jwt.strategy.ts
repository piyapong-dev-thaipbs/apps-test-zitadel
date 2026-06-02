import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * ZITADEL roles claim. Roles arrive as an object keyed by role name.
 */
const ROLES_CLAIM = 'urn:zitadel:iam:org:project:roles';

export interface AuthUser {
  sub: string;
  email?: string;
  username?: string;
  roles: Record<string, unknown>;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'zitadel-jwt') {
  constructor(config: ConfigService) {
    const domain = config.getOrThrow<string>('ZITADEL_DOMAIN');
    const apiClientId = config.getOrThrow<string>('ZITADEL_API_CLIENT_ID');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Fetch + cache ZITADEL's signing keys; verify the RS256 signature.
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${domain}/oauth/v2/keys`,
      }),
      issuer: domain,
      // If you get `jwt audience invalid`, log the decoded `aud` and set this
      // to whatever ZITADEL actually put there (often the API app Client ID
      // or the project id). You can also pass an array of accepted values.
      audience: apiClientId,
      algorithms: ['RS256'],
    });
  }

  // Return value becomes request.user.
  validate(payload: Record<string, any>): AuthUser {
    return {
      sub: payload.sub,
      email: payload.email,
      username: payload['preferred_username'],
      roles: payload[ROLES_CLAIM] ?? {},
    };
  }
}
