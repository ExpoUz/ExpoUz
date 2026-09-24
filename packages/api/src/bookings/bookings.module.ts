import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { WalletModule } from '../payments/wallet/wallet.module';
import { OrgModule } from '../org/org.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    WalletModule,
    OrgModule,
    NotificationsModule,
    BullModule.registerQueue({ name: 'reminders' }),
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
