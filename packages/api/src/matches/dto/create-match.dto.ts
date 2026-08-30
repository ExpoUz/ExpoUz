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
import { BookingType, MatchType } from '@prisma/client';

// Must stay in sync with the Prisma `Sport` enum (schema.prisma).
export enum Sport {
  FOOTBALL = 'FOOTBALL',
  PADEL = 'PADEL',
  TENNIS = 'TENNIS',
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

  // PART 6: the AVAILABLE slot the user is booking into. When provided, the
  // match's startTime and price come from the slot — the user never sets price.
  @ApiPropertyOptional({ description: 'AVAILABLE slot to book into; price and start time come from it' })
  @IsOptional()
  @IsString()
  slotId?: string;

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

  @ApiPropertyOptional({ description: 'Required for OPEN_EVENT; computed for group/full bookings' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(2)
  maxPlayers?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minPlayers?: number;

  @ApiPropertyOptional({ description: 'Required for OPEN_EVENT; 0 for full bookings' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  pricePerPlayer?: number;

  // ---- Booking type ----
  @ApiPropertyOptional({ enum: BookingType, default: BookingType.OPEN_EVENT })
  @IsOptional()
  @IsEnum(BookingType)
  bookingType?: BookingType;

  @ApiPropertyOptional({ description: 'GROUP_BOOKING: how many people the organizer pays for' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  organizerPlayerCount?: number;

  @ApiPropertyOptional({ description: 'GROUP_BOOKING: extra spots open to others' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  extraSpotsAvailable?: number;

  @ApiPropertyOptional({ description: 'FULL_BOOKING: number of hours booked' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  fullBookingHours?: number;

  @ApiPropertyOptional({ description: 'FULL_BOOKING: hide from public listings' })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({ description: 'FULL_BOOKING: whether the host also plays (occupies a slot)' })
  @IsOptional()
  @IsBoolean()
  hostIsPlaying?: boolean;

  @ApiPropertyOptional({ description: "Host's team side for their own slot (HOME/AWAY)" })
  @IsOptional()
  @IsString()
  teamSide?: string;

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

  // ---- Competitive vs casual + level range ----
  @ApiPropertyOptional({ enum: MatchType, default: MatchType.COMPETITIVE })
  @IsOptional()
  @IsEnum(MatchType)
  matchType?: MatchType;

  @ApiPropertyOptional({ description: 'Minimum skill rating to join (0.0–7.0)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minLevel?: number;

  @ApiPropertyOptional({ description: 'Maximum skill rating to join (0.0–7.0)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxLevel?: number;
}
