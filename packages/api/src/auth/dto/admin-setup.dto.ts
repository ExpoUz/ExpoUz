import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * First-run / recovery creation of a SUPER_ADMIN. Gated by the ADMIN_SETUP_KEY
 * env var — the setup endpoint is inert unless that var is set and `setupKey`
 * matches it. Operators unset the var again after use to "disable" it.
 */
export class AdminSetupDto {
  @ApiProperty({ description: 'Must equal the ADMIN_SETUP_KEY env var' })
  @IsString()
  setupKey: string;

  @ApiProperty({ example: 'admin@expouz.uz' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'strong-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Platform' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Owner' })
  @IsString()
  lastName: string;
}
