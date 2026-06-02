import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from './jwt.strategy';
import { ROLES_KEY } from './roles.decorator';

/**
 * Checks the `@Roles(...)` metadata against the ZITADEL roles claim on the
 * authenticated user. Must run AFTER JwtAuthGuard so `request.user` is set.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const granted = Object.keys(user?.roles ?? {});
    if (required.some((role) => granted.includes(role))) return true;

    throw new ForbiddenException(
      `Requires one of the following roles: ${required.join(', ')}`,
    );
  }
}
