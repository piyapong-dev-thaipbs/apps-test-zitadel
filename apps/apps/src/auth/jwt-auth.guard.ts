import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('zitadel-jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  // Surface WHY a token was rejected (audience/issuer/format/expiry) instead of
  // an opaque 401. The reason ends up in the API log and the 401 response body.
  override handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser,
    info: { message?: string } | undefined,
    _context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const reason: string =
        info?.message || err?.message || 'No or invalid bearer token';
      this.logger.warn(`JWT auth failed: ${reason}`);
      throw err instanceof Error ? err : new UnauthorizedException(reason);
    }
    return user;
  }
}
