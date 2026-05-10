import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

  @Get('match/:matchId')
  @ApiOperation({ summary: 'Get match group chat' })
  getMatchGroupChat(@Param('matchId') matchId: string, @CurrentUser() user: any) {
    return this.messagesService.getMatchGroupChat(matchId, user.id);
  }
}
