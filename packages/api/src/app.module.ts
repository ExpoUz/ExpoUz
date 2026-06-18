import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PitchesModule } from './pitches/pitches.module';
import { MatchesModule } from './matches/matches.module';
import { BookingsModule } from './bookings/bookings.module';
import { PitchBookingsModule } from './pitch-bookings/pitch-bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { EscrowModule } from './escrow/escrow.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagesModule } from './messages/messages.module';
import { AdminModule } from './admin/admin.module';
import { PitchAdminModule } from './pitch-admin/pitch-admin.module';
import { FormationModule } from './formation/formation.module';
import { GatewayModule } from './gateway/gateway.module';
import { TelegramModule } from './telegram/telegram.module';
import { ActivityModule } from './activity/activity.module';
import { RemindersModule } from './reminders/reminders.module';
import { RankingModule } from './ranking/ranking.module';
import { LevelModule } from './level/level.module';
import { OnlineStatusMiddleware } from './admin/online-status.middleware';
import { HealthController } from './health.controller';

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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      global: true,
    }),
    PrismaModule,
    RedisModule,
    ActivityModule,
    RankingModule,
    LevelModule,
    TelegramModule,
    AuthModule,
    UsersModule,
    PitchesModule,
    MatchesModule,
    BookingsModule,
    PitchBookingsModule,
    PaymentsModule,
    EscrowModule,
    RemindersModule,
    NotificationsModule,
    MessagesModule,
    AdminModule,
    PitchAdminModule,
    FormationModule,
    GatewayModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OnlineStatusMiddleware).forRoutes('*');
  }
}
