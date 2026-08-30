import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ConversationsService } from './conversations.service';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'My conversations' })
  getAll(@CurrentUser('id') userId: string) {
    return this.conversationsService.getMyConversations(userId);
  }

  @Post('direct/:targetUserId')
  @ApiOperation({ summary: 'Create or get direct conversation' })
  createDirect(@CurrentUser('id') userId: string, @Param('targetUserId') targetUserId: string) {
    return this.conversationsService.createDirect(userId, targetUserId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages (paginated)' })
  getMessages(@Param('id') id: string, @CurrentUser('id') userId: string, @Query('page') page = '1') {
    return this.conversationsService.getMessages(id, userId, parseInt(page));
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message' })
  sendMessage(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: { content: string }) {
    return this.conversationsService.sendMessage(id, userId, body.content);
  }
}
