import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Require the caller's ZITADEL token to grant at least one of these roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
