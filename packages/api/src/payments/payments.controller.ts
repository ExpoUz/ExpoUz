import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Throttle({ default: { ttl: 60000, limit: 30 } })
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @ApiOperation({
    summary: 'Create or re-initiate a payment for a match or pitch booking',
    description:
      'Pass bookingId for match bookings or pitchBookingId for pitch bookings. ' +
      'Returns a transactionId and a gateway-specific payment URL.',
  })
  initiate(
    @CurrentUser() user: any,
    @Body() dto: { bookingId?: string; pitchBookingId?: string; gateway: string },
  ) {
    return this.paymentsService.initiate(user.id, dto);
  }

  @Get('status/:transactionId')
  @ApiOperation({ summary: 'Poll payment status by transactionId' })
  getStatus(@CurrentUser() user: any, @Param('transactionId') id: string) {
    return this.paymentsService.getStatus(id, user.id);
  }

  @Post('wallet/pay')
  @ApiOperation({ summary: 'Pay with in-app wallet balance' })
  payWithWallet(
    @CurrentUser() user: any,
    @Body('transactionId') transactionId: string,
  ) {
    return this.paymentsService.payWithWallet(transactionId, user.id);
  }
}
