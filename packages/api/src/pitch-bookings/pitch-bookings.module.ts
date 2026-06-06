import { Module } from '@nestjs/common';
import { PitchBookingsController } from './pitch-bookings.controller';
import { PitchBookingsService } from './pitch-bookings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [PitchBookingsController],
  providers: [PitchBookingsService],
  exports: [PitchBookingsService],
})
export class PitchBookingsModule {}
