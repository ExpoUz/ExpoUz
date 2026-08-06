import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PhoneVerificationService } from './phone-verification.service';

@ApiTags('phone')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me/phone')
export class PhoneController {
  constructor(private readonly phone: PhoneVerificationService) {}

  @Get('status')
  @ApiOperation({ summary: 'Current phone verification status' })
  getStatus(@CurrentUser() user: any) {
    return this.phone.getStatus(user.id);
  }

  @Post('telegram-contact')
  @ApiOperation({ summary: 'Tier 1: save a one-tap Telegram contact share (verified, no code)' })
  saveTelegramContact(@CurrentUser() user: any, @Body('raw') raw: string) {
    return this.phone.saveTelegramContact(user.id, raw);
  }

  @Post('request-code')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 per hour per user
  @ApiOperation({ summary: 'Tier 2: request an OTP via Telegram Gateway (SMS fallback)' })
  requestCode(@CurrentUser() user: any, @Body('phone') phone: string) {
    return this.phone.requestCode(user.id, phone);
  }

  @Post('verify-code')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 min
  @ApiOperation({ summary: 'Tier 2: verify the OTP the user received' })
  verifyCode(@CurrentUser() user: any, @Body('code') code: string) {
    return this.phone.verifyCode(user.id, code);
  }
}
