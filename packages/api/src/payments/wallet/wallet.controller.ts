import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('payments/wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get wallet balance' })
  getBalance(@CurrentUser() user: any) {
    return this.walletService.getBalance(user.id);
  }

  @Post('topup')
  @ApiOperation({ summary: 'Top up wallet' })
  topUp(
    @CurrentUser() user: any,
    @Body('amount') amount: number,
    @Body('gateway') gateway = 'UZUM_PAY',
  ) {
    return this.walletService.topUp(user.id, amount, gateway);
  }
}
