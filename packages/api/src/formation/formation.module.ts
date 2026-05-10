import { Module } from '@nestjs/common';
import { FormationService } from './formation.service';

@Module({
  providers: [FormationService],
  exports: [FormationService],
})
export class FormationModule {}
