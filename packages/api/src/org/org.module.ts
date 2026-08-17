import { Module } from '@nestjs/common';
import { OrgContextService } from './org-context.service';
import { OrgGuard } from './org.guard';

/**
 * Core multi-tenant primitives: the org-context resolver and the OrgGuard that
 * every `/org/*` controller applies. Partner-panel and superadmin feature
 * modules import this to reuse OrgContextService.
 */
@Module({
  providers: [OrgContextService, OrgGuard],
  exports: [OrgContextService, OrgGuard],
})
export class OrgModule {}
