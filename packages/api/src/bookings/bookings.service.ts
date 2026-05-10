import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
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

      await tx.match.update({
        where: { id: matchId },
        data: { currentPlayers: { increment: 1 } },
      });

      return { booking, transaction };
    });

    if (positionId) {
      await this.redis.releasePosition(positionId);
    }

    const paymentUrl = this.generatePaymentUrl(
      result.transaction.id,
      amount,
      gateway as string,
    );

    return { booking: result.booking, transaction: result.transaction, paymentUrl };
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

    let newStatus: any = 'CANCELLED_REFUND';
    let refundAmount: number | null = booking.transaction
      ? Number(booking.transaction.amount)
      : null;

    if (hoursBeforeMatch <= 0) {
      newStatus = 'NO_SHOW';
      refundAmount = null;
    } else if (hoursBeforeMatch <= booking.match.cancellationDeadlineHours) {
      newStatus = 'CANCELLED_PENALTY';
      refundAmount = refundAmount !== null ? refundAmount * 0.5 : null;
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
        await tx.user.update({
          where: { id: userId },
          data: { credit: { increment: refundAmount } },
        });
      }

      await tx.match.update({
        where: { id: booking.matchId },
        data: { currentPlayers: { decrement: 1 }, status: 'OPEN' },
      });

      await tx.matchPosition.updateMany({
        where: { bookingId: id },
        data: { bookingId: null, isLocked: false },
      });
    });

    return { message: 'Booking cancelled', refundAmount };
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
