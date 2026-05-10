import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PitchesModule } from './pitches/pitches.module';
import { MatchesModule } from './matches/matches.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { EscrowModule } from './escrow/escrow.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagesModule } from './messages/messages.module';
import { AdminModule } from './admin/admin.module';
import { PitchAdminModule } from './pitch-admin/pitch-admin.module';
import { FormationModule } from './formation/formation.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('REDIS_URL'),
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    PitchesModule,
    MatchesModule,
    BookingsModule,
    PaymentsModule,
    EscrowModule,
    NotificationsModule,
    MessagesModule,
    AdminModule,
    PitchAdminModule,
    FormationModule,
    GatewayModule,
  ],
})
export class AppModule {}
