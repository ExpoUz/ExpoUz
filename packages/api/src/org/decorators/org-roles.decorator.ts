import { SetMetadata } from '@nestjs/common';
import { OrgRole } from '@prisma/client';

export const ORG_ROLES_KEY = 'orgRoles';

/**
 * Restrict an `/org/*` endpoint to the given org roles. Applied alongside
 * OrgGuard, which resolves the caller's role from their membership and enforces
 * this list. With no decorator, any active member may access the route.
 */
export const OrgRoles = (...roles: OrgRole[]) => SetMetadata(ORG_ROLES_KEY, roles);

export { OrgRole };
