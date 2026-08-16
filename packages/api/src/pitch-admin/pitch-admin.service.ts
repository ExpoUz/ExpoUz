import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Keep only valid {open,close} day entries; drop malformed/closed days. */
function sanitizeHours(input: any): Record<string, { open: string; close: string }> | null {
  if (!input || typeof input !== 'object') return null;
  const out: Record<string, { open: string; close: string }> = {};
  for (const day of DAYS) {
    const h = input[day];
    if (h && typeof h.open === 'string' && typeof h.close === 'string' && HHMM.test(h.open) && HHMM.test(h.close)) {
      out[day] = { open: h.open, close: h.close };
    }
  }
  return Object.keys(out).length ? out : null;
}

@Injectable()
export class PitchAdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(ownerId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const pitches = await this.prisma.pitch.findMany({
      where: { ownerId },
      select: { id: true },
    });
    const pitchIds = pitches.map((p) => p.id);

    const matches = await this.prisma.match.findMany({
      where: { pitchId: { in: pitchIds } },
      select: { id: true },
    });
    const matchIds = matches.map((m) => m.id);

    const [
      totalPitches,
      matchesThisMonth,
      revenueData,
      uniquePlayers,
    ] = await Promise.all([
      pitches.length,
      this.prisma.match.count({
        where: { pitchId: { in: pitchIds }, startTime: { gte: monthStart } },
      }),
      this.prisma.transaction.aggregate({
        where: {
          booking: { matchId: { in: matchIds } },
          status: { in: ['HELD', 'RELEASED'] },
        },
        _sum: { amount: true },
      }),
      this.prisma.booking.findMany({
        where: { matchId: { in: matchIds }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        distinct: ['userId'],
        select: { userId: true },
      }),
    ]);

    return {
      totalPitches,
      matchesThisMonth,
      totalRevenue: revenueData._sum.amount || 0,
      uniquePlayers: uniquePlayers.length,
    };
  }

  async getPitches(ownerId: string) {
    return this.prisma.pitch.findMany({
      where: { ownerId },
      include: {
        amenities: true,
        _count: { select: { matches: true, followers: true } },
      },
    });
  }

  async getMatches(ownerId: string, page = 1, limit = 20) {
    const pitches = await this.prisma.pitch.findMany({
      where: { ownerId },
      select: { id: true },
    });
    const pitchIds = pitches.map((p) => p.id);

    const skip = (page - 1) * limit;
    const [matches, total] = await Promise.all([
      this.prisma.match.findMany({
        where: { pitchId: { in: pitchIds } },
        include: {
          pitch: { select: { name: true } },
          host: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { bookings: true } },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.match.count({ where: { pitchId: { in: pitchIds } } }),
    ]);

    return { data: matches, total, page, limit };
  }

  async getPlayers(ownerId: string) {
    const pitches = await this.prisma.pitch.findMany({
      where: { ownerId },
      select: { id: true },
    });
    const pitchIds = pitches.map((p) => p.id);

    const bookings = await this.prisma.booking.findMany({
      where: {
        match: { pitchId: { in: pitchIds } },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      distinct: ['userId'],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            eloRating: true,
            skillLevel: true,
          },
        },
      },
    });

    return bookings.map((b) => b.user);
  }

  async getRevenue(ownerId: string) {
    const pitches = await this.prisma.pitch.findMany({
      where: { ownerId },
      select: { id: true, commission: true },
    });
    const pitchIds = pitches.map((p) => p.id);
    const avgCommission =
      pitches.reduce((sum, p) => sum + p.commission, 0) / (pitches.length || 1);

    const revenueData = await this.prisma.transaction.aggregate({
      where: {
        booking: { match: { pitchId: { in: pitchIds } } },
        status: { in: ['HELD', 'RELEASED'] },
      },
      _sum: { amount: true },
    });

    const grossRevenue = Number(revenueData._sum.amount || 0);
    const commissionDeducted = grossRevenue * avgCommission;
    const netRevenue = grossRevenue - commissionDeducted;

    return { grossRevenue, commissionDeducted, netRevenue };
  }

  async getSchedule(ownerId: string, from: string, to: string) {
    const pitches = await this.prisma.pitch.findMany({
      where: { ownerId },
      select: { id: true, name: true },
    });
    const pitchIds = pitches.map((p) => p.id);

    const bookings = await this.prisma.booking.findMany({
      where: {
        match: {
          pitchId: { in: pitchIds },
          startTime: { gte: new Date(from), lte: new Date(to) },
        },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      include: {
        match: {
          include: {
            pitch: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { match: { startTime: 'asc' } },
    });

    return bookings;
  }

  // ─── Pitch Hire Bookings (PitchBooking) for this admin ────────────────────
  async getPitchBookings(ownerId: string, filters: {
    status?: string;
    pitchId?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, pitchId, page = 1, limit = 20 } = filters;

    const ownedPitchIds = await this.prisma.pitch
      .findMany({ where: { ownerId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    const where: any = {
      pitchId: pitchId ? pitchId : { in: ownedPitchIds },
    };
    if (status) where.status = status;

    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      this.prisma.pitchBooking.findMany({
        where,
        include: {
          pitch: { select: { id: true, name: true } },
          host: { select: { id: true, firstName: true, lastName: true, phone: true } },
          participants: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
          transaction: { select: { status: true, amount: true, gateway: true } },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pitchBooking.count({ where }),
    ]);

    return { data: bookings, total, page, limit };
  }

  // ─── Get pitch detail with today's schedule ───────────────────────────────
  async getPitchDetail(ownerId: string, pitchId: string) {
    const pitch = await this.prisma.pitch.findFirstOrThrow({
      where: { id: pitchId, ownerId },
      include: {
        amenities: true,
        location: true,
        _count: { select: { matches: true, pitchBookings: true, followers: true } },
      },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayMatches, todayPitchBookings, upcoming] = await Promise.all([
      this.prisma.match.findMany({
        where: {
          pitchId,
          startTime: { gte: todayStart, lte: todayEnd },
        },
        include: {
          host: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { bookings: true } },
        },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.pitchBooking.findMany({
        where: {
          pitchId,
          startTime: { gte: todayStart, lte: todayEnd },
          status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_PAYMENT'] },
        },
        include: {
          host: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.match.findMany({
        where: {
          pitchId,
          startTime: { gt: new Date() },
          status: { in: ['OPEN', 'FULL', 'CONFIRMED'] },
        },
        include: { _count: { select: { bookings: true } } },
        orderBy: { startTime: 'asc' },
        take: 10,
      }),
    ]);

    return { pitch, todayMatches, todayPitchBookings, upcoming };
  }

  // ─── Update pitch availability (toggle active) ────────────────────────────
  async updatePitchAvailability(ownerId: string, pitchId: string, isActive: boolean) {
    const pitch = await this.prisma.pitch.findFirstOrThrow({
      where: { id: pitchId, ownerId },
    });
    return this.prisma.pitch.update({
      where: { id: pitch.id },
      data: { isActive },
    });
  }

  /**
   * Owner sets operating hours + slot/court config for one of their venues.
   * Ownership-scoped; validates the openingHours shape (bad days dropped, a
   * missing day = closed). Powers the "Free courts" availability filter.
   */
  async updateOpeningHours(
    ownerId: string,
    pitchId: string,
    body: { openingHours?: any; slotDuration?: number; courtCount?: number },
  ) {
    const pitch = await this.prisma.pitch.findFirstOrThrow({ where: { id: pitchId, ownerId } });

    const data: any = {};
    if (body.openingHours !== undefined) {
      const clean = sanitizeHours(body.openingHours);
      // Prisma needs DbNull (not JS null) to clear a nullable Json column.
      data.openingHours = clean ?? Prisma.DbNull;
    }
    if (body.slotDuration !== undefined) {
      const d = Number(body.slotDuration);
      if (![30, 60, 90, 120].includes(d)) throw new BadRequestException('Invalid slotDuration');
      data.slotDuration = d;
    }
    if (body.courtCount !== undefined) {
      const c = Number(body.courtCount);
      if (!Number.isInteger(c) || c < 1 || c > 20) throw new BadRequestException('Invalid courtCount');
      data.courtCount = c;
    }

    return this.prisma.pitch.update({ where: { id: pitch.id }, data });
  }

  // ─── Users who have booked at this admin's pitches ───────────────────────
  async getPitchUsers(ownerId: string, filters: {
    pitchId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { pitchId, search, page = 1, limit = 20 } = filters;

    const ownedPitchIds = await this.prisma.pitch
      .findMany({ where: { ownerId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    const pitchFilter = pitchId ? [pitchId] : ownedPitchIds;

    // Get all user IDs who have booked (match or pitch hire)
    const [matchUserIds, pitchBookingUserIds] = await Promise.all([
      this.prisma.booking.findMany({
        where: { match: { pitchId: { in: pitchFilter } }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.pitchBookingParticipant.findMany({
        where: { booking: { pitchId: { in: pitchFilter } } },
        distinct: ['userId'],
        select: { userId: true },
      }),
    ]);

    const userIds = [...new Set([
      ...matchUserIds.map((b) => b.userId),
      ...pitchBookingUserIds.map((p) => p.userId),
    ])];

    const where: any = {
      id: { in: userIds },
      deletedAt: null,
    };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          phone: true,
          eloRating: true,
          skillLevel: true,
          reliabilityScore: true,
          isBanned: true,
          _count: { select: { bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, total, page, limit };
  }

  // ─── Cancel a match on admin's pitch ─────────────────────────────────────
  async cancelMatchOnPitch(ownerId: string, matchId: string) {
    const match = await this.prisma.match.findFirstOrThrow({
      where: { id: matchId, pitch: { ownerId } },
    });
    return this.prisma.match.update({
      where: { id: match.id },
      data: { status: 'CANCELLED' },
    });
  }

  // ─── Cancel a pitch booking on admin's pitch ──────────────────────────────
  async cancelPitchBooking(ownerId: string, bookingId: string) {
    const booking = await this.prisma.pitchBooking.findFirstOrThrow({
      where: { id: bookingId, pitch: { ownerId } },
    });
    return this.prisma.pitchBooking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED_REFUND' },
    });
  }
}
