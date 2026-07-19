import { Module } from '@nestjs/common';
import { UzumService } from './uzum/uzum.service';
import { UzumController } from './uzum/uzum.controller';
import { PaymeService } from './payme/payme.service';
import { PaymeController } from './payme/payme.controller';
import { ClickService } from './click/click.service';
import { ClickController } from './click/click.controller';
import { WalletModule } from './wallet/wallet.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [PaymentsController, UzumController, PaymeController, ClickController],
  providers: [PaymentsService, UzumService, PaymeService, ClickService],
  exports: [PaymentsService, UzumService, PaymeService, ClickService],
})
export class PaymentsModule {}
