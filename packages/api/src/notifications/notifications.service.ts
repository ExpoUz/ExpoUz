import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms.service';

type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'MATCH_FULL'
  | 'MATCH_CONFIRMED'
  | 'MATCH_CANCELLED'
  | 'SPOT_FREED'
  | 'GAME_STARTING_SOON'
  | 'RATING_RECEIVED'
  | 'PAYMENT_RELEASED'
  | 'REFERRAL_BONUS'
  | 'ADMIN_ANNOUNCEMENT';

// Keyed by NotificationType value; typed by string so newly-added enum members
// (which are valid at runtime/schema) don't require a client regen to compile.
const NOTIFICATION_TEMPLATES: Record<
  string,
  (vars: any) => { title: string; body: string }
> = {
  BOOKING_CONFIRMED: (v) => ({
    title: 'Booking Confirmed!',
    body: `Your spot in ${v.matchTitle} is confirmed.`,
  }),
  MATCH_FULL: (v) => ({
    title: 'Match Full',
    body: `${v.matchTitle} is now full!`,
  }),
  MATCH_CONFIRMED: (v) => ({
    title: 'Match Confirmed',
    body: `${v.matchTitle} is happening! See you there.`,
  }),
  MATCH_CANCELLED: (v) => ({
    title: 'Match Cancelled',
    body: `${v.matchTitle} has been cancelled. Refund processed.`,
  }),
  SPOT_FREED: (v) => ({
    title: 'Spot Available!',
    body: `A spot opened up in ${v.matchTitle}. Book now!`,
  }),
  GAME_STARTING_SOON: (v) => ({
    title: 'Game Starting Soon',
    body: `${v.matchTitle} starts in ${v.minutes} minutes!`,
  }),
  RATING_RECEIVED: (v) => ({
    title: 'New Rating',
    body: `${v.raterName} ${v.thumbsUp ? '👍' : '👎'} rated you.`,
  }),
  PAYMENT_RELEASED: (v) => ({
    title: 'Payment Released',
    body: `Payment for ${v.matchTitle} processed.`,
  }),
  REFERRAL_BONUS: (v) => ({
    title: 'Referral Bonus!',
    body: `You earned 50,000 UZS for referring ${v.friendName}!`,
  }),
  ADMIN_ANNOUNCEMENT: (v) => ({
    title: v.title,
    body: v.body,
  }),
  CANCELLATION_WINDOW_CLOSING: (v) => ({
    title: '⚠️ Free cancellation closing soon',
    body: `Free cancellation for ${v.matchTitle} closes in ~30 min. Cancel now for a full refund.`,
  }),
  INVITE_JOINED: (v) => ({
    title: '🎉 Someone joined your game!',
    body: `${v.joinerName ?? 'A player'} joined ${v.matchTitle}.${
      v.spotsLeft != null ? ` ${v.spotsLeft} spots left.` : ''
    }`,
  }),
};

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private smsService: SmsService,
  ) {}

  async send(
    userId: string,
    type: NotificationType,
    matchId?: string,
    variables?: any,
  ): Promise<void> {
    const template = NOTIFICATION_TEMPLATES[type];
    const { title, body } = template(variables || {});

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notifSms: true, notifPush: true, notifTelegram: true, phone: true },
    });

    if (!user) return;

    const sentVia: string[] = [];

    await this.prisma.notification.create({
      data: {
        userId,
        matchId,
        type,
        title,
        body,
        sentVia,
      },
    });

    if (user.notifSms && user.phone) {
      await this.smsService.send(user.phone, `${title}: ${body}`);
      sentVia.push('sms');
    }

    if (sentVia.length > 0) {
      await this.prisma.notification.updateMany({
        where: { userId, type, title, body, createdAt: { gte: new Date(Date.now() - 5000) } },
        data: { sentVia },
      });
    }
  }

  async markRead(userId: string, notificationId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notif) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'All notifications marked as read' };
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { data: notifications, total, page, limit };
  }
}
