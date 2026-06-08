import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { QueryMatchesDto } from './dto/query-matches.dto';
import { RatePlayerDto } from './dto/rate-player.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({ summary: 'Find matches with filters' })
  findAll(@Query() query: QueryMatchesDto) {
    return this.matchesService.findAll(query);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get today matches' })
  findToday() {
    return this.matchesService.findToday();
  }

  // NOTE: static/prefixed routes must precede the ':id' route so 'code'/'pricing'
  // are not captured as an :id param.
  @Get('code/:shareCode')
  @ApiOperation({ summary: 'Get match by invite/share code' })
  findByShareCode(@Param('shareCode') shareCode: string) {
    return this.matchesService.findByShareCode(shareCode);
  }

  @Post('pricing/calculate')
  @ApiOperation({ summary: 'Preview pricing for a booking type before creating' })
  calculatePricing(@Body() body: any) {
    return this.matchesService.calculatePricingPreview(body);
  }

  @Post('join/code/:shareCode')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a match via invite/share code' })
  joinByShareCode(
    @Param('shareCode') shareCode: string,
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.matchesService.joinByShareCode(shareCode, user.id, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get match by ID' })
  findOne(@Param('id') id: string) {
    return this.matchesService.findOne(id);
  }

  @Get(':id/share')
  @ApiOperation({ summary: 'Get share link + code for a match' })
  getShareLink(@Param('id') id: string) {
    return this.matchesService.getShareLink(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new match' })
  create(@CurrentUser() user: any, @Body() dto: CreateMatchDto) {
    return this.matchesService.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a match' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: Partial<CreateMatchDto>,
  ) {
    return this.matchesService.update(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a match' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.matchesService.cancel(id, user.id);
  }

  @Get(':id/players')
  @ApiOperation({ summary: 'Get confirmed players for a match' })
  getPlayers(@Param('id') id: string) {
    return this.matchesService.getPlayers(id);
  }

  @Get(':id/formation')
  @ApiOperation({ summary: 'Get match formation with positions' })
  getFormation(@Param('id') id: string) {
    return this.matchesService.getFormation(id);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a match' })
  join(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('positionId') positionId?: string,
    @Body('teamSide') teamSide?: string,
  ) {
    return this.matchesService.join(id, user.id, positionId, teamSide);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a match' })
  leave(@Param('id') id: string, @CurrentUser() user: any) {
    return this.matchesService.leave(id, user.id);
  }

  @Post(':id/check-in/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check in a player (host only)' })
  checkIn(
    @Param('id') id: string,
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: any,
  ) {
    return this.matchesService.checkIn(id, bookingId, user.id);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark match as completed (host only)' })
  complete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.matchesService.complete(id, user.id);
  }

  @Get(':id/qr/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get QR code for booking' })
  getQr(
    @Param('id') id: string,
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: any,
  ) {
    return this.matchesService.getQr(id, bookingId, user.id);
  }

  @Post(':id/rate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rate players after match' })
  ratePlayers(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('ratings') ratings: RatePlayerDto[],
  ) {
    return this.matchesService.ratePlayers(id, user.id, ratings);
  }
}
