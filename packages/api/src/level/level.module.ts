import { Global, Module } from '@nestjs/common';
import { LevelService } from './level.service';
import { LevelController } from './level.controller';

@Global()
@Module({
  controllers: [LevelController],
  providers: [LevelService],
  exports: [LevelService],
})
export class LevelModule {}
