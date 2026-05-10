import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PitchAdminService } from './pitch-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('pitch-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PITCH_OWNER', 'ADMIN')
@Controller('pitch-admin')
export class PitchAdminController {
  constructor(private readonly pitchAdminService: PitchAdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Pitch owner dashboard stats' })
  getDashboard(@CurrentUser() user: any) {
    return this.pitchAdminService.getDashboard(user.id);
  }

  @Get('pitches')
  @ApiOperation({ summary: 'Get owner pitches' })
  getPitches(@CurrentUser() user: any) {
    return this.pitchAdminService.getPitches(user.id);
  }

  @Get('matches')
  @ApiOperation({ summary: 'Get matches on owner pitches' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMatches(
    @CurrentUser() user: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.pitchAdminService.getMatches(user.id, +page, +limit);
  }

  @Get('players')
  @ApiOperation({ summary: 'Get unique players on owner pitches' })
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
