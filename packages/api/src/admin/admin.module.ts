import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GeminiModule } from '../gemini/gemini.module';
import { WalletModule } from '../payments/wallet/wallet.module';
import { PhoneModule } from '../phone/phone.module';

@Module({
  imports: [NotificationsModule, PrismaModule, GeminiModule, WalletModule, PhoneModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAuditInterceptor],
  exports: [AdminService],
})
export class AdminModule {}
