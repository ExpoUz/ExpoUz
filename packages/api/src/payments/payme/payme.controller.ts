import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymeService } from './payme.service';

@ApiTags('payments/payme')
@Controller('payments/payme')
export class PaymeController {
  constructor(private readonly paymeService: PaymeService) {}

  @Post()
  @ApiOperation({ summary: 'Payme - unified JSON-RPC handler' })
  handleWebhook(
    @Body() body: { method: string; params: any; id: number },
    @Headers('authorization') auth: string,
  ) {
    return this.paymeService.handleWebhook(body.method, body.params, auth);
  }
}
