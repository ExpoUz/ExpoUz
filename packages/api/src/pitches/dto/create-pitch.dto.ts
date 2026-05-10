import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SurfaceType {
  NATURAL = 'NATURAL',
  ARTIFICIAL = 'ARTIFICIAL',
  FUTSAL = 'FUTSAL',
  INDOOR_TURF = 'INDOOR_TURF',
}

export enum PitchSize {
  FIVE_A_SIDE = 'FIVE_A_SIDE',
  SEVEN_A_SIDE = 'SEVEN_A_SIDE',
  ELEVEN_A_SIDE = 'ELEVEN_A_SIDE',
}

export enum AmenityType {
  BATHROOM = 'BATHROOM',
  PARKING = 'PARKING',
  WATER_FOUNTAIN = 'WATER_FOUNTAIN',
  CHANGING_ROOM = 'CHANGING_ROOM',
  CAFE = 'CAFE',
  SECURITY = 'SECURITY',
  LIGHTS = 'LIGHTS',
}

export class CreatePitchDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  addressLine: string;

  @ApiProperty()
  @IsString()
  district: string;

  @ApiProperty({ default: 'Tashkent' })
  @IsString()
  city: string;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  lat: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  lng: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  hourlyRate: number;

  @ApiPropertyOptional({ enum: AmenityType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(AmenityType, { each: true })
  amenities?: AmenityType[];

  @ApiPropertyOptional({ enum: SurfaceType })
  @IsOptional()
  @IsEnum(SurfaceType)
  surfaceType?: SurfaceType;

  @ApiPropertyOptional({ enum: PitchSize })
  @IsOptional()
  @IsEnum(PitchSize)
  pitchSize?: PitchSize;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isIndoor?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noMetalStuds?: boolean;
}
