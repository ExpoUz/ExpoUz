import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CrmService } from './crm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Venue CRM endpoints. Scoped to the caller's ORGANISATION (or legacy owned
 * venues) inside the service — a client-supplied id can never widen access, and
 * STAFF are rejected there. Access is by membership, so JWT-only here.
 */
@ApiTags('pitch-admin-crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pitch-admin')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('players')
  @ApiOperation({ summary: 'CRM list of players who book at the owner’s venues' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'segment', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: ['recent', 'games', 'spent'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listPlayers(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('segment') segment?: string,
    @Query('sort') sort?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.crm.listPlayers(user.id, { search, segment, sort, page: +page, limit: +limit });
  }

  // NOTE: static sub-paths MUST precede the ':id' route so they aren't captured.
  @Get('players/segments')
  @ApiOperation({ summary: 'Player counts per segment' })
  getSegments(@CurrentUser() user: any) {
    return this.crm.getSegments(user.id);
  }

  @Get('insights')
  @ApiOperation({ summary: 'Retention summary the owner can act on' })
  getInsights(@CurrentUser() user: any) {
    return this.crm.getInsights(user.id);
  }

  @Get('broadcast/audience')
  @ApiOperation({ summary: 'Per-segment recipient counts (excludes muted players)' })
  getBroadcastAudience(@CurrentUser() user: any) {
    return this.crm.getBroadcastCounts(user.id);
  }

  @Post('broadcast')
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Message a segment (weekly-limited, mute-aware, logged)' })
  broadcast(
    @CurrentUser() user: any,
    @Body('segment') segment: string,
    @Body('message') message: string,
  ) {
    return this.crm.broadcast(user.id, segment ?? 'ALL', message);
  }

  @Get('players/:id')
  @ApiOperation({ summary: 'Player detail (only if a relationship exists)' })
  getPlayer(@CurrentUser() user: any, @Param('id') id: string) {
    return this.crm.getPlayerDetail(user.id, id);
  }

  @Get('players/:id/history')
  @ApiOperation({ summary: 'The player’s bookings at THIS owner’s venues only' })
  getHistory(@CurrentUser() user: any, @Param('id') id: string) {
    return this.crm.getPlayerHistory(user.id, id);
  }

  @Get('players/:id/notes')
  @ApiOperation({ summary: 'Private notes about this player (owner-only)' })
  getNotes(@CurrentUser() user: any, @Param('id') id: string) {
    return this.crm.listNotes(user.id, id);
  }

  @Post('players/:id/notes')
  @ApiOperation({ summary: 'Add a private note about this player' })
  addNote(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('note') note: string,
    @Body('pitchId') pitchId?: string,
  ) {
    return this.crm.addNote(user.id, id, note, pitchId);
  }

  @Post('players/:id/reveal')
  @Throttle({ default: { limit: 20, ttl: 3600000 } })
  @ApiOperation({ summary: 'Reveal the player’s phone (±7-day booking window, audited)' })
  reveal(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.crm.revealContact(user.id, id, reason);
  }

  @Post('players/:id/message')
  @ApiOperation({ summary: 'Open/send an in-app message to the player' })
  message(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.crm.messagePlayer(user.id, id, content);
  }
}
