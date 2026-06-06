import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePitchBookingDto, PitchBookingType } from './dto/create-pitch-booking.dto';
import { TelegramService } from '../telegram/telegram.service';
import { PaymentsService } from '../payments/payments.service';

const CANCELLATION_WINDOW_HOURS = 5;
const CANCELLATION_FEE_RATE = 0.5; // 50% fee after window

@Injectable()
export class PitchBookingsService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
    private paymentsService: PaymentsService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Create a direct pitch booking (group hire or open-join)
  // ──────────────────────────────────────────────────────────────────────────
  async create(hostId: string, dto: CreatePitchBookingDto) {
    const { pitchId, title, type, startTime, durationHours, maxParticipants, notes, gateway = 'UZUM_PAY' } = dto;

    const pitch = await this.prisma.pitch.findUnique({ where: { id: pitchId } });
    if (!pitch) throw new NotFoundException('Pitch not found');
    if (!pitch.isActive || !pitch.isVerified) throw new BadRequestException('Pitch is not available for booking');

    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    // Check for conflicting bookings on the same pitch
    const conflict = await this.prisma.pitchBooking.findFirst({
      where: {
        pitchId,
        status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS'] },
        startTime: { lt: end },
        // end = startTime + durationHours hours — stored as computed check
      },
    });
    if (conflict) {
      const conflictEnd = new Date(
        conflict.startTime.getTime() + conflict.durationHours * 60 * 60 * 1000,
      );
      if (conflictEnd > start) {
        throw new ConflictException('Pitch is already booked for the requested time slot');
      }
    }

    const totalPrice = Number(pitch.hourlyRate) * durationHours;
    const pricePerParticipant =
      type === PitchBookingType.OPEN_JOIN && maxParticipants
        ? totalPrice / maxParticipants
        : null;

    const booking = await this.prisma.$transaction(async (tx) => {
      const pb = await tx.pitchBooking.create({
        data: {
          pitchId,
          hostId,
          title,
          type,
          startTime: start,
          durationHours,
          totalPrice,
          pricePerParticipant: pricePerParticipant ?? undefined,
          maxParticipants: maxParticipants ?? undefined,
          notes: notes ?? undefined,
          cancellationDeadlineHours: CANCELLATION_WINDOW_HOURS,
          cancellationFeeRate: CANCELLATION_FEE_RATE,
        },
      });

      // Auto-add host as first participant
      await tx.pitchBookingParticipant.create({
        data: { bookingId: pb.id, userId: hostId },
      });

      // Create group conversation for this booking
      const conversation = await tx.conversation.create({
        data: {
          type: 'PITCH_HIRE',
          pitchBookingId: pb.id,
          members: { create: { userId: hostId, isAdmin: true } },
        },
      });

      return { pitchBooking: pb, conversation };
    });

    // Create Transaction record so gateway webhooks can look it up
    const PLATFORM_FEE_RATE = 0.05;
    const transaction = await this.prisma.transaction.create({
      data: {
        userId: hostId,
        pitchBookingId: booking.pitchBooking.id,
        amount: totalPrice,
        platformFee: totalPrice * PLATFORM_FEE_RATE,
        gateway: gateway as any,
        status: 'PENDING',
      },
    });

    const paymentUrl = this.paymentsService.buildPaymentUrl(transaction.id, totalPrice, gateway);

    // Create Telegram forum topic (non-blocking)
    if (this.telegramService.isEnabled) {
      this.telegramService
        .createPitchBookingTopic(booking.pitchBooking.id, dto.title)
        .catch(() => {});
    }

    return { ...booking, transaction, paymentUrl };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Join an open-join pitch booking as an individual participant
  // ──────────────────────────────────────────────────────────────────────────
  async join(bookingId: string, userId: string) {
    const booking = await this.prisma.pitchBooking.findUnique({
      where: { id: bookingId },
      include: {
        participants: true,
        conversation: true,
      },
    });

    if (!booking) throw new NotFoundException('Pitch booking not found');
    if (booking.type !== PitchBookingType.OPEN_JOIN) {
      throw new BadRequestException('This is a group hire — individual joining is not allowed');
    }
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('This booking is not open for joining');
    }

    const alreadyJoined = booking.participants.some((p) => p.userId === userId);
    if (alreadyJoined) throw new ConflictException('Already joined this booking');

    if (booking.maxParticipants && booking.participants.length >= booking.maxParticipants) {
      throw new ConflictException('This booking is full');
    }

    return this.prisma.$transaction(async (tx) => {
      const participant = await tx.pitchBookingParticipant.create({
        data: {
          bookingId,
          userId,
          paidAmount: booking.pricePerParticipant ?? undefined,
        },
      });

      // Add to conversation
      if (booking.conversation) {
        await tx.conversationMember.create({
          data: { conversationId: booking.conversation.id, userId },
        });
      }

      return participant;
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // List open-join bookings (discovery)
  // ──────────────────────────────────────────────────────────────────────────
  async listOpen(pitchId?: string) {
    return this.prisma.pitchBooking.findMany({
      where: {
        type: PitchBookingType.OPEN_JOIN,
        status: 'CONFIRMED',
        startTime: { gt: new Date() },
        ...(pitchId ? { pitchId } : {}),
      },
      include: {
        pitch: { select: { name: true, addressLine: true, city: true } },
        host: { select: { firstName: true, lastName: true, avatarUrl: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: string) {
    const booking = await this.prisma.pitchBooking.findUnique({
      where: { id },
      include: {
        pitch: true,
        host: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        },
        conversation: { select: { id: true, telegramTopicId: true } },
      },
    });
    if (!booking) throw new NotFoundException('Pitch booking not found');
    return booking;
  }

  async myBookings(userId: string) {
    const [hosted, joined] = await Promise.all([
      this.prisma.pitchBooking.findMany({
        where: { hostId: userId },
        include: {
          pitch: { select: { name: true, city: true } },
          _count: { select: { participants: true } },
        },
        orderBy: { startTime: 'desc' },
      }),
      this.prisma.pitchBookingParticipant.findMany({
        where: { userId, booking: { hostId: { not: userId } } },
        include: {
          booking: {
            include: {
              pitch: { select: { name: true, city: true } },
              host: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      }),
    ]);
    return { hosted, joined: joined.map((j) => j.booking) };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cancel a booking — apply 50% fee if within 5-hour window
  // ──────────────────────────────────────────────────────────────────────────
  async cancel(id: string, userId: string) {
    const booking = await this.prisma.pitchBooking.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!booking) throw new NotFoundException('Pitch booking not found');
    if (booking.hostId !== userId) throw new ForbiddenException('Only the host can cancel');

    if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException('Booking cannot be cancelled in its current state');
    }

    const hoursUntilStart = (booking.startTime.getTime() - Date.now()) / (1000 * 60 * 60);

    let newStatus: string;
    let refundRate: number;
    let penalty: number;

    if (hoursUntilStart <= 0) {
      // Already started / past — no refund
      newStatus = 'NO_SHOW';
      refundRate = 0;
      penalty = Number(booking.totalPrice);
    } else if (hoursUntilStart < CANCELLATION_WINDOW_HOURS) {
      // Within cancellation window — 50% penalty
      newStatus = 'CANCELLED_PENALTY';
      refundRate = 1 - booking.cancellationFeeRate;
      penalty = Number(booking.totalPrice) * booking.cancellationFeeRate;
    } else {
      // Outside window — full refund
      newStatus = 'CANCELLED_REFUND';
      refundRate = 1;
      penalty = 0;
    }

    const refundAmount = Number(booking.totalPrice) * refundRate;

    await this.prisma.$transaction(async (tx) => {
      await tx.pitchBooking.update({
        where: { id },
        data: { status: newStatus as any },
      });

      if (refundAmount > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { credit: { increment: refundAmount } },
        });
      }
    });

    return {
      message: `Booking cancelled (${newStatus})`,
      refundAmount,
      penalty,
      hoursUntilStart: Math.max(0, hoursUntilStart),
      cancellationPolicy:
        hoursUntilStart >= CANCELLATION_WINDOW_HOURS
          ? 'full_refund'
          : hoursUntilStart <= 0
          ? 'no_refund'
          : 'partial_refund_50_percent_fee',
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Admin confirm payment for booking
  // ──────────────────────────────────────────────────────────────────────────
  async confirm(id: string) {
    return this.prisma.pitchBooking.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });
  }

}
