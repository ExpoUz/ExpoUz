import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrmService } from './crm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Player-facing privacy controls over venue CRM. These protect the player FROM
 * the venues: mute a venue's broadcasts, or report a venue for misuse. Scoped to
 * the authenticated player — the ownerId in the path is only ever used together
 * with the caller's own id, and a real booking relationship is required.
 */
@ApiTags('venue-privacy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('venues')
export class VenuePrivacyController {
  constructor(private readonly crm: CrmService) {}

  @Get('muted')
  @ApiOperation({ summary: 'Venues whose broadcasts I have muted' })
  listMutes(@CurrentUser() user: any) {
    return this.crm.listPlayerMutes(user.id);
  }

  @Post(':ownerId/mute')
  @ApiOperation({ summary: 'Mute broadcasts from this venue' })
  mute(@CurrentUser() user: any, @Param('ownerId') ownerId: string) {
    return this.crm.mutePlayerBroadcast(user.id, ownerId);
  }

  @Delete(':ownerId/mute')
  @ApiOperation({ summary: 'Un-mute broadcasts from this venue' })
  unmute(@CurrentUser() user: any, @Param('ownerId') ownerId: string) {
    return this.crm.unmutePlayerBroadcast(user.id, ownerId);
  }

  @Post(':ownerId/report')
  @ApiOperation({ summary: 'Report this venue for misuse (reaches platform admin)' })
  report(
    @CurrentUser() user: any,
    @Param('ownerId') ownerId: string,
    @Body('reason') reason: string,
  ) {
    return this.crm.reportVenue(user.id, ownerId, reason);
  }
}
