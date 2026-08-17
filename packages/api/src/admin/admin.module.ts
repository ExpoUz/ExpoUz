import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GeminiModule } from '../gemini/gemini.module';
import { WalletModule } from '../payments/wallet/wallet.module';
import { PhoneModule } from '../phone/phone.module';

@Module({
  imports: [NotificationsModule, PrismaModule, GeminiModule, WalletModule, PhoneModule],
  controllers: [AdminController, OrganizationsController],
  providers: [AdminService, OrganizationsService, AdminAuditInterceptor],
  exports: [AdminService, OrganizationsService],
})
export class AdminModule {}
