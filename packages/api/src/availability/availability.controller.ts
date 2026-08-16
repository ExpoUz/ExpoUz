import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AvailabilityService, SlotQuery } from './availability.service';

/**
 * Time-slot availability. Two intents, cleanly separated:
 *   /games — existing matches with real open spots in a window (join)
 *   /slots — verified venues genuinely open and unbooked in a window (create)
 * Public (no auth) — pure discovery, no user data.
 */
@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  private q(
    sport: string,
    date: string,
    from?: string,
    to?: string,
    city?: string,
    district?: string,
    duration?: string,
  ): SlotQuery {
    return {
      sport,
      date,
      from: from || undefined,
      to: to || undefined,
      city: city || undefined,
      district: district || undefined,
      duration: duration ? +duration : undefined,
    };
  }

  @Get('games')
  @ApiOperation({ summary: 'Games joinable in a time window (real open spots)' })
  @ApiQuery({ name: 'sport', required: true })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'district', required: false })
  games(
    @Query('sport') sport: string,
    @Query('date') date: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('city') city?: string,
    @Query('district') district?: string,
  ) {
    return this.availability.getJoinableInWindow(this.q(sport, date, from, to, city, district));
  }

  @Get('slots')
  @ApiOperation({ summary: 'Verified venues free in a time window' })
  @ApiQuery({ name: 'sport', required: true })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'district', required: false })
  @ApiQuery({ name: 'duration', required: false, type: Number })
  slots(
    @Query('sport') sport: string,
    @Query('date') date: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('city') city?: string,
    @Query('district') district?: string,
    @Query('duration') duration?: string,
  ) {
    return this.availability.getFreeSlots(this.q(sport, date, from, to, city, district, duration));
  }

  @Get('counts')
  @ApiOperation({ summary: 'Per-slot chip data: joinable game counts + free indicators' })
  @ApiQuery({ name: 'sport', required: true })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'district', required: false })
  counts(
    @Query('sport') sport: string,
    @Query('date') date: string,
    @Query('city') city?: string,
    @Query('district') district?: string,
  ) {
    return this.availability.getSlotCounts(this.q(sport, date, undefined, undefined, city, district));
  }
}
