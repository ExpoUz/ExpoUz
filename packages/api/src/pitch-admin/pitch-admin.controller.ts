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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('pitch-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PITCH_OWNER', 'ADMIN', 'SUPER_ADMIN')
@Controller('pitch-admin')
export class PitchAdminController {
  constructor(private readonly pitchAdminService: PitchAdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Pitch owner dashboard stats' })
  getDashboard(@CurrentUser() user: any) {
    return this.pitchAdminService.getDashboard(user.id);
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
  @ApiOperation({ summary: 'Toggle pitch active/inactive' })
  updatePitchAvailability(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.pitchAdminService.updatePitchAvailability(user.id, id, isActive);
  }

  @Patch('pitches/:id/opening-hours')
  @ApiOperation({ summary: 'Set operating hours + slot/court config for a venue' })
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
  @ApiOperation({ summary: 'Get players who have booked at owned pitches' })
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
  @ApiOperation({ summary: 'Get unique players on owner pitches (legacy endpoint)' })
  getPlayers(@CurrentUser() user: any) {
    return this.pitchAdminService.getPlayers(user.id);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue breakdown' })
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
