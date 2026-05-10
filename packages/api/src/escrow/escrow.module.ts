import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EscrowService } from './escrow.service';
import { EscrowProcessor } from './escrow.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'escrow' }),
    NotificationsModule,
  ],
  providers: [EscrowService, EscrowProcessor],
  exports: [EscrowService],
})
export class EscrowModule {}
