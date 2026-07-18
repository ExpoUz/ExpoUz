import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Standalone wallet module so any feature (matches, auth, payments, admin) can
 * import `WalletService` without pulling in the payment-gateway controllers and
 * without risking circular dependencies. Depends only on Prisma.
 */
@Module({
  imports: [PrismaModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
