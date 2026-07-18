import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { MessagesGateway } from './messages.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
    private gateway: MessagesGateway,
  ) {}

  async getConversations(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: { select: { id: true, firstName: true, lastName: true } },
              },
            },
            members: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, avatarUrl: true },
                },
              },
            },
            _count: { select: { members: true, messages: true } },
          },
        },
      },
    });

    // Unread = messages in the conversation the current user hasn't read yet.
    const conversationIds = memberships.map((m) => m.conversationId);
    const unreadRows = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        NOT: { readBy: { has: userId } },
      },
      _count: { _all: true },
    });
    const unreadByConv = new Map(
      unreadRows.map((r) => [r.conversationId, r._count._all]),
    );

    return memberships
      .map((m) => {
        // For direct chats, surface the "other" member so the client can show
        // a name/avatar without extra lookups.
        const others = m.conversation.members.filter((cm) => cm.userId !== userId);
        return {
          ...m.conversation,
          lastMessage: m.conversation.messages[0] || null,
          unreadCount: unreadByConv.get(m.conversationId) ?? 0,
          otherMember: others[0]?.user ?? null,
        };
      })
      .sort((a, b) => {
        const at = a.lastMessage?.createdAt ?? a.createdAt;
        const bt = b.lastMessage?.createdAt ?? b.createdAt;
        return new Date(bt).getTime() - new Date(at).getTime();
      });
  }

  async getMessages(conversationId: string, userId: string, page = 1, limit = 50) {
    const member = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId },
    });
    if (!member) throw new ForbiddenException('Not a member of this conversation');

    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    const marked = await this.prisma.message.updateMany({
      where: {
        conversationId,
        NOT: { readBy: { has: userId } },
      },
      data: { readBy: { push: userId } },
    });

    if (marked.count > 0) {
      this.gateway.emitRead(conversationId, { userId });
    }

    return { data: messages.reverse(), total, page, limit };
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const member = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId: senderId },
    });
    if (!member) throw new ForbiddenException('Not a member of this conversation');

    const [message, conversation, sender] = await Promise.all([
      this.prisma.message.create({
        data: {
          conversationId,
          senderId,
          content,
          readBy: [senderId],
        },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { telegramTopicId: true, type: true },
      }),
      this.prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true },
      }),
    ]);

    // Broadcast to everyone in the conversation room for live delivery.
    this.gateway.emitNewMessage(conversationId, message);

    // Mirror to Telegram if this conversation has a linked topic
    if (conversation?.telegramTopicId && sender) {
      const name = `${sender.firstName} ${sender.lastName}`.trim();
      this.telegramService.sendToTopic(conversation.telegramTopicId, name, content).catch(() => {});
    }

    return message;
  }

  async createOrGetDirect(userId1: string, userId2: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        members: {
          every: { userId: { in: [userId1, userId2] } },
        },
      },
      include: {
        members: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (existing && existing.members.length === 2) {
      return existing;
    }

    return this.prisma.conversation.create({
      data: {
        type: 'DIRECT',
        members: {
          create: [{ userId: userId1 }, { userId: userId2 }],
        },
      },
      include: { members: true },
    });
  }

  async getMatchGroupChat(matchId: string, userId: string) {
    let conversation = await this.prisma.conversation.findFirst({
      where: { type: 'MATCH_GROUP', matchId },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!conversation) {
      const confirmedBookings = await this.prisma.booking.findMany({
        where: { matchId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        select: { userId: true },
      });

      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
        select: { hostId: true },
      });

      const memberIds = [...new Set([
        ...confirmedBookings.map((b) => b.userId),
        match?.hostId,
      ].filter(Boolean))];

      conversation = await this.prisma.conversation.create({
        data: {
          type: 'MATCH_GROUP',
          matchId,
          members: {
            create: memberIds.map((uid) => ({
              userId: uid,
              isAdmin: uid === match?.hostId,
            })),
          },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
      });
    }

    const isMember = conversation.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a participant of this match');

    return conversation;
  }
}
