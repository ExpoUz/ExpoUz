import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a booking for a match' })
  create(@CurrentUser() user: any, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.id, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get current user bookings' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findMine(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.bookingsService.findMine(user.id, { status, page: page ? +page : 1, limit: limit ? +limit : 20 });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking details' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookingsService.findOne(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a booking' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookingsService.cancel(id, user.id);
  }

  // ─── Venue-admin actions (org-scoped inside the service) ───

  @Post('phone/reserve')
  @ApiOperation({ summary: 'Reserve N places for a caller (phone booking)' })
  reservePhone(
    @CurrentUser() user: any,
    @Body()
    dto: { matchId: string; places: number; callerName: string; callerPhone?: string; paid?: boolean },
  ) {
    return this.bookingsService.reservePhone(user.id, dto);
  }

  @Post('phone/remove')
  @ApiOperation({ summary: 'Release N phone-reserved places' })
  removePhone(@CurrentUser() user: any, @Body() dto: { matchId: string; count: number }) {
    return this.bookingsService.removePhonePlaces(user.id, dto.matchId, dto.count);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm an awaiting booking (payment received)' })
  confirm(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookingsService.confirmByAdmin(user.id, id);
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Decline an awaiting booking with a reason' })
  decline(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('reason') reason?: string,
  ) {
    return this.bookingsService.declineByAdmin(user.id, id, reason);
  }
}
