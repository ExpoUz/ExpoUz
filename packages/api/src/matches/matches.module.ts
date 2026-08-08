import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { FormationModule } from '../formation/formation.module';
import { RemindersModule } from '../reminders/reminders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EscrowModule } from '../escrow/escrow.module';
import { GatewayModule } from '../gateway/gateway.module';
import { WalletModule } from '../payments/wallet/wallet.module';
import { PhoneModule } from '../phone/phone.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [FormationModule, RemindersModule, NotificationsModule, EscrowModule, GatewayModule, WalletModule, PhoneModule, MessagesModule],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
