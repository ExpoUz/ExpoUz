import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PitchBookingsService } from './pitch-bookings.service';
import { CreatePitchBookingDto } from './dto/create-pitch-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('pitch-bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pitch-bookings')
export class PitchBookingsController {
  constructor(private readonly service: PitchBookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Book a pitch directly (group hire or open-join)' })
  create(@CurrentUser() user: any, @Body() dto: CreatePitchBookingDto) {
    return this.service.create(user.id, dto);
  }

  @Get('open')
  @ApiOperation({ summary: 'List open-join pitch bookings others can join' })
  @ApiQuery({ name: 'pitchId', required: false })
  listOpen(@Query('pitchId') pitchId?: string) {
    return this.service.listOpen(pitchId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my hosted and joined pitch bookings' })
  myBookings(@CurrentUser() user: any) {
    return this.service.myBookings(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pitch booking details' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join an open-join pitch booking as an individual' })
  @HttpCode(HttpStatus.OK)
  join(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.join(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Cancel a pitch booking — full refund if >5h before start, 50% fee otherwise',
  })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.cancel(id, user.id);
  }
}
