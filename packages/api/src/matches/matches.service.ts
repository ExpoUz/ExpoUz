import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { QueryMatchesDto, TimeOfDay, SortBy } from './dto/query-matches.dto';
import { RatePlayerDto } from './dto/rate-player.dto';
import { FormationService } from '../formation/formation.service';

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private formationService: FormationService,
  ) {}

  async findAll(query: QueryMatchesDto) {
    const {
      sport,
      city,
      district,
      date,
      dateFrom,
      dateTo,
      timeOfDay,
      format,
      skillLevel,
      isIndoor,
      maxPrice,
      minSpotsAvailable,
      sortBy,
      page = 1,
      limit = 20,
    } = query;

    const where: any = {
      status: { in: ['OPEN', 'FULL'] },
      startTime: { gt: new Date() },
    };

    if (sport) where.sport = sport;
    if (format) where.format = format;
    if (skillLevel) where.skillFilter = skillLevel;
    if (maxPrice) where.pricePerPlayer = { lte: maxPrice };
    if (city) where.pitch = { ...where.pitch, city };
    if (district) where.pitch = { ...where.pitch, district };
    if (isIndoor !== undefined) where.pitch = { ...where.pitch, isIndoor };

    if (date) {
      const d = new Date(date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      where.startTime = { gte: start, lte: end };
    } else if (dateFrom || dateTo) {
      where.startTime = {};
      if (dateFrom) where.startTime.gte = new Date(dateFrom);
      if (dateTo) where.startTime.lte = new Date(dateTo);
    }

    if (timeOfDay) {
      const hourRanges: Record<TimeOfDay, [number, number]> = {
        MORNING: [6, 12],
        AFTERNOON: [12, 17],
        EVENING: [17, 21],
        NIGHT: [21, 6],
      };
      // Time-of-day filtering done in-memory after fetch for simplicity
    }

    if (minSpotsAvailable) {
      // Filter applied in-memory
    }

    let orderBy: any = { startTime: 'asc' };
    if (sortBy === SortBy.PRICE) orderBy = { pricePerPlayer: 'asc' };

    const skip = (page - 1) * limit;

    const [matches, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        include: {
          pitch: {
            select: {
              id: true,
              name: true,
              addressLine: true,
              district: true,
              city: true,
              lat: true,
              lng: true,
              photos: true,
              isIndoor: true,
            },
          },
          host: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          _count: { select: { bookings: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.match.count({ where }),
    ]);

    let result = matches;

    if (timeOfDay) {
      const hourRanges: Record<string, [number, number]> = {
        MORNING: [6, 12],
        AFTERNOON: [12, 17],
        EVENING: [17, 21],
        NIGHT: [21, 6],
      };
      const [startH, endH] = hourRanges[timeOfDay];
      result = result.filter((m) => {
        const h = new Date(m.startTime).getHours();
        if (timeOfDay === TimeOfDay.NIGHT) return h >= 21 || h < 6;
        return h >= startH && h < endH;
      });
    }

    if (minSpotsAvailable) {
      result = result.filter(
        (m) => m.maxPlayers - m.currentPlayers >= minSpotsAvailable,
      );
    }

    if (sortBy === SortBy.SPOTS) {
      result = result.sort(
        (a, b) => b.maxPlayers - b.currentPlayers - (a.maxPlayers - a.currentPlayers),
      );
    }

    return { data: result, total, page, limit };
  }

  async findToday() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    return this.prisma.match.findMany({
      where: {
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { in: ['OPEN', 'FULL', 'CONFIRMED'] },
      },
      include: {
        pitch: { select: { id: true, name: true, addressLine: true, district: true } },
        host: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        pitch: { include: { amenities: true } },
        host: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, eloRating: true } },
        positions: {
          include: {
            booking: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
              },
            },
          },
        },
        _count: { select: { bookings: true } },
      },
    });

    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  async create(hostId: string, dto: CreateMatchDto) {
    const pitch = await this.prisma.pitch.findUnique({ where: { id: dto.pitchId } });
    if (!pitch || !pitch.isActive) {
      throw new NotFoundException('Pitch not found or not active');
    }

    const startTime = new Date(dto.startTime);
    const dayName = startTime.toLocaleDateString('en-US', { weekday: 'short' });
    const timeStr = startTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const sport = dto.sport || 'FOOTBALL';
    const autoTitle = `${sport.charAt(0) + sport.slice(1).toLowerCase()} at ${pitch.name} - ${dayName} ${timeStr}`;

    const match = await this.prisma.match.create({
      data: {
        pitchId: dto.pitchId,
        hostId,
        title: autoTitle,
        sport: dto.sport || 'FOOTBALL',
        format: dto.format,
        startTime,
        durationMinutes: dto.durationMinutes || 60,
        maxPlayers: dto.maxPlayers,
        minPlayers: dto.minPlayers || 10,
        pricePerPlayer: dto.pricePerPlayer,
        isCoEd: dto.isCoEd !== undefined ? dto.isCoEd : true,
        skillFilter: dto.skillFilter,
        description: dto.description,
        formation: dto.formation,
        cancellationDeadlineHours: dto.cancellationDeadlineHours || 2,
      },
    });

    if (dto.formation) {
      await this.formationService.generatePositions(match.id, dto.formation, dto.format);
    }

    return match;
  }

  async update(id: string, hostId: string, dto: Partial<CreateMatchDto>) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException('Match not found');
    if (match.hostId !== hostId) throw new ForbiddenException('Not the host');

    const updateData: any = { ...dto };
    if (dto.startTime) updateData.startTime = new Date(dto.startTime);

    return this.prisma.match.update({ where: { id }, data: updateData });
  }

  async cancel(id: string, actorId: string, isAdmin = false) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        bookings: {
          where: { status: 'CONFIRMED' },
          include: { transaction: true },
        },
      },
    });

    if (!match) throw new NotFoundException('Match not found');
    if (!isAdmin && match.hostId !== actorId) throw new ForbiddenException('Not authorized');
    if (match.status === 'CANCELLED') throw new ConflictException('Match already cancelled');

    const hoursUntil =
      (new Date(match.startTime).getTime() - Date.now()) / (1000 * 60 * 60);

    await this.prisma.match.update({ where: { id }, data: { status: 'CANCELLED' } });

    for (const booking of match.bookings) {
      if (booking.transaction) {
        const { EscrowService } = await import('../escrow/escrow.service');
        // Handled by injected service — see MatchesModule for the actual DI
      }
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED_REFUND' },
      });
      if (booking.transaction) {
        await this.prisma.transaction.update({
          where: { id: booking.transaction.id },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });
        await this.prisma.user.update({
          where: { id: booking.userId },
          data: { credit: { increment: booking.transaction.amount } },
        });
      }
    }

    return { message: 'Match cancelled, refunds processed' };
  }

  async getPlayers(matchId: string) {
    return this.prisma.booking.findMany({
      where: { matchId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
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
        positionTaken: true,
      },
    });
  }

  async getFormation(matchId: string) {
    const positions = await this.prisma.matchPosition.findMany({
      where: { matchId },
      include: {
        booking: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: [{ teamSide: 'asc' }, { jerseyNumber: 'asc' }],
    });

    const home = positions.filter((p) => p.teamSide === 'HOME');
    const away = positions.filter((p) => p.teamSide === 'AWAY');

    return { home, away };
  }

  async join(
    matchId: string,
    userId: string,
    positionId?: string,
    teamSide?: string,
  ) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status !== 'OPEN' && match.status !== 'FULL') {
      throw new ConflictException('Match is not accepting players');
    }
    if (match.status === 'FULL') {
      throw new ConflictException('Match is full');
    }

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
      if (!locked) throw new ConflictException('Position already being reserved');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          userId,
          matchId,
          status: 'PENDING_PAYMENT',
          teamSide: teamSide as any,
          qrCode: `${matchId}_${userId}_${Date.now()}`,
        },
      });

      if (positionId) {
        await tx.matchPosition.update({
          where: { id: positionId },
          data: { bookingId: b.id, isLocked: true },
        });
      }

      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: { currentPlayers: { increment: 1 } },
      });

      if (updatedMatch.currentPlayers >= updatedMatch.maxPlayers) {
        await tx.match.update({ where: { id: matchId }, data: { status: 'FULL' } });
      }

      return b;
    });

    if (positionId) {
      await this.redis.releasePosition(positionId);
    }

    return {
      booking,
      paymentInstructions: {
        bookingId: booking.id,
        amount: match.pricePerPlayer,
        message: 'Complete payment to confirm your spot',
      },
    };
  }

  async leave(matchId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        matchId,
        userId,
        status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
      },
      include: { match: true, transaction: true },
    });

    if (!booking) throw new NotFoundException('Active booking not found');

    const hoursBeforeMatch =
      (new Date(booking.match.startTime).getTime() - Date.now()) / (1000 * 60 * 60);

    let newStatus: any = 'CANCELLED_REFUND';
    let refundAmount = booking.transaction?.amount;

    if (hoursBeforeMatch <= 0) {
      newStatus = 'NO_SHOW';
      refundAmount = null;
    } else if (hoursBeforeMatch <= booking.match.cancellationDeadlineHours) {
      newStatus = 'CANCELLED_PENALTY';
      refundAmount = booking.transaction
        ? Number(booking.transaction.amount) * 0.5
        : null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: newStatus } });

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
        where: { id: matchId },
        data: { currentPlayers: { decrement: 1 }, status: 'OPEN' },
      });

      if (booking.positionTaken) {
        await tx.matchPosition.updateMany({
          where: { bookingId: booking.id },
          data: { bookingId: null, isLocked: false },
        });
      }
    });

    return { message: 'Left match', refundAmount };
  }

  async checkIn(matchId: string, bookingId: string, hostId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    if (match.hostId !== hostId) throw new ForbiddenException('Not the host');

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, matchId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { checkedIn: true },
    });
  }

  async complete(matchId: string, hostId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        bookings: {
          where: { status: 'CONFIRMED' },
          include: { transaction: true },
        },
      },
    });

    if (!match) throw new NotFoundException('Match not found');
    if (match.hostId !== hostId) throw new ForbiddenException('Not the host');

    await this.prisma.match.update({ where: { id: matchId }, data: { status: 'COMPLETED' } });

    for (const booking of match.bookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'COMPLETED' },
      });
      if (booking.transaction) {
        await this.prisma.transaction.update({
          where: { id: booking.transaction.id },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
      }
    }

    return { message: 'Match completed, payments released' };
  }

  async getQr(matchId: string, bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, matchId, userId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return { qrCode: booking.qrCode };
  }

  async ratePlayers(matchId: string, raterId: string, ratings: RatePlayerDto[]) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status !== 'COMPLETED') {
      throw new BadRequestException('Match is not completed yet');
    }

    const raterBooking = await this.prisma.booking.findFirst({
      where: { matchId, userId: raterId, status: 'COMPLETED' },
    });
    if (!raterBooking) throw new ForbiddenException('You did not play in this match');

    for (const rating of ratings) {
      if (rating.ratedId === raterId) continue;

      await this.prisma.playerRating.upsert({
        where: {
          matchId_raterId_ratedId: { matchId, raterId, ratedId: rating.ratedId },
        },
        update: { thumbsUp: rating.thumbsUp, comment: rating.comment },
        create: {
          matchId,
          raterId,
          ratedId: rating.ratedId,
          thumbsUp: rating.thumbsUp,
          comment: rating.comment,
        },
      });

      const eloDelta = rating.thumbsUp ? 15 : -10;
      const newElo = await this.prisma.user.update({
        where: { id: rating.ratedId },
        data: { eloRating: { increment: eloDelta } },
        select: { eloRating: true },
      });

      const thumbsUpCount = await this.prisma.playerRating.count({
        where: { ratedId: rating.ratedId, thumbsUp: true },
      });
      const totalRatings = await this.prisma.playerRating.count({
        where: { ratedId: rating.ratedId },
      });
      const reliabilityScore = totalRatings > 0 ? (thumbsUpCount / totalRatings) * 100 : 100;

      await this.prisma.user.update({
        where: { id: rating.ratedId },
        data: { reliabilityScore },
      });
    }

    return { message: 'Ratings submitted successfully' };
  }
}
