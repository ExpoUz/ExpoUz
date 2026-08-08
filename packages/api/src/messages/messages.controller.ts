import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations' })
  getConversations(@CurrentUser() user: any) {
    return this.messagesService.getConversations(user.id);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMessages(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.messagesService.getMessages(id, user.id, +page, +limit);
  }

  @Post('conversations/:id')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  sendMessage(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('content') content: string,
  ) {
    return this.messagesService.sendMessage(id, user.id, content);
  }

  @Post('direct/:userId')
  @ApiOperation({ summary: 'Create or get a direct conversation with a user' })
  createOrGetDirect(@Param('userId') targetId: string, @CurrentUser() user: any) {
    return this.messagesService.createOrGetDirect(user.id, targetId);
  }

  @Patch('message/:id')
  @ApiOperation({ summary: 'Edit your own message' })
  editMessage(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('content') content: string,
  ) {
    return this.messagesService.editMessage(id, user.id, content);
  }

  @Delete('message/:id')
  @ApiOperation({ summary: 'Delete your own message' })
  deleteMessage(@Param('id') id: string, @CurrentUser() user: any) {
    return this.messagesService.deleteMessage(id, user.id);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a chat (removes you; deletes it if empty)' })
  deleteConversation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.messagesService.deleteConversation(id, user.id);
  }

  // ─── Public community groups + support ────────────────────────────────────

  @Get('groups')
  @ApiOperation({ summary: 'Browse public community groups' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'sport', required: false })
  listPublicGroups(
    @CurrentUser() user: any,
    @Query('city') city?: string,
    @Query('sport') sport?: string,
  ) {
    return this.messagesService.listPublicGroups(user.id, { city, sport });
  }

  @Post('groups/:id/join')
  @ApiOperation({ summary: 'Join a public group' })
  joinPublicGroup(@Param('id') id: string, @CurrentUser() user: any) {
    return this.messagesService.joinPublicGroup(user.id, id);
  }

  @Post('groups/:id/leave')
  @ApiOperation({ summary: 'Leave a public group' })
  leavePublicGroup(@Param('id') id: string, @CurrentUser() user: any) {
    return this.messagesService.leavePublicGroup(user.id, id);
  }

  @Post('groups')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a public group (admin only)' })
  createPublicGroup(@Body() body: { title: string; city?: string; sport?: string }) {
    return this.messagesService.createPublicGroup(body);
  }

  @Post('support')
  @ApiOperation({ summary: 'Get or create the user’s Support conversation' })
  ensureSupport(@CurrentUser() user: any) {
    return this.messagesService.ensureSupportConversation(user.id);
  }

  // NOTE: must precede ':matchId' so it isn't captured as a match id.
  @Get('match/:matchId/summary')
  @ApiOperation({ summary: 'Match chat row state (member count, unread, isMember)' })
  getMatchChatSummary(@Param('matchId') matchId: string, @CurrentUser() user: any) {
    return this.messagesService.getMatchChatSummary(matchId, user.id);
  }

  @Get('match/:matchId')
  @ApiOperation({ summary: 'Get match group chat' })
  getMatchGroupChat(@Param('matchId') matchId: string, @CurrentUser() user: any) {
    return this.messagesService.getMatchGroupChat(matchId, user.id);
  }
}
