import { Module } from '@nestjs/common';
import { PitchesService } from './pitches.service';
import { PitchesController } from './pitches.controller';

@Module({
  controllers: [PitchesController],
  providers: [PitchesService],
  exports: [PitchesService],
})
export class PitchesModule {}
