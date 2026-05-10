import { Module } from '@nestjs/common';
import { MatchGateway } from './match.gateway';

@Module({
  providers: [MatchGateway],
  exports: [MatchGateway],
})
export class GatewayModule {}
