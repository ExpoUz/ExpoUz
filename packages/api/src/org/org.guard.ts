import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { OrgContextService } from './org-context.service';
import { ORG_ROLES_KEY } from './decorators/org-roles.decorator';

/**
 * Guard for every partner-facing panel endpoint. Runs AFTER JwtAuthGuard, so
 * `req.user` is present. It:
 *   1. resolves the caller's portal context server-side from their membership
 *      (or legacy venue ownership) — the ONLY place the tenant boundary is set,
 *   2. rejects non-members and SUSPENDED/ARCHIVED orgs (403),
 *   3. attaches it as `req.orgContext` (PortalContext),
 *   4. enforces any `@OrgRoles(...)` restriction on the handler/controller.
 *
 * Uses resolvePortalContext (not resolveOrgContext) so pre-migration owners with
 * no OrgMember row yet keep working — matching what the services resolve. For a
 * legacy owner `orgId` is null and `role` is OWNER.
 *
 * Controllers read the org via @OrgCtx() — never a route param or body field.
 */
@Injectable()
export class OrgGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private orgContext: OrgContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.id) throw new ForbiddenException('Not authenticated');

    // Server-side resolution — legacy-aware, and throws for suspended/non-members.
    const ctx = await this.orgContext.resolvePortalContext(user.id);
    req.orgContext = ctx;

    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(
      ORG_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles?.length && !requiredRoles.includes(ctx.role)) {
      throw new ForbiddenException('Insufficient organization role');
    }
    return true;
  }
}
