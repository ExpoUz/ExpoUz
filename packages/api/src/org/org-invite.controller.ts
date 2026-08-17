import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgInviteService } from './org-invite.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Invite join endpoints. Any authenticated user holding a valid token may
 * preview and accept — membership is what grants partner-panel access.
 */
@ApiTags('org-invites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('org/invites')
export class OrgInviteController {
  constructor(private readonly invites: OrgInviteService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Preview an invite (org + role) before accepting' })
  preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }

  @Post(':token/accept')
  @ApiOperation({ summary: 'Accept an invite and join the organization' })
  accept(@CurrentUser() user: any, @Param('token') token: string) {
    return this.invites.accept(user.id, token);
  }
}
