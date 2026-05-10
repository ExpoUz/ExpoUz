import { Controller, Post, Body, Headers, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UzumService } from './uzum.service';
import { Request } from 'express';

@ApiTags('payments/uzum')
@Controller('payments/uzum')
export class UzumController {
  constructor(private readonly uzumService: UzumService) {}

  private validateIp(req: Request) {
    const whitelist = (process.env.UZUM_WEBHOOK_IP_WHITELIST || '').split(',').filter(Boolean);
    if (whitelist.length === 0) return;
    const ip = req.ip || req.socket.remoteAddress;
    if (!whitelist.includes(ip)) {
      throw new ForbiddenException('IP not whitelisted');
    }
  }

  @Post('check')
  @ApiOperation({ summary: 'Uzum Pay - check order' })
  check(
    @Body() body: any,
    @Headers('x-signature') signature: string,
    @Req() req: Request,
  ) {
    this.validateIp(req);
    if (!this.uzumService.validateWebhookSignature(body, signature)) {
      throw new ForbiddenException('Invalid signature');
    }
    return this.uzumService.handleCheck(body);
  }

  @Post('create')
  @ApiOperation({ summary: 'Uzum Pay - create transaction' })
  create(
    @Body() body: any,
    @Headers('x-signature') signature: string,
    @Req() req: Request,
  ) {
    this.validateIp(req);
    if (!this.uzumService.validateWebhookSignature(body, signature)) {
      throw new ForbiddenException('Invalid signature');
    }
    return this.uzumService.handleCreate(body);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Uzum Pay - confirm transaction' })
  confirm(
    @Body() body: any,
    @Headers('x-signature') signature: string,
    @Req() req: Request,
  ) {
    this.validateIp(req);
    if (!this.uzumService.validateWebhookSignature(body, signature)) {
      throw new ForbiddenException('Invalid signature');
    }
    return this.uzumService.handleConfirm(body);
  }
}
