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
      // Match chats live on their event, NOT in the Chat tab. The tab is for
      // direct messages, community groups and support only.
      where: { userId, conversation: { type: { not: 'MATCH_GROUP' } } },
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

    // Match chats go read-only 24h after the match ends.
    if (await this.isMatchChatClosed(conversationId)) {
      throw new ForbiddenException({ code: 'MATCH_CHAT_CLOSED' });
    }

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

    return { ...conversation, readOnly: await this.isMatchChatClosed(conversation.id) };
  }

  /**
   * Lightweight state for the "Match chat" row on the event detail — safe for
   * everyone (members and non-members). Never creates the conversation.
   */
  async getMatchChatSummary(matchId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { type: 'MATCH_GROUP', matchId },
      select: { id: true },
    });

    if (!conversation) {
      // Not created yet: derive prospective membership from confirmed bookings +
      // host so the row can still say who can chat and whether the viewer may.
      const [confirmed, match] = await Promise.all([
        this.prisma.booking.findMany({
          where: { matchId, isGuestSlot: false, status: { in: ['CONFIRMED', 'COMPLETED'] } },
          select: { userId: true },
        }),
        this.prisma.match.findUnique({ where: { id: matchId }, select: { hostId: true } }),
      ]);
      const ids = new Set([...confirmed.map((b) => b.userId), match?.hostId].filter(Boolean) as string[]);
      return {
        conversationId: null,
        memberCount: ids.size,
        unreadCount: 0,
        isMember: ids.has(userId),
        readOnly: await this.isMatchChatClosed(null, matchId),
      };
    }

    const [memberCount, isMemberRow, unreadCount] = await Promise.all([
      this.prisma.conversationMember.count({ where: { conversationId: conversation.id } }),
      this.prisma.conversationMember.findFirst({
        where: { conversationId: conversation.id, userId },
        select: { id: true },
      }),
      this.prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: userId },
          NOT: { readBy: { has: userId } },
        },
      }),
    ]);

    return {
      conversationId: conversation.id,
      memberCount,
      unreadCount: isMemberRow ? unreadCount : 0,
      isMember: !!isMemberRow,
      readOnly: await this.isMatchChatClosed(conversation.id, matchId),
    };
  }

  /** True once a match chat has been closed (24h after the match ends). */
  private async isMatchChatClosed(conversationId: string | null, matchId?: string): Promise<boolean> {
    let mId = matchId;
    if (!mId && conversationId) {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { type: true, matchId: true },
      });
      if (!conv || conv.type !== 'MATCH_GROUP' || !conv.matchId) return false;
      mId = conv.matchId;
    }
    if (!mId) return false;
    const match = await this.prisma.match.findUnique({
      where: { id: mId },
      select: { startTime: true, durationMinutes: true },
    });
    if (!match) return false;
    const endsAt = new Date(match.startTime).getTime() + (match.durationMinutes ?? 60) * 60 * 1000;
    return Date.now() > endsAt + 24 * 60 * 60 * 1000;
  }

  /**
   * Post a SYSTEM message ("Aziz joined the game", "Match confirmed", "Time
   * changed"). Content is a JSON code the client localizes. `actorId` is any
   * real member id (FK requirement); rendering keys off type, not the sender.
   */
  async postMatchSystemMessage(
    matchId: string,
    actorId: string,
    payload: { t: string; [k: string]: any },
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { type: 'MATCH_GROUP', matchId },
      select: { id: true },
    });
    if (!conversation) return null;
    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: actorId,
        content: JSON.stringify(payload),
        type: 'SYSTEM',
        readBy: [actorId],
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
    this.gateway.emitNewMessage(conversation.id, message);
    return message;
  }

  // ─── Public community groups (admin-created, city/sport based) ─────────────

  /** Admin creates a public group. Idempotent-ish on (title). */
  async createPublicGroup(input: { title: string; city?: string; sport?: string }) {
    const title = input.title?.trim();
    if (!title) throw new ForbiddenException({ code: 'EMPTY_TITLE' });
    return this.prisma.conversation.create({
      data: {
        type: 'PUBLIC_GROUP',
        title,
        city: input.city ?? null,
        sport: (input.sport as any) ?? null,
      },
    });
  }

  /** Browse public groups (optionally filtered), each flagged joined + count. */
  async listPublicGroups(userId: string, filter?: { city?: string; sport?: string }) {
    const where: any = { type: 'PUBLIC_GROUP' };
    if (filter?.city) where.city = filter.city;
    if (filter?.sport) where.sport = filter.sport;
    const groups = await this.prisma.conversation.findMany({
      where,
      include: {
        _count: { select: { members: true } },
        members: { where: { userId }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return groups.map((g) => ({
      id: g.id,
      title: g.title,
      city: g.city,
      sport: g.sport,
      memberCount: g._count.members,
      joined: g.members.length > 0,
    }));
  }

  async joinPublicGroup(userId: string, groupId: string) {
    const group = await this.prisma.conversation.findFirst({
      where: { id: groupId, type: 'PUBLIC_GROUP' },
      select: { id: true },
    });
    if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND' });
    const existing = await this.prisma.conversationMember.findFirst({
      where: { conversationId: groupId, userId },
      select: { id: true },
    });
    if (!existing) {
      await this.prisma.conversationMember.create({ data: { conversationId: groupId, userId } });
    }
    return { joined: true, conversationId: groupId };
  }

  async leavePublicGroup(userId: string, groupId: string) {
    await this.prisma.conversationMember.deleteMany({
      where: { conversationId: groupId, userId },
    });
    return { joined: false };
  }

  /**
   * Ensure the user has a Support conversation (pinned at the top of the Chat
   * tab). Lazily created with a welcome message.
   */
  async ensureSupportConversation(userId: string) {
    let conv = await this.prisma.conversation.findFirst({
      where: { type: 'SUPPORT', members: { some: { userId } } },
      select: { id: true },
    });
    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: {
          type: 'SUPPORT',
          title: 'ExpoUz Support',
          members: { create: [{ userId }] },
        },
        select: { id: true },
      });
    }
    return conv;
  }

  /** Remove a player from a match chat when they leave/cancel. */
  async removeFromMatchChat(matchId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { type: 'MATCH_GROUP', matchId },
      select: { id: true },
    });
    if (!conversation) return;
    await this.prisma.conversationMember.deleteMany({
      where: { conversationId: conversation.id, userId },
    });
  }
}
