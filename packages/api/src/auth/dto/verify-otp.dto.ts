import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\+998[0-9]{9}$/)
  phone: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  otp: string;
}
