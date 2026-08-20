import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrgContactType, OrgPipelineStage, OrgRole, OrgStatus } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Superadmin management of partner organizations (PART 1). SUPER_ADMIN only —
 * this is the cross-tenant view by design. Every write is audit-logged by the
 * AdminAuditInterceptor.
 */
@ApiTags('admin-organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Roles('SUPER_ADMIN')
@Controller('admin/organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List organizations with headline stats' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  list(@Query('search') search?: string, @Query('status') status?: OrgStatus) {
    return this.orgs.list({ search, status });
  }

  @Post()
  @ApiOperation({ summary: 'Create an organization (optionally with a first OWNER)' })
  create(@Req() req: any, @Body() dto: any) {
    return this.orgs.create(req.user.id, dto);
  }

  // ---- partner CRM portfolio (PART 3) — declared before :id so it isn't
  // swallowed by the :id route ----
  @Get('insights')
  @ApiOperation({ summary: 'Portfolio: revenue leaderboard, at-risk, renewals due, funnel' })
  insights() {
    return this.orgs.insights();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Organization overview + terms + stats' })
  getById(@Param('id') id: string) {
    return this.orgs.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contact info / commercial terms' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.orgs.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Suspend / reactivate / archive (existing bookings honoured)' })
  setStatus(@Param('id') id: string, @Body('status') status: OrgStatus) {
    return this.orgs.setStatus(id, status);
  }

  // ---- venues ----
  @Get(':id/venues')
  @ApiOperation({ summary: 'Org venues + unassigned pitches available to attach' })
  getVenues(@Param('id') id: string) {
    return this.orgs.getVenues(id);
  }

  @Post(':id/venues')
  @ApiOperation({ summary: 'Attach (or move, with confirmMove) a venue to this org' })
  assignVenue(
    @Param('id') id: string,
    @Body('pitchId') pitchId: string,
    @Body('confirmMove') confirmMove?: boolean,
  ) {
    return this.orgs.assignVenue(id, pitchId, !!confirmMove);
  }

  @Delete(':id/venues/:pitchId')
  @ApiOperation({ summary: 'Detach a venue from this org' })
  removeVenue(@Param('id') id: string, @Param('pitchId') pitchId: string) {
    return this.orgs.removeVenue(id, pitchId);
  }

  // ---- staff ----
  @Get(':id/staff')
  @ApiOperation({ summary: 'Members + pending invites' })
  getStaff(@Param('id') id: string) {
    return this.orgs.getStaff(id);
  }

  @Post(':id/staff')
  @ApiOperation({ summary: 'Attach an existing user account as a member' })
  attachUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Body('role') role: OrgRole = 'STAFF',
  ) {
    return this.orgs.attachUser(id, userId, role, req.user.id);
  }

  @Post(':id/invites')
  @ApiOperation({ summary: 'Invite staff by phone or Telegram username' })
  invite(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.orgs.invite(id, dto, req.user.id);
  }

  @Delete(':id/invites/:inviteId')
  @ApiOperation({ summary: 'Revoke a pending invite' })
  revokeInvite(@Param('id') id: string, @Param('inviteId') inviteId: string) {
    return this.orgs.revokeInvite(id, inviteId);
  }

  @Patch(':id/staff/:memberId')
  @ApiOperation({ summary: 'Change a member role (takes effect immediately)' })
  changeMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body('role') role: OrgRole,
  ) {
    return this.orgs.changeMemberRole(id, memberId, role);
  }

  @Delete(':id/staff/:memberId')
  @ApiOperation({ summary: 'Remove a member (revokes access immediately)' })
  removeMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.orgs.removeMember(id, memberId);
  }

  // ---- players & revenue ----
  @Get(':id/players')
  @ApiOperation({ summary: 'Players who booked at this org’s venues' })
  getPlayers(@Param('id') id: string) {
    return this.orgs.getPlayers(id);
  }

  @Get(':id/revenue')
  @ApiOperation({ summary: 'Revenue + commission per venue' })
  getRevenue(@Param('id') id: string) {
    return this.orgs.getRevenue(id);
  }

  // ---- partner CRM (PART 3) ----
  @Get(':id/crm')
  @ApiOperation({ summary: 'Contact log + follow-up + health indicators' })
  getCrm(@Param('id') id: string) {
    return this.orgs.getCrm(id);
  }

  @Post(':id/contacts')
  @ApiOperation({ summary: 'Log a call / meeting / email / note (optionally set follow-up)' })
  addContact(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: { type?: OrgContactType; summary: string; followUpDate?: string | null },
  ) {
    return this.orgs.addContact(id, req.user.id, dto);
  }

  @Patch(':id/pipeline')
  @ApiOperation({ summary: 'Move the org along the sales pipeline' })
  setPipeline(@Param('id') id: string, @Body('stage') stage: OrgPipelineStage) {
    return this.orgs.setPipeline(id, stage);
  }

  @Patch(':id/followup')
  @ApiOperation({ summary: 'Set / clear the next follow-up and its owner' })
  setFollowUp(
    @Param('id') id: string,
    @Body() dto: { date: string | null; userId?: string | null },
  ) {
    return this.orgs.setFollowUp(id, dto);
  }
}
