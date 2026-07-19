import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WalletService } from '../payments/wallet/wallet.service';
import Decimal from 'decimal.js';

@Injectable()
export class EscrowService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('escrow') private escrowQueue: Queue,
    private notificationsService: NotificationsService,
    private wallet: WalletService,
  ) {}

  async initiatePayment(bookingId: string, gateway: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { match: true },
    });

    const settings = await this.prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    const platformFeeRate = settings?.platformFeeRate ?? 0.05;

    const transaction = await this.prisma.transaction.create({
      data: {
        userId: booking.userId,
        bookingId,
        amount: booking.match.pricePerPlayer,
        platformFee: new Decimal(booking.match.pricePerPlayer).mul(platformFeeRate),
        gateway: gateway as any,
        status: 'HELD',
        heldAt: new Date(),
      },
    });

    const matchEnd = new Date(booking.match.startTime);
    matchEnd.setMinutes(matchEnd.getMinutes() + booking.match.durationMinutes + 30);
    const delay = Math.max(matchEnd.getTime() - Date.now(), 0);

    await this.escrowQueue.add(
      'release-escrow',
      { transactionId: transaction.id },
      { delay },
    );

    return transaction;
  }

  async releaseEscrow(transactionId: string): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        booking: {
          include: { match: { include: { pitch: true } } },
        },
      },
    });

    if (!transaction || transaction.status === 'RELEASED') return;

    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 'singleton' },
    });
    const platformFeeRate = settings?.platformFeeRate || 0.05;

    const amount = new Decimal(transaction.amount);
    const platformFee = amount.mul(platformFeeRate);

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        platformFee,
      },
    });

    await this.prisma.booking.update({
      where: { id: transaction.bookingId },
      data: { status: 'COMPLETED' },
    });

    await this.notificationsService.send(
      transaction.userId,
      'PAYMENT_RELEASED',
      transaction.booking.matchId,
      { matchTitle: transaction.booking.match.title },
    );
  }

  /**
   * Schedule auto-release of a match's held escrow shortly after it ends.
   * Idempotent — a deterministic jobId means calling this on every join does
   * not create duplicate jobs.
   */
  async scheduleMatchRelease(match: {
    id: string;
    startTime: Date;
    durationMinutes: number;
  }): Promise<void> {
    const end = new Date(match.startTime);
    end.setMinutes(end.getMinutes() + (match.durationMinutes ?? 60) + 30);
    const delay = Math.max(end.getTime() - Date.now(), 0);
    try {
      await this.escrowQueue.add(
        'release-match',
        { matchId: match.id },
        { delay, jobId: `release-match:${match.id}`, removeOnComplete: true, removeOnFail: true },
      );
    } catch {
      // Queue/Redis unavailable — non-fatal; the host's complete() still releases.
    }
  }

  /** Release every HELD transaction tied to a match's bookings. */
  async releaseMatchEscrow(matchId: string): Promise<void> {
    const held = await this.prisma.transaction.findMany({
      where: { status: 'HELD', booking: { matchId } },
      select: { id: true },
    });
    for (const t of held) {
      await this.releaseEscrow(t.id);
    }
  }

  async handleCancellation(bookingId: string, hoursBeforeMatch: number): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        transaction: true,
        match: true,
      },
    });

    if (!booking) return;

    const deadlineHours = booking.match.cancellationDeadlineHours;

    let bookingStatus: any;
    let transactionStatus: any;
    let refundAmount: Decimal | null = null;

    if (hoursBeforeMatch > deadlineHours) {
      bookingStatus = 'CANCELLED_REFUND';
      transactionStatus = 'REFUNDED';
      refundAmount = booking.transaction ? new Decimal(booking.transaction.amount) : null;
    } else if (hoursBeforeMatch > 0) {
      bookingStatus = 'CANCELLED_PENALTY';
      transactionStatus = 'PARTIALLY_REFUNDED';
      refundAmount = booking.transaction
        ? new Decimal(booking.transaction.amount).mul(0.5)
        : null;
    } else {
      bookingStatus = 'NO_SHOW';
      transactionStatus = 'FAILED';
      refundAmount = null;
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: bookingStatus },
    });

    if (booking.transaction) {
      await this.prisma.transaction.update({
        where: { id: booking.transaction.id },
        data: { status: transactionStatus, refundedAt: new Date() },
      });
    }

    if (refundAmount) {
      await this.refundToWallet(booking.userId, refundAmount);
    }

    const notifType = bookingStatus === 'NO_SHOW' ? 'MATCH_CANCELLED' : 'MATCH_CANCELLED';
    await this.notificationsService.send(
      booking.userId,
      notifType,
      booking.matchId,
      { matchTitle: booking.match.title },
    );

    await this.notifyWaitlistFollowers(booking.matchId);
  }

  async refundToWallet(userId: string, amount: Decimal): Promise<void> {
    await this.wallet.adjust(userId, Number(amount), 'REFUND', {
      description: 'Booking refund',
    });
  }

  async notifyWaitlistFollowers(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        pitch: {
          include: { followers: true },
        },
        bookings: {
          where: { status: { notIn: ['CANCELLED_REFUND', 'CANCELLED_PENALTY', 'NO_SHOW'] } },
          select: { userId: true },
        },
      },
    });

    if (!match) return;

    const bookedUserIds = new Set(match.bookings.map((b) => b.userId));

    for (const follower of match.pitch.followers) {
      if (!bookedUserIds.has(follower.userId)) {
        await this.notificationsService.send(
          follower.userId,
          'SPOT_FREED',
          matchId,
          { matchTitle: match.title },
        );
      }
    }
  }
}
