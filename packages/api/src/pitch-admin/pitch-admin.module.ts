import { Module } from '@nestjs/common';
import { PitchAdminService } from './pitch-admin.service';
import { PitchAdminController } from './pitch-admin.controller';

@Module({
  controllers: [PitchAdminController],
  providers: [PitchAdminService],
  exports: [PitchAdminService],
})
export class PitchAdminModule {}
