import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LevelService } from './level.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('level')
@Controller('level')
export class LevelController {
  constructor(private readonly level: LevelService) {}

  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit onboarding questionnaire to set starting level' })
  submitOnboarding(@CurrentUser() user: any, @Body() answers: OnboardingDto) {
    return this.level.applyOnboarding(user.id, answers);
  }

  @Get(':userId/history')
  @ApiOperation({ summary: 'Level progression history for a user' })
  getHistory(@Param('userId') userId: string) {
    return this.level.getLevelHistory(userId);
  }
}
