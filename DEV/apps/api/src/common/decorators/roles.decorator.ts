import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Roles are plain strings, not an enum — CoShare's role model isn't confirmed yet
 * (see auth/auth.types.ts). Update once the real role claim values are known.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
