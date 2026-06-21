import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { FormationModule } from '../formation/formation.module';
import { RemindersModule } from '../reminders/reminders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EscrowModule } from '../escrow/escrow.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [FormationModule, RemindersModule, NotificationsModule, EscrowModule, GatewayModule],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
