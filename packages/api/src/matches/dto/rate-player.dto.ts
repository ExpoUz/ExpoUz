import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RatePlayerDto {
  @ApiProperty()
  @IsString()
  ratedId: string;

  @ApiProperty()
  @IsBoolean()
  thumbsUp: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
