import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OrgContext } from '../org-context.service';

/**
 * Injects the server-resolved `{ orgId, role }` attached by OrgGuard. Use this
 * for the org id — NEVER read it from a route param or request body.
 */
export const OrgCtx = createParamDecorator(
  (data: keyof OrgContext | undefined, ctx: ExecutionContext): OrgContext | string => {
    const req = ctx.switchToHttp().getRequest();
    const orgContext: OrgContext = req.orgContext;
    return data ? orgContext?.[data] : orgContext;
  },
);
