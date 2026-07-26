import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet/wallet.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private wallet: WalletService,
  ) {}

  // ─── Build Payment URL ─────────────────────────────────────────────────────
  buildPaymentUrl(transactionId: string, amount: number, gateway: string): string {
    switch (gateway) {
      case 'PAYME':
        return `https://checkout.paycom.uz/${Buffer.from(
          JSON.stringify({ id: transactionId, amount: Math.round(amount * 100) }),
        ).toString('base64')}`;
      case 'CLICK':
        return (
          `https://my.click.uz/services/pay` +
          `?service_id=${process.env.CLICK_SERVICE_ID}` +
          `&merchant_id=${process.env.CLICK_MERCHANT_ID}` +
          `&amount=${amount}` +
          `&transaction_param=${transactionId}`
        );
      case 'WALLET':
        // Handled server-side — caller should call POST /payments/wallet/pay instead
        return `/v1/payments/wallet/pay?transactionId=${transactionId}`;
      default:
        // UZUM_PAY
        return (
          `https://uzum.uz/pay` +
          `?merchant_id=${process.env.UZUM_MERCHANT_ID || 'merchant'}` +
          `&order_id=${transactionId}` +
          `&amount=${amount}`
        );
    }
  }

  // ─── Create or re-initiate a transaction for a booking ────────────────────
  async initiate(
    userId: string,
    dto: { bookingId?: string; pitchBookingId?: string; gateway: string },
  ) {
    const { bookingId, pitchBookingId, gateway } = dto;

    if (!bookingId && !pitchBookingId) {
      throw new BadRequestException('Provide bookingId or pitchBookingId');
    }

    const PLATFORM_FEE_RATE = 0.05;
    let amount: number;
    let existingTransaction: any;

    if (bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId, userId },
        include: { match: true, transaction: true },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) {
        throw new BadRequestException('Booking is not in a payable state');
      }
      amount = Number(booking.match.pricePerPlayer);
      existingTransaction = booking.transaction;
    } else {
      const pitchBooking = await this.prisma.pitchBooking.findUnique({
        where: { id: pitchBookingId },
        include: { transaction: true },
      });
      if (!pitchBooking) throw new NotFoundException('Pitch booking not found');
      if (pitchBooking.hostId !== userId) throw new ForbiddenException('Not your booking');
      if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(pitchBooking.status)) {
        throw new BadRequestException('Pitch booking is not in a payable state');
      }
      amount = Number(pitchBooking.totalPrice);
      existingTransaction = pitchBooking.transaction;
    }

    // Re-use existing pending transaction or create a new one
    let transaction = existingTransaction;
    if (!transaction || transaction.status === 'FAILED') {
      transaction = await this.prisma.transaction.create({
        data: {
          userId,
          ...(bookingId ? { bookingId } : { pitchBookingId }),
          amount,
          platformFee: amount * PLATFORM_FEE_RATE,
          gateway: gateway as any,
          status: 'PENDING',
        },
      });
    } else if (transaction.gateway !== gateway) {
      // Update gateway on existing pending transaction
      transaction = await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { gateway: gateway as any },
      });
    }

    const paymentUrl = this.buildPaymentUrl(transaction.id, amount, gateway);

    return {
      transactionId: transaction.id,
      paymentUrl,
      amount,
      gateway,
      status: transaction.status,
      bookingType: bookingId ? 'MATCH' : 'PITCH',
    };
  }

  // ─── Get payment status (for polling) ─────────────────────────────────────
  async getStatus(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            matchId: true,
            match: { select: { title: true, startTime: true } },
          },
        },
        pitchBooking: {
          select: {
            id: true,
            status: true,
            title: true,
            startTime: true,
          },
        },
      },
    });

    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.userId !== userId) throw new ForbiddenException('Not your transaction');

    return {
      transactionId: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      gateway: transaction.gateway,
      gatewayTxId: transaction.gatewayTxId,
      heldAt: transaction.heldAt,
      releasedAt: transaction.releasedAt,
      refundedAt: transaction.refundedAt,
      createdAt: transaction.createdAt,
      booking: transaction.booking ?? null,
      pitchBooking: transaction.pitchBooking ?? null,
      bookingType: transaction.bookingId ? 'MATCH' : 'PITCH',
      isPaid:
        transaction.status === 'HELD' ||
        transaction.status === 'RELEASED' ||
        transaction.status === 'PARTIALLY_REFUNDED',
    };
  }

  // ─── Pay with in-app wallet ────────────────────────────────────────────────
  async payWithWallet(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.userId !== userId) throw new ForbiddenException('Not your transaction');
    if (transaction.status !== 'PENDING') {
      throw new BadRequestException('Transaction already processed');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const amount = Number(transaction.amount);
    if (Number(user.credit) < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance (have ${user.credit}, need ${amount})`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Deduct wallet balance through the ledger (single source of truth)
      await this.wallet.adjust(
        userId,
        -amount,
        'MATCH_PAYMENT',
        {
          reference: transaction.bookingId ?? transaction.pitchBookingId ?? transactionId,
          description: transaction.bookingId
            ? 'Match payment'
            : 'Pitch booking payment',
        },
        tx,
      );

      // Match payments enter escrow (HELD) and are released — with the pitch
      // owner's payout — after the match ends. Pitch bookings settle instantly.
      await tx.transaction.update({
        where: { id: transactionId },
        data: transaction.bookingId
          ? { status: 'HELD', gateway: 'WALLET', heldAt: new Date() }
          : {
              status: 'RELEASED',
              gateway: 'WALLET',
              heldAt: new Date(),
              releasedAt: new Date(),
            },
      });

      // Confirm the linked booking
      if (transaction.bookingId) {
        await tx.booking.update({
          where: { id: transaction.bookingId },
          data: { status: 'CONFIRMED' },
        });
      } else if (transaction.pitchBookingId) {
        await tx.pitchBooking.update({
          where: { id: transaction.pitchBookingId },
          data: { status: 'CONFIRMED' },
        });
      }
    });

    const updated = await this.getStatus(transactionId, userId);
    return { message: 'Payment successful', ...updated };
  }
}
