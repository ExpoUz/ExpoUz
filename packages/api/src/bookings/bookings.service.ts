import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ActivityService } from '../activity/activity.service';
import { WalletService } from '../payments/wallet/wallet.service';
import { OrgContextService } from '../org/org-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { syncPlayerCount } from '../matches/player-count';

// An unconfirmed booking holds its place for this long, then auto-expires and
// releases the place (Step 5). Applies to the offline/awaiting path and also
// cleans up abandoned online-payment attempts.
const AWAITING_EXPIRY_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private activity: ActivityService,
    private wallet: WalletService,
    private orgContext: OrgContextService,
    private notifications: NotificationsService,
    @InjectQueue('reminders') private remindersQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateBookingDto) {
    const { matchId, positionId, teamSide, gateway = 'UZUM_PAY' } = dto;

    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status !== 'OPEN') throw new ConflictException('Match is not open for booking');

    const existingBooking = await this.prisma.booking.findFirst({
      where: {
        matchId,
        userId,
        status: { notIn: ['CANCELLED_REFUND', 'CANCELLED_PENALTY', 'NO_SHOW'] },
      },
    });
    if (existingBooking) throw new ConflictException('Already booked for this match');

    if (positionId) {
      const position = await this.prisma.matchPosition.findUnique({
        where: { id: positionId },
      });
      if (!position || position.matchId !== matchId) {
        throw new NotFoundException('Position not found');
      }
      if (position.bookingId || position.isLocked) {
        throw new ConflictException('Position already taken');
      }
      const locked = await this.redis.lockPosition(positionId, userId);
      if (!locked) throw new ConflictException('Position is being reserved by someone else');
    }

    const platformFeeRate = 0.05;
    const amount = Number(match.pricePerPlayer);
    const platformFee = amount * platformFeeRate;

    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          userId,
          matchId,
          status: 'PENDING_PAYMENT',
          teamSide: teamSide as any,
          qrCode: `${matchId}_${userId}_${Date.now()}`,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          bookingId: booking.id,
          amount,
          platformFee,
          gateway: gateway as any,
          status: 'PENDING',
        },
      });

      if (positionId) {
        await tx.matchPosition.update({
          where: { id: positionId },
          data: { bookingId: booking.id, isLocked: true },
        });
      }

      // currentPlayers is derived from the real bookings — never incremented by hand.
      await syncPlayerCount(tx, matchId);

      return { booking, transaction };
    });

    if (positionId) {
      await this.redis.releasePosition(positionId);
    }

    // Hold the place for 2h, then auto-expire if still unconfirmed (Step 5).
    await this.scheduleExpiry(result.booking.id);

    const paymentUrl = this.generatePaymentUrl(
      result.transaction.id,
      amount,
      gateway as string,
    );

    return { booking: result.booking, transaction: result.transaction, paymentUrl };
  }

  async findMine(userId: string, params?: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = params ?? {};
    const where: any = { userId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          match: {
            include: {
              pitch: { select: { name: true, addressLine: true } },
            },
          },
          transaction: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, userId },
      include: {
        match: {
          include: {
            pitch: { select: { name: true, addressLine: true } },
            host: { select: { firstName: true, lastName: true } },
          },
        },
        transaction: true,
        positionTaken: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async cancel(id: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, userId },
      include: { match: true, transaction: true },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException('Booking cannot be cancelled');
    }

    const hoursBeforeMatch =
      (new Date(booking.match.startTime).getTime() - Date.now()) / (1000 * 60 * 60);
    const feeHours = booking.match.cancellationDeadlineHours || 5;
    const feePercent = booking.match.cancellationFeePercent || 50;
    const paidAmount = booking.transaction ? Number(booking.transaction.amount) : 0;
    const withinCancellationWindow =
      hoursBeforeMatch > 0 && hoursBeforeMatch < feeHours;

    let newStatus: any = 'CANCELLED_REFUND';
    let refundAmount: number | null = booking.transaction ? paidAmount : null;
    let penaltyAmount = 0;

    if (hoursBeforeMatch <= 0) {
      newStatus = 'NO_SHOW';
      refundAmount = null;
      penaltyAmount = paidAmount;
    } else if (withinCancellationWindow) {
      newStatus = 'CANCELLED_PENALTY';
      penaltyAmount = booking.transaction ? (paidAmount * feePercent) / 100 : 0;
      refundAmount = booking.transaction ? paidAmount - penaltyAmount : null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id }, data: { status: newStatus } });

      if (booking.transaction) {
        const txStatus = newStatus === 'CANCELLED_REFUND' ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
        await tx.transaction.update({
          where: { id: booking.transaction.id },
          data: { status: txStatus, refundedAt: new Date() },
        });
      }

      if (refundAmount) {
        // Refund through the ledger (single source of truth) — never write credit directly.
        await this.wallet.adjust(
          userId,
          refundAmount,
          'REFUND',
          {
            reference: booking.matchId,
            description:
              newStatus === 'CANCELLED_PENALTY'
                ? 'Cancelled booking (late) — partial refund'
                : 'Cancelled booking — full refund',
          },
          tx,
        );
      }

      await tx.matchPosition.updateMany({
        where: { bookingId: id },
        data: { bookingId: null, isLocked: false },
      });

      // currentPlayers is recomputed from the surviving bookings.
      await syncPlayerCount(tx, booking.matchId);
    });

    await this.activity.log(
      userId,
      'BOOKING_CANCELLED',
      `Cancelled booking — refund: ${refundAmount ?? 0} UZS, penalty: ${penaltyAmount} UZS`,
      {
        bookingId: id,
        matchId: booking.matchId,
        refundAmount,
        penaltyAmount,
        hoursUntilMatch: Math.round(hoursBeforeMatch),
      },
    );

    const refunded = refundAmount ?? 0;
    return {
      cancelled: true,
      status: newStatus,
      hoursUntilMatch: Math.round(hoursBeforeMatch),
      withinCancellationWindow,
      refundAmount: refunded,
      penaltyAmount,
      refundedToWallet: refunded > 0,
      message: withinCancellationWindow
        ? `Cancelled within ${feeHours}h window. ${refunded.toLocaleString()} UZS refunded (${penaltyAmount.toLocaleString()} UZS penalty applied).`
        : hoursBeforeMatch <= 0
          ? `Cancelled after start time — no refund.`
          : `Full refund of ${refunded.toLocaleString()} UZS added to your wallet.`,
    };
  }

  // ─────────────────────────── STEP 5: admin confirm / decline / expire ───────

  /** Enqueue the 2h auto-expiry job for an awaiting booking. Best-effort. */
  private async scheduleExpiry(bookingId: string): Promise<void> {
    try {
      await this.remindersQueue.add(
        'booking-expiry',
        { bookingId },
        { delay: AWAITING_EXPIRY_MS, removeOnComplete: true, removeOnFail: true },
      );
    } catch {
      /* queue unavailable — the sweep is a safety net, not a correctness guarantee */
    }
  }

  /** Load a booking and assert the caller may manage its venue (org boundary). */
  private async loadManageableBooking(adminUserId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { match: { select: { id: true, title: true, pitchId: true } }, transaction: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.orgContext.assertCanManagePitch(adminUserId, booking.match.pitchId);
    return booking;
  }

  /**
   * Admin confirms an awaiting booking once payment is received. Online-paid
   * bookings are already CONFIRMED (auto-confirm is kept), so this is the manual
   * override for the offline/phone path.
   */
  async confirmByAdmin(adminUserId: string, bookingId: string) {
    const booking = await this.loadManageableBooking(adminUserId, bookingId);
    if (booking.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Only an awaiting booking can be confirmed');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED', paidOffline: true } });
      // Offline payment received — settle any pending payment intent.
      if (booking.transaction && booking.transaction.status === 'PENDING') {
        await tx.transaction.update({
          where: { id: booking.transaction.id },
          data: { status: 'RELEASED' },
        });
      }
      await syncPlayerCount(tx, booking.matchId);
    });

    // The occupant is the venue itself for phone bookings — only notify real users.
    if (!booking.isPhoneBooking) {
      await this.notifications
        .send(booking.userId, 'BOOKING_CONFIRMED' as any, booking.matchId, { matchTitle: booking.match.title })
        .catch(() => {});
    }
    await this.activity.log(adminUserId, 'BOOKING_CONFIRMED', `Confirmed booking ${bookingId}`, {
      bookingId,
      matchId: booking.matchId,
    });
    return { confirmed: true, bookingId, status: 'CONFIRMED' };
  }

  /**
   * Admin declines an awaiting (or confirmed) booking with a reason. The place is
   * released and the player is notified; a paid booking is fully refunded (no
   * penalty — the venue declined, not the player).
   */
  async declineByAdmin(adminUserId: string, bookingId: string, reason?: string) {
    const booking = await this.loadManageableBooking(adminUserId, bookingId);
    if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException('This booking can no longer be declined');
    }
    const paid =
      booking.transaction && ['HELD', 'RELEASED'].includes(booking.transaction.status);
    const refundAmount = paid ? Number(booking.transaction!.amount) : 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'DECLINED', declineReason: reason ?? null },
      });
      if (booking.transaction) {
        await tx.transaction.update({
          where: { id: booking.transaction.id },
          data: { status: paid ? 'REFUNDED' : 'FAILED', refundedAt: paid ? new Date() : null },
        });
      }
      if (refundAmount > 0) {
        await this.wallet.adjust(
          booking.userId,
          refundAmount,
          'REFUND',
          { reference: booking.matchId, description: 'Booking declined by venue — full refund' },
          tx,
        );
      }
      await tx.matchPosition.updateMany({
        where: { bookingId },
        data: { bookingId: null, isLocked: false },
      });
      await syncPlayerCount(tx, booking.matchId);
    });

    if (!booking.isPhoneBooking) {
      await this.notifications
        .send(booking.userId, 'MATCH_CANCELLED' as any, booking.matchId, {
          matchTitle: booking.match.title,
          reason: reason ?? '',
        })
        .catch(() => {});
    }
    await this.activity.log(adminUserId, 'BOOKING_CANCELLED', `Declined booking ${bookingId}`, {
      bookingId,
      matchId: booking.matchId,
      reason,
      refundAmount,
    });
    return { declined: true, bookingId, status: 'DECLINED', refundAmount };
  }

  /**
   * Auto-expire an unconfirmed booking after the hold window (called by the
   * reminders queue). No-op if it was confirmed, cancelled or already handled.
   */
  async expireIfStale(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { match: { select: { title: true } }, transaction: true },
    });
    if (!booking || booking.status !== 'PENDING_PAYMENT') return { expired: false };

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'EXPIRED' } });
      if (booking.transaction && booking.transaction.status === 'PENDING') {
        await tx.transaction.update({ where: { id: booking.transaction.id }, data: { status: 'FAILED' } });
      }
      await tx.matchPosition.updateMany({
        where: { bookingId },
        data: { bookingId: null, isLocked: false },
      });
      await syncPlayerCount(tx, booking.matchId);
    });

    await this.notifications
      .send(booking.userId, 'MATCH_CANCELLED' as any, booking.matchId, { matchTitle: booking.match.title })
      .catch(() => {});
    return { expired: true, bookingId };
  }

  // ─────────────────────────── STEP 6: phone bookings ─────────────────────────

  /**
   * Reserve N places for a caller (phone booking). Holds the places immediately
   * (CONFIRMED) so the app's "places left" — always `maxPlayers − occupied` via
   * syncPlayerCount — drops by N. The app shows only the caller's name.
   */
  async reservePhone(
    adminUserId: string,
    dto: { matchId: string; places: number; callerName: string; callerPhone?: string; paid?: boolean },
  ) {
    const match = await this.prisma.match.findUnique({ where: { id: dto.matchId } });
    if (!match) throw new NotFoundException('Match not found');
    await this.orgContext.assertCanManagePitch(adminUserId, match.pitchId);

    const places = Math.floor(dto.places);
    if (!places || places < 1) throw new BadRequestException('Reserve at least one place');
    if (!dto.callerName?.trim()) throw new BadRequestException("Enter the caller's name");
    const open = match.maxPlayers - match.currentPlayers;
    if (places > open) {
      throw new ConflictException(`Only ${open} place(s) left — cannot reserve ${places}`);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < places; i++) {
        await tx.booking.create({
          data: {
            userId: adminUserId,
            matchId: dto.matchId,
            status: 'CONFIRMED',
            isPhoneBooking: true,
            callerName: dto.callerName.trim(),
            callerPhone: dto.callerPhone?.trim() || null,
            paidOffline: !!dto.paid,
            guestLabel: dto.callerName.trim(),
            qrCode: `${dto.matchId}_phone_${Date.now()}_${i}`,
          },
        });
      }
      const count = await syncPlayerCount(tx, dto.matchId);
      return count;
    });

    await this.activity.log(adminUserId, 'ADMIN_ACTION', `Reserved ${places} place(s) by phone`, {
      matchId: dto.matchId,
      places,
      callerName: dto.callerName,
      paid: !!dto.paid,
    });
    return { reserved: places, occupied: created, placesLeft: match.maxPlayers - created };
  }

  /**
   * Release N phone-reserved places (a caller dropped out). Removes the most
   * recent phone bookings on the match and returns the places to the app.
   */
  async removePhonePlaces(adminUserId: string, matchId: string, count: number) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    await this.orgContext.assertCanManagePitch(adminUserId, match.pitchId);

    const n = Math.floor(count);
    if (!n || n < 1) throw new BadRequestException('Remove at least one place');

    const removed = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.booking.findMany({
        where: { matchId, isPhoneBooking: true, status: 'CONFIRMED' },
        orderBy: { createdAt: 'desc' },
        take: n,
        select: { id: true },
      });
      if (rows.length === 0) return 0;
      await tx.booking.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      await syncPlayerCount(tx, matchId);
      return rows.length;
    });

    await this.activity.log(adminUserId, 'ADMIN_ACTION', `Removed ${removed} phone place(s)`, {
      matchId,
      removed,
    });
    return { removed };
  }

  private generatePaymentUrl(transactionId: string, amount: number, gateway: string): string {
    const merchantId = process.env.UZUM_MERCHANT_ID || 'merchant';
    switch (gateway) {
      case 'PAYME':
        return `https://checkout.paycom.uz/${Buffer.from(
          JSON.stringify({ id: transactionId, amount: amount * 100 }),
        ).toString('base64')}`;
      case 'CLICK':
        return `https://my.click.uz/services/pay?service_id=${process.env.CLICK_SERVICE_ID}&merchant_id=${process.env.CLICK_MERCHANT_ID}&amount=${amount}&transaction_param=${transactionId}`;
      case 'WALLET':
        return `/v1/payments/wallet/pay?transactionId=${transactionId}`;
      default:
        return `https://uzum.uz/pay?merchant_id=${merchantId}&order_id=${transactionId}&amount=${amount}`;
    }
  }
}
