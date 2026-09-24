import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RemindersService } from './reminders.service';
import { RemindersProcessor } from './reminders.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'reminders' }),
    NotificationsModule,
    BookingsModule,
  ],
  providers: [RemindersService, RemindersProcessor],
  exports: [RemindersService],
})
export class RemindersModule {}
