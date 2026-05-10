import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsISO8601,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum Sport {
  FOOTBALL = 'FOOTBALL',
  BASKETBALL = 'BASKETBALL',
  VOLLEYBALL = 'VOLLEYBALL',
  TENNIS = 'TENNIS',
  BADMINTON = 'BADMINTON',
}

export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  AMATEUR = 'AMATEUR',
  PRO = 'PRO',
}

export class CreateMatchDto {
  @ApiProperty()
  @IsString()
  pitchId: string;

  @ApiPropertyOptional({ enum: Sport, default: Sport.FOOTBALL })
  @IsOptional()
  @IsEnum(Sport)
  sport?: Sport;

  @ApiProperty({ example: '7v7' })
  @IsString()
  format: string;

  @ApiProperty({ example: '2025-07-01T18:00:00Z' })
  @IsISO8601()
  startTime: string;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  durationMinutes?: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  @Min(2)
  maxPlayers: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minPlayers?: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  pricePerPlayer: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isCoEd?: boolean;

  @ApiPropertyOptional({ enum: SkillLevel })
  @IsOptional()
  @IsEnum(SkillLevel)
  skillFilter?: SkillLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formation?: string;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  cancellationDeadlineHours?: number;
}
