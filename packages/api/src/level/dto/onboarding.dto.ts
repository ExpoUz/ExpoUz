import { IsBoolean, IsIn, IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OnboardingDto {
  @ApiProperty({ enum: ['never', 'few_times', 'months', 'years'] })
  @IsIn(['never', 'few_times', 'months', 'years'])
  experience: 'never' | 'few_times' | 'months' | 'years';

  @ApiProperty()
  @IsBoolean()
  otherRacketSports: boolean;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  selfAssessment: number;

  @ApiProperty()
  @IsBoolean()
  competitivePlay: boolean;
}
