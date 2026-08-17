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
 * Guard for every partner-facing `/org/*` endpoint. Runs AFTER JwtAuthGuard, so
 * `req.user` is present. It:
 *   1. resolves the caller's org context from their membership (server-side),
 *   2. attaches it as `req.orgContext = { orgId, role }`,
 *   3. enforces any `@OrgRoles(...)` restriction on the handler/controller.
 *
 * Controllers read `req.orgContext.orgId` via @OrgCtx() — never a route param or
 * body field for the org id.
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

    // Server-side resolution — the ONLY place the tenant boundary is decided.
    const ctx = await this.orgContext.resolveOrgContext(user.id);
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
