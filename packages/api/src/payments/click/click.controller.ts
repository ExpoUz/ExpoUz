import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ClickService } from './click.service';

@ApiTags('payments/click')
@Controller('payments/click')
export class ClickController {
  constructor(private readonly clickService: ClickService) {}

  @Post('prepare')
  @ApiOperation({ summary: 'Click - prepare transaction' })
  prepare(@Body() body: any) {
    return this.clickService.handlePrepare(body);
  }

  @Post('complete')
  @ApiOperation({ summary: 'Click - complete transaction' })
  complete(@Body() body: any) {
    return this.clickService.handleComplete(body);
  }
}
