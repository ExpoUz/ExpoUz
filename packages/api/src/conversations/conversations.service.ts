import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async getMyConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMessages(conversationId: string, userId: string, page = 1) {
    const take = 50;
    const skip = (page - 1) * take;

    const member = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId },
    });
    if (!member) throw new Error('Not a member of this conversation');

    await this.prisma.conversationMember.update({
      where: { id: member.id },
      data: { lastReadAt: new Date() },
    });

    return this.prisma.message.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const member = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId: senderId },
    });
    if (!member) throw new Error('Not a member');

    return this.prisma.message.create({
      data: { conversationId, senderId, content },
      include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
  }

  async createDirect(userId: string, targetUserId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        type: 'DIRECT',
        members: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
      include: { members: true },
    });
  }
}
