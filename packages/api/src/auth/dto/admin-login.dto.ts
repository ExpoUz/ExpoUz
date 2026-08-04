import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@expouz.uz' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'strong-password' })
  @IsString()
  @MinLength(8)
  password: string;
}
