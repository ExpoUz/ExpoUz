import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PortalContext } from '../org-context.service';

/**
 * Injects the server-resolved portal context attached by OrgGuard
 * (`{ legacy, orgId, role, org, pitchWhere }`). `@OrgCtx('orgId')` gives the
 * tenant id (null for a legacy owner) — NEVER read it from a route param or body.
 */
export const OrgCtx = createParamDecorator(
  (data: keyof PortalContext | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const orgContext: PortalContext = req.orgContext;
    return data ? orgContext?.[data] : orgContext;
  },
);
