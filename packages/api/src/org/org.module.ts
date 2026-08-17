import { Module } from '@nestjs/common';
import { OrgContextService } from './org-context.service';
import { OrgInviteService } from './org-invite.service';
import { OrgInviteController } from './org-invite.controller';
import { OrgGuard } from './org.guard';

/**
 * Core multi-tenant primitives: the org-context resolver, the OrgGuard that
 * every `/org/*` controller applies, and invite acceptance. Partner-panel and
 * superadmin feature modules import this to reuse OrgContextService.
 */
@Module({
  controllers: [OrgInviteController],
  providers: [OrgContextService, OrgInviteService, OrgGuard],
  exports: [OrgContextService, OrgGuard],
})
export class OrgModule {}
