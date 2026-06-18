import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectQueue('reminders') private remindersQueue: Queue,
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Schedule a "free cancellation closing soon" reminder ~30 min before the
   * cancellation window closes (window closes at startTime - deadlineHours).
   */
  async scheduleCancellationWarning(
    matchId: string,
    startTime: Date,
    deadlineHours: number,
  ): Promise<void> {
    const warnAt =
      new Date(startTime).getTime() - (deadlineHours + 0.5) * 60 * 60 * 1000;
    const delay = warnAt - Date.now();
    if (delay <= 0) return; // window already closed / too soon

    try {
      await this.remindersQueue.add(
        'cancellation-warning',
        { matchId },
        { delay, removeOnComplete: true, removeOnFail: true },
      );
    } catch (err) {
      this.logger.warn(`Could not schedule cancellation warning: ${err}`);
    }
  }

  async sendCancellationWarning(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        bookings: {
          where: { status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } },
          select: { userId: true },
        },
      },
    });
    if (!match || match.status === 'CANCELLED') return;

    for (const booking of match.bookings) {
      await this.notificationsService.send(
        booking.userId,
        // Valid NotificationType at runtime/schema; cast avoids a stale local
        // Prisma client (resolves cleanly after a fresh `prisma generate`).
        'CANCELLATION_WINDOW_CLOSING' as any,
        matchId,
        { matchTitle: match.title },
      );
    }
  }
}
