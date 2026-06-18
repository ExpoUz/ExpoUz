import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Padel scoring — best of 3 sets. Set 3 is optional (only if sets are split 1-1).
export class SubmitResultDto {
  @ApiProperty() @IsInt() @Min(0) @Max(7) team1Set1: number;
  @ApiProperty() @IsInt() @Min(0) @Max(7) team2Set1: number;

  @ApiProperty() @IsInt() @Min(0) @Max(7) team1Set2: number;
  @ApiProperty() @IsInt() @Min(0) @Max(7) team2Set2: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(7) team1Set3?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(7) team2Set3?: number;
}
