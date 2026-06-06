import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PitchBookingType {
  GROUP_HIRE = 'GROUP_HIRE',
  OPEN_JOIN = 'OPEN_JOIN',
}

export enum PaymentGateway {
  UZUM_PAY = 'UZUM_PAY',
  PAYME = 'PAYME',
  CLICK = 'CLICK',
  WALLET = 'WALLET',
}

export class CreatePitchBookingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pitchId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: PitchBookingType, default: PitchBookingType.GROUP_HIRE })
  @IsEnum(PitchBookingType)
  type: PitchBookingType;

  @ApiProperty({ example: '2026-06-01T14:00:00.000Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 6 })
  @IsInt()
  @Min(1)
  @Max(6)
  durationHours: number;

  @ApiPropertyOptional({ example: 10, minimum: 2 })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxParticipants?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: PaymentGateway, default: PaymentGateway.UZUM_PAY })
  @IsOptional()
  @IsEnum(PaymentGateway)
  gateway?: PaymentGateway;
}
