import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms.service';
import { I18nService } from '../i18n/i18n.service';

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

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private smsService: SmsService,
    private i18n: I18nService,
  ) {}

  async send(
    userId: string,
    type: NotificationType,
    matchId?: string,
    variables?: any,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notifSms: true, notifPush: true, notifTelegram: true, phone: true, language: true },
    });

    if (!user) return;

    const { title, body } = this.render(type, user.language, variables || {});

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

  /**
   * Resolve a notification's title/body in the recipient's language.
   * ADMIN_ANNOUNCEMENT carries its own text (already authored by an admin), so
   * it passes through untranslated. RATING_RECEIVED maps thumbsUp→emoji.
   */
  private render(
    type: string,
    locale: string,
    v: any,
  ): { title: string; body: string } {
    if (type === 'ADMIN_ANNOUNCEMENT') {
      return { title: v.title ?? '', body: v.body ?? '' };
    }
    const params = { ...v, thumb: v.thumbsUp ? '👍' : '👎', joinerName: v.joinerName ?? '' };
    return {
      title: this.i18n.t(`notifications.${type}.title`, locale, params),
      body: this.i18n.t(`notifications.${type}.body`, locale, params),
    };
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
