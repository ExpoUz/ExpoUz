import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PitchAdminService } from './pitch-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrgGuard } from '../org/org.guard';
import { OrgRoles } from '../org/decorators/org-roles.decorator';

// Access is authorized by ORG MEMBERSHIP (or legacy venue ownership), resolved
// server-side per request by OrgGuard — not by platform UserRole. So an invited
// MANAGER/STAFF who is otherwise a PLAYER can use the panel. OrgGuard 403s
// non-members and suspended orgs; @OrgRoles gates the role-restricted routes
// (revenue/CRM/venue-editing = OWNER|MANAGER, staff management = OWNER). Routes
// with no @OrgRoles are open to any member, including STAFF (schedule/check-in).
// Services still re-resolve + assert roles (defence in depth).
@ApiTags('pitch-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgGuard)
@Controller('pitch-admin')
export class PitchAdminController {
  constructor(private readonly pitchAdminService: PitchAdminService) {}

  @Get('context')
  @ApiOperation({ summary: 'Resolve the org identity + role for the partner panel shell' })
  getContext(@CurrentUser() user: any) {
    return this.pitchAdminService.getContext(user.id);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Pitch owner dashboard stats' })
  getDashboard(@CurrentUser() user: any) {
    return this.pitchAdminService.getDashboard(user.id);
  }

  // ─── Staff management (OWNER only) ────────────────────────────────────────
  @Get('staff')
  @OrgRoles('OWNER')
  @ApiOperation({ summary: 'List org members + pending invites (OWNER only)' })
  getStaff(@CurrentUser() user: any) {
    return this.pitchAdminService.getStaff(user.id);
  }

  @Post('staff/invites')
  @OrgRoles('OWNER')
  @ApiOperation({ summary: 'Invite a staff member by phone or Telegram (OWNER only)' })
  inviteStaff(@CurrentUser() user: any, @Body() dto: any) {
    return this.pitchAdminService.inviteStaff(user.id, dto);
  }

  @Delete('staff/invites/:inviteId')
  @OrgRoles('OWNER')
  @ApiOperation({ summary: 'Revoke a pending invite (OWNER only)' })
  revokeInvite(@CurrentUser() user: any, @Param('inviteId') inviteId: string) {
    return this.pitchAdminService.revokeInvite(user.id, inviteId);
  }

  @Patch('staff/:memberId')
  @OrgRoles('OWNER')
  @ApiOperation({ summary: 'Change a member role (OWNER only)' })
  changeStaffRole(@CurrentUser() user: any, @Param('memberId') memberId: string, @Body('role') role: any) {
    return this.pitchAdminService.changeStaffRole(user.id, memberId, role);
  }

  @Delete('staff/:memberId')
  @OrgRoles('OWNER')
  @ApiOperation({ summary: 'Remove a member (OWNER only)' })
  removeStaff(@CurrentUser() user: any, @Param('memberId') memberId: string) {
    return this.pitchAdminService.removeStaff(user.id, memberId);
  }

  @Get('pitches')
  @ApiOperation({ summary: 'Get owned pitches' })
  getPitches(@CurrentUser() user: any) {
    return this.pitchAdminService.getPitches(user.id);
  }

  @Get('pitches/:id')
  @ApiOperation({ summary: 'Pitch detail: today schedule, upcoming events, amenities' })
  getPitchDetail(@CurrentUser() user: any, @Param('id') id: string) {
    return this.pitchAdminService.getPitchDetail(user.id, id);
  }

  @Patch('pitches/:id/availability')
  @OrgRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Toggle pitch active/inactive (no STAFF)' })
  updatePitchAvailability(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.pitchAdminService.updatePitchAvailability(user.id, id, isActive);
  }

  @Patch('pitches/:id/opening-hours')
  @OrgRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Set operating hours + slot/court config for a venue (no STAFF)' })
  updateOpeningHours(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { openingHours?: any; slotDuration?: number; courtCount?: number },
  ) {
    return this.pitchAdminService.updateOpeningHours(user.id, id, body);
  }

  @Get('matches')
  @ApiOperation({ summary: 'Get matches on owned pitches' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMatches(
    @CurrentUser() user: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.pitchAdminService.getMatches(user.id, +page, +limit);
  }

  @Delete('matches/:id')
  @ApiOperation({ summary: 'Cancel a match on owned pitch' })
  cancelMatch(@CurrentUser() user: any, @Param('id') id: string) {
    return this.pitchAdminService.cancelMatchOnPitch(user.id, id);
  }

  @Get('pitch-bookings')
  @ApiOperation({ summary: 'Get pitch-hire bookings on owned pitches' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'pitchId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getPitchBookings(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('pitchId') pitchId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.pitchAdminService.getPitchBookings(user.id, {
      status,
      pitchId,
      page: +page,
      limit: +limit,
    });
  }

  @Delete('pitch-bookings/:id')
  @ApiOperation({ summary: 'Cancel a pitch-hire booking on owned pitch' })
  cancelPitchBooking(@CurrentUser() user: any, @Param('id') id: string) {
    return this.pitchAdminService.cancelPitchBooking(user.id, id);
  }

  @Get('users')
  @OrgRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get players who have booked at owned pitches (no STAFF)' })
  @ApiQuery({ name: 'pitchId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getPitchUsers(
    @CurrentUser() user: any,
    @Query('pitchId') pitchId?: string,
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.pitchAdminService.getPitchUsers(user.id, {
      pitchId,
      search,
      page: +page,
      limit: +limit,
    });
  }

  @Get('players')
  @OrgRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get unique players on owner pitches (legacy endpoint, no STAFF)' })
  getPlayers(@CurrentUser() user: any) {
    return this.pitchAdminService.getPlayers(user.id);
  }

  @Get('revenue')
  @OrgRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Get revenue breakdown (no STAFF)' })
  getRevenue(@CurrentUser() user: any) {
    return this.pitchAdminService.getRevenue(user.id);
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Get booking schedule for date range' })
  @ApiQuery({ name: 'from', required: true, type: String })
  @ApiQuery({ name: 'to', required: true, type: String })
  getSchedule(
    @CurrentUser() user: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.pitchAdminService.getSchedule(user.id, from, to);
  }
}
