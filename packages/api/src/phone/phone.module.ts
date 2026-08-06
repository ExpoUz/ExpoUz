import { Module } from '@nestjs/common';
import { PhoneController } from './phone.controller';
import { PhoneVerificationService } from './phone-verification.service';
import { ContactService } from './contact.service';
import { GatewayService } from './gateway.service';
import { PhoneVerifiedGuard } from './phone-verified.guard';

/**
 * Phone-number verification: one-tap Telegram contact share (Tier 1),
 * Telegram Gateway OTP (Tier 2), Eskiz SMS fallback (Tier 3, flagged).
 *
 * PhoneVerificationService is exported so gated features (matches, payments)
 * can call assertVerified() without re-implementing the check.
 */
@Module({
  controllers: [PhoneController],
  providers: [PhoneVerificationService, ContactService, GatewayService, PhoneVerifiedGuard],
  exports: [PhoneVerificationService, PhoneVerifiedGuard],
})
export class PhoneModule {}
