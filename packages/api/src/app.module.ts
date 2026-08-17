import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PhoneModule } from './phone/phone.module';
import { PitchesModule } from './pitches/pitches.module';
import { MatchesModule } from './matches/matches.module';
import { AvailabilityModule } from './availability/availability.module';
import { SettingsModule } from './settings/settings.module';
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
import { OrgModule } from './org/org.module';
import { RemindersModule } from './reminders/reminders.module';
import { RankingModule } from './ranking/ranking.module';
import { LevelModule } from './level/level.module';
import { I18nModule } from './i18n/i18n.module';
import { OnlineStatusMiddleware } from './admin/online-status.middleware';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Global rate limit (enforced by the APP_GUARD below). Generous default so
    // normal app usage never trips it; sensitive endpoints (OTP, join, payments)
    // carry tighter per-route @Throttle overrides.
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
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
    I18nModule,
    OrgModule,
    ActivityModule,
    RankingModule,
    LevelModule,
    TelegramModule,
    AuthModule,
    UsersModule,
    PhoneModule,
    PitchesModule,
    MatchesModule,
    AvailabilityModule,
    SettingsModule,
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
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OnlineStatusMiddleware).forRoutes('*');
  }
}
