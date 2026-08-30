import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrgModule } from '../org/org.module';
import { SlotsService } from './slots.service';
import { SlotAdminController, SlotPublicController } from './slots.controller';

@Module({
  imports: [PrismaModule, OrgModule],
  controllers: [SlotAdminController, SlotPublicController],
  providers: [SlotsService],
  exports: [SlotsService],
})
export class SlotsModule {}
