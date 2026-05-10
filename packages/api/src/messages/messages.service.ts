import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

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
            _count: { select: { members: true, messages: true } },
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.conversation,
      lastMessage: m.conversation.messages[0] || null,
    }));
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

    await this.prisma.message.updateMany({
      where: {
        conversationId,
        readBy: { not: { array_contains: userId } },
      },
      data: { readBy: { push: userId } },
    });

    return { data: messages.reverse(), total, page, limit };
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const member = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId: senderId },
    });
    if (!member) throw new ForbiddenException('Not a member of this conversation');

    return this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        readBy: [senderId],
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
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
