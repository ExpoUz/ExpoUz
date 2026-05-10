import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TeamSide {
  HOME = 'HOME',
  AWAY = 'AWAY',
}

export enum PaymentGateway {
  UZUM_PAY = 'UZUM_PAY',
  PAYME = 'PAYME',
  CLICK = 'CLICK',
  WALLET = 'WALLET',
}

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  matchId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  positionId?: string;

  @ApiPropertyOptional({ enum: TeamSide })
  @IsOptional()
  @IsEnum(TeamSide)
  teamSide?: TeamSide;

  @ApiPropertyOptional({ enum: PaymentGateway, default: PaymentGateway.UZUM_PAY })
  @IsOptional()
  @IsEnum(PaymentGateway)
  gateway?: PaymentGateway;
}
