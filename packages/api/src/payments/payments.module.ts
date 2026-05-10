import { Module } from '@nestjs/common';
import { UzumService } from './uzum/uzum.service';
import { UzumController } from './uzum/uzum.controller';
import { PaymeService } from './payme/payme.service';
import { PaymeController } from './payme/payme.controller';
import { ClickService } from './click/click.service';
import { ClickController } from './click/click.controller';
import { WalletService } from './wallet/wallet.service';
import { WalletController } from './wallet/wallet.controller';

@Module({
  controllers: [UzumController, PaymeController, ClickController, WalletController],
  providers: [UzumService, PaymeService, ClickService, WalletService],
  exports: [UzumService, PaymeService, ClickService, WalletService],
})
export class PaymentsModule {}
