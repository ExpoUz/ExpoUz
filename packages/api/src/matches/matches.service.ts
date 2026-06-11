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
import { Sport } from '@prisma/client';
import { QueryMatchesDto, TimeOfDay, SortBy } from './dto/query-matches.dto';
import { RatePlayerDto } from './dto/rate-player.dto';
import { FormationService } from '../formation/formation.service';
import { TelegramService } from '../telegram/telegram.service';
import { ActivityService } from '../activity/activity.service';
import { RemindersService } from '../reminders/reminders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RankingService } from '../ranking/ranking.service';
import { BookingType } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private formationService: FormationService,
    private telegramService: TelegramService,
    private activity: ActivityService,
    private reminders: RemindersService,
    private notifications: NotificationsService,
    private ranking: RankingService,
  ) {}

  private generateShareCode(): string {
    return randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  }

  private buildShareLink(shareCode: string): string {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'ExpoScoreBot';
    return `https://t.me/${botUsername}?start=join_${shareCode}`;
  }

  // Player cap is derived from the "NvN" format string (per side × 2).
  // Padel: 1v1 -> 2, 2v2 -> 4. Generic so future formats (5v5 -> 10) just work.
  private getMaxPlayersForFormat(format: string): number {
    const m = format?.match(/^(\d+)v(\d+)$/);
    if (!m) {
      throw new BadRequestException(
        `Invalid format: ${format}. Use NvN (e.g. 1v1 or 2v2).`,
      );
    }
    return parseInt(m[1], 10) + parseInt(m[2], 10);
  }

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
    if (query.courtType) where.pitch = { ...where.pitch, courtType: query.courtType };
    if (query.isCovered !== undefined)
      where.pitch = { ...where.pitch, isCovered: query.isCovered };

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

  async getAvailableCities() {
    const pitches = await this.prisma.pitch.findMany({
      where: { isActive: true },
      select: { city: true, district: true },
    });
    const cities = new Map<string, Set<string>>();
    for (const p of pitches) {
      if (!cities.has(p.city)) cities.set(p.city, new Set());
      if (p.district) cities.get(p.city)!.add(p.district);
    }
    return Array.from(cities.entries()).map(([city, districts]) => ({
      city,
      districts: Array.from(districts).sort(),
    }));
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
    // DTO Sport enum and Prisma Sport enum diverge (pre-existing); cast the
    // overlapping value through.
    const sport: Sport = (dto.sport as unknown as Sport) || Sport.FOOTBALL;
    const bookingType: BookingType = dto.bookingType || BookingType.OPEN_EVENT;

    // ---- Pricing / capacity derived from booking type ----
    let pricePerPlayer = Number(dto.pricePerPlayer ?? 0);
    let maxPlayers = dto.maxPlayers ?? 0;
    let organizerPlayerCount: number | null = null;
    let organizerTotalPaid: number | null = null;
    let extraSpotsAvailable: number | null = null;
    let fullBookingHours: number | null = null;
    let fullBookingTotalCost: number | null = null;
    let currentPlayers = 1;

    if (bookingType === BookingType.GROUP_BOOKING) {
      organizerPlayerCount = dto.organizerPlayerCount || 1;
      extraSpotsAvailable = dto.extraSpotsAvailable || 0;
      maxPlayers = organizerPlayerCount + extraSpotsAvailable;
      organizerTotalPaid = pricePerPlayer * organizerPlayerCount;
      currentPlayers = organizerPlayerCount;
    } else if (bookingType === BookingType.FULL_BOOKING) {
      fullBookingHours = dto.fullBookingHours || 1;
      fullBookingTotalCost = Number(pitch.hourlyRate ?? 0) * fullBookingHours;
      pricePerPlayer = 0;
      maxPlayers = dto.maxPlayers || 22;
    } else {
      // OPEN_EVENT — player cap is fixed by the format (padel: 1v1->2, 2v2->4).
      const cap = this.getMaxPlayersForFormat(dto.format);
      if (maxPlayers && maxPlayers > cap) {
        throw new BadRequestException(
          `A ${dto.format} match allows a maximum of ${cap} players. You requested ${maxPlayers}.`,
        );
      }
      maxPlayers = cap; // lock to the format cap
    }

    const titleSport = sport.charAt(0) + sport.slice(1).toLowerCase();
    const autoTitle = this.generateTitle(bookingType, titleSport, dto.format, pitch.name);
    const shareCode = this.generateShareCode();
    const telegramShareLink = this.buildShareLink(shareCode);

    const match = await this.prisma.match.create({
      data: {
        pitchId: dto.pitchId,
        hostId,
        organizerId: hostId,
        title: autoTitle,
        sport,
        format: dto.format,
        startTime,
        durationMinutes: dto.durationMinutes || 60,
        maxPlayers,
        minPlayers: dto.minPlayers || Math.max(1, Math.floor(maxPlayers * 0.7)),
        currentPlayers,
        pricePerPlayer,
        bookingType,
        organizerPlayerCount,
        organizerTotalPaid,
        extraSpotsAvailable,
        fullBookingHours,
        fullBookingTotalCost,
        isPrivate: dto.isPrivate || false,
        isCoEd: dto.isCoEd !== undefined ? dto.isCoEd : true,
        skillFilter: dto.skillFilter,
        description: dto.description,
        formation: dto.formation,
        cancellationDeadlineHours: dto.cancellationDeadlineHours || 5,
        shareCode,
        telegramShareLink,
        // status left at default OPEN — the codebase treats OPEN as the live,
        // joinable/listed state (join() and findAll() key off OPEN). DRAFT/PUBLISHED
        // exist in the enum for future use but must not replace OPEN here.
      },
    });

    await this.activity.log(
      hostId,
      'MATCH_CREATED',
      `Created ${bookingType} match: ${match.title}`,
      { matchId: match.id, bookingType },
    );

    // Schedule the "free cancellation closing soon" reminder.
    await this.reminders.scheduleCancellationWarning(
      match.id,
      startTime,
      match.cancellationDeadlineHours,
    );

    if (dto.formation) {
      await this.formationService.generatePositions(match.id, dto.formation, dto.format);
    }

    // Create group conversation for this match
    await this.prisma.conversation.create({
      data: {
        type: 'MATCH_GROUP',
        matchId: match.id,
        members: { create: { userId: hostId, isAdmin: true } },
      },
    });

    // Create Telegram forum topic (non-blocking, fails gracefully)
    if (this.telegramService.isEnabled) {
      this.telegramService.createMatchTopic(match.id, autoTitle).catch(() => {});
    }

    return match;
  }

  private generateTitle(
    bookingType: BookingType,
    sport: string,
    format: string,
    pitchName: string,
  ): string {
    switch (bookingType) {
      case BookingType.GROUP_BOOKING:
        return `${format} ${sport} Group Game at ${pitchName}`;
      case BookingType.FULL_BOOKING:
        return `Full Pitch Booking at ${pitchName}`;
      default:
        return `${format} ${sport} Pickup Game at ${pitchName}`;
    }
  }

  // ─── INVITE / SHARE ───────────────────────────────────────────────────────
  async findByShareCode(shareCode: string) {
    const match = await this.prisma.match.findUnique({
      where: { shareCode },
      include: {
        pitch: { include: { amenities: true } },
        host: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        _count: { select: { bookings: true } },
      },
    });
    if (!match) throw new NotFoundException('Invalid invite link');
    return match;
  }

  async getShareLink(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      select: { id: true, shareCode: true, telegramShareLink: true, title: true },
    });
    if (!match) throw new NotFoundException('Match not found');

    // Backfill a share code for matches created before this feature existed.
    if (!match.shareCode) {
      const shareCode = this.generateShareCode();
      const telegramShareLink = this.buildShareLink(shareCode);
      await this.prisma.match.update({
        where: { id },
        data: { shareCode, telegramShareLink },
      });
      return { ...match, shareCode, telegramShareLink };
    }
    return match;
  }

  async joinByShareCode(
    shareCode: string,
    userId: string,
    body: { positionId?: string; teamSide?: string } = {},
  ) {
    const match = await this.prisma.match.findUnique({ where: { shareCode } });
    if (!match) throw new NotFoundException('Invalid invite link');
    if (match.status === 'CANCELLED') {
      throw new BadRequestException('This event has been cancelled');
    }
    if (match.currentPlayers >= match.maxPlayers) {
      throw new BadRequestException('This event is full');
    }
    const result = await this.join(match.id, userId, body.positionId, body.teamSide);
    await this.activity.log(userId, 'INVITE_ACCEPTED', `Joined via invite: ${match.title}`, {
      matchId: match.id,
      shareCode,
    });

    // Notify the organizer that someone joined via their invite link.
    if (match.organizerId && match.organizerId !== userId) {
      const joiner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true },
      });
      const spotsLeft = Math.max(0, match.maxPlayers - (match.currentPlayers + 1));
      await this.notifications.send(
        match.organizerId,
        // Valid NotificationType at runtime/schema; cast avoids a stale local client.
        'INVITE_JOINED' as any,
        match.id,
        { matchTitle: match.title, joinerName: joiner?.firstName, spotsLeft },
      );
    }
    return result;
  }

  // ─── PRICING PREVIEW ──────────────────────────────────────────────────────
  calculateGroupBookingPrice(
    pitchHourlyRate: number,
    organizerPlayerCount: number,
    totalMaxPlayers: number,
    hours: number,
  ) {
    const commissionRate = 0.1; // platform commission on the pitch
    const playerFeeRate = 0.05; // platform fee charged to players
    const totalPitchCost = pitchHourlyRate * hours;
    const platformCommission = totalPitchCost * commissionRate;
    const netPitchCost = totalPitchCost - platformCommission;
    const costPerPlayer = totalMaxPlayers > 0 ? netPitchCost / totalMaxPlayers : 0;
    const organizerTotal = costPerPlayer * organizerPlayerCount * (1 + playerFeeRate);

    return {
      totalPitchCost,
      platformCommission: Math.ceil(platformCommission),
      costPerPlayer: Math.ceil(costPerPlayer),
      organizerPayNow: Math.ceil(organizerTotal),
      perJoiningPlayer: Math.ceil(costPerPlayer * (1 + playerFeeRate)),
    };
  }

  async calculatePricingPreview(body: {
    pitchId: string;
    bookingType: string;
    organizerPlayerCount?: number;
    extraSpotsAvailable?: number;
    fullBookingHours?: number;
    maxPlayers?: number;
    pricePerPlayer?: number;
  }) {
    const pitch = await this.prisma.pitch.findUnique({ where: { id: body.pitchId } });
    if (!pitch) throw new NotFoundException('Pitch not found');
    const hourlyRate = Number(pitch.hourlyRate ?? 0);
    const playerFeeRate = 0.05;

    if (body.bookingType === 'GROUP_BOOKING') {
      const organizerCount = body.organizerPlayerCount || 1;
      const totalMax = organizerCount + (body.extraSpotsAvailable || 0);
      const hours = body.fullBookingHours || 1;
      return {
        bookingType: 'GROUP_BOOKING',
        ...this.calculateGroupBookingPrice(hourlyRate, organizerCount, totalMax, hours),
      };
    }

    if (body.bookingType === 'FULL_BOOKING') {
      const hours = body.fullBookingHours || 1;
      const totalCost = hourlyRate * hours;
      return {
        bookingType: 'FULL_BOOKING',
        hourlyRate,
        hours,
        totalCost,
        platformCommission: Math.ceil(totalCost * 0.1),
        youPay: totalCost,
      };
    }

    // OPEN_EVENT
    const base = Number(body.pricePerPlayer ?? 0);
    const fee = Math.ceil(base * playerFeeRate);
    return {
      bookingType: 'OPEN_EVENT',
      basePrice: base,
      platformFee: fee,
      youPay: base + fee,
    };
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

    // Close the Telegram topic
    const conversation = await this.prisma.conversation.findFirst({
      where: { matchId: id, type: 'MATCH_GROUP' },
      select: { telegramTopicId: true },
    });
    if (conversation?.telegramTopicId) {
      this.telegramService.closeTopic(conversation.telegramTopicId, 'Match cancelled').catch(() => {});
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

    // Add player to the match group conversation
    const conversation = await this.prisma.conversation.findFirst({
      where: { matchId, type: 'MATCH_GROUP' },
    });
    if (conversation) {
      const alreadyMember = await this.prisma.conversationMember.findFirst({
        where: { conversationId: conversation.id, userId },
      });
      if (!alreadyMember) {
        await this.prisma.conversationMember.create({
          data: { conversationId: conversation.id, userId },
        });
      }
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
      include: { match: true, transaction: true, positionTaken: true },
    });

    if (!booking) throw new NotFoundException('Active booking not found');

    const hoursBeforeMatch =
      (new Date(booking.match.startTime).getTime() - Date.now()) / (1000 * 60 * 60);

    let newStatus: any = 'CANCELLED_REFUND';
    let refundAmount: number | null | undefined = booking.transaction?.amount?.toNumber();

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

    // Ranking: credit a game played to each participant and re-derive levels.
    await this.ranking.incrementGamesAttended(match.bookings.map((b) => b.userId));

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
