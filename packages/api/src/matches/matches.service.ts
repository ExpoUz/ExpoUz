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
import { LevelService } from '../level/level.service';
import { SubmitResultDto } from './dto/submit-result.dto';
import { BookingType } from '@prisma/client';
import { getMaxPlayers } from './format-caps';
import { EscrowService } from '../escrow/escrow.service';
import { MatchGateway } from '../gateway/match.gateway';
import { WalletService } from '../payments/wallet/wallet.service';
import { syncPlayerCount } from './player-count';
import { randomBytes } from 'crypto';

const PLATFORM_FEE_RATE = 0.05;

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
    private level: LevelService,
    private escrow: EscrowService,
    private matchGateway: MatchGateway,
    private wallet: WalletService,
  ) {}

  private generateShareCode(): string {
    return randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  }

  private buildShareLink(shareCode: string): string {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'ExpoScoreBot';
    return `https://t.me/${botUsername}?start=join_${shareCode}`;
  }

  // Join eligibility gate. Padel requires an assessed level (padelInitialSet)
  // before joining any match, plus a level-range check when the host set one
  // (presence of min/max == "level required"). Football keeps a normalized
  // eloRating range check. Errors carry a `code` the TMA branches on.
  private async assertJoinEligibility(
    match: { sport: Sport; minLevel: number | null; maxLevel: number | null },
    userId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { padelLevel: true, padelInitialSet: true, eloRating: true },
    });
    if (!user) return;

    if (match.sport === Sport.PADEL) {
      if (!user.padelInitialSet) {
        throw new BadRequestException({
          code: 'PADEL_LEVEL_REQUIRED',
          message: 'Please set your padel level before joining a match.',
        });
      }
      const lvl = user.padelLevel;
      if (match.minLevel != null && lvl < match.minLevel) {
        throw new BadRequestException({
          code: 'LEVEL_TOO_LOW',
          message: `This match is for level ${match.minLevel}–${match.maxLevel}. Your level is ${lvl.toFixed(2)}.`,
        });
      }
      if (match.maxLevel != null && lvl > match.maxLevel) {
        throw new BadRequestException({
          code: 'LEVEL_TOO_HIGH',
          message: `This match is for level ${match.minLevel}–${match.maxLevel}. Your level is ${lvl.toFixed(2)}.`,
        });
      }
      return;
    }

    // Football: optional normalized-elo range, no level-set requirement.
    if (match.minLevel == null && match.maxLevel == null) return;
    const userLevel = user.eloRating / 1000;
    if (match.minLevel != null && userLevel < match.minLevel) {
      throw new BadRequestException(
        `Your level (${userLevel.toFixed(2)}) is below this match's minimum (${match.minLevel}).`,
      );
    }
    if (match.maxLevel != null && userLevel > match.maxLevel) {
      throw new BadRequestException(
        `Your level (${userLevel.toFixed(2)}) is above this match's maximum (${match.maxLevel}).`,
      );
    }
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
    if (query.matchType) where.matchType = query.matchType;
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
          bookings: {
            where: { status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING_PAYMENT'] } },
            select: {
              teamSide: true,
              user: {
                select: { id: true, firstName: true, avatarUrl: true, padelLevel: true },
              },
            },
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
        // Active bookings with team side + padel level — used by the padel
        // (Team A/B) detail layout, which has no formation positions.
        bookings: {
          where: { status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING_PAYMENT'] } },
          select: {
            id: true,
            teamSide: true,
            isHostBooking: true,
            isGuestSlot: true,
            guestLabel: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                padelLevel: true,
              },
            },
          },
        },
        _count: { select: { bookings: { where: { status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } } } } },
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

    if (bookingType === BookingType.GROUP_BOOKING) {
      organizerPlayerCount = dto.organizerPlayerCount || 1;
      extraSpotsAvailable = dto.extraSpotsAvailable || 0;
      maxPlayers = organizerPlayerCount + extraSpotsAvailable;
      organizerTotalPaid = pricePerPlayer * organizerPlayerCount;
    } else if (bookingType === BookingType.FULL_BOOKING) {
      fullBookingHours = dto.fullBookingHours || 1;
      fullBookingTotalCost = Number(pitch.hourlyRate ?? 0) * fullBookingHours;
      pricePerPlayer = 0;
      maxPlayers = dto.maxPlayers || 22;
    } else {
      // OPEN_EVENT — player cap is fixed by the sport + format
      // (football: 5v5->10, 6v6->12; padel: 1v1->2, 2v2->4).
      const cap = getMaxPlayers(sport, dto.format);
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

    // A pure FULL_BOOKING is a venue rental — the host only occupies a slot if
    // they say they're playing. Every other type seats the host.
    const hostPlays = bookingType !== BookingType.FULL_BOOKING || dto.hostIsPlaying === true;
    const hostSide = (dto.teamSide as any) ?? 'HOME';

    // Everything that must be consistent — the match, the host's slot, any
    // organizer-paid guest slots, the organizer's payment, and the derived
    // currentPlayers — happens in ONE transaction. If the organizer can't cover
    // a group booking, nothing is created.
    const match = await this.prisma.$transaction(async (tx) => {
      const created = await tx.match.create({
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
          currentPlayers: 0, // set by syncPlayerCount below — never guessed
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
          matchType: dto.matchType || 'COMPETITIVE',
          minLevel: dto.minLevel ?? null,
          maxLevel: dto.maxLevel ?? null,
          shareCode,
          telegramShareLink,
          // status left at default OPEN — the codebase treats OPEN as the live,
          // joinable/listed state (join() and findAll() key off OPEN). DRAFT/PUBLISHED
          // exist in the enum for future use but must not replace OPEN here.
        },
      });

      // The host occupies their own slot on the match they created.
      if (hostPlays) {
        await tx.booking.create({
          data: {
            userId: hostId,
            matchId: created.id,
            status: 'CONFIRMED',
            teamSide: hostSide,
            isHostBooking: true,
            qrCode: `${created.id}_host_${randomBytes(4).toString('hex')}`,
          },
        });
      }

      // GROUP_BOOKING: the organizer pre-pays for organizerPlayerCount seats
      // (themselves + guests). Create the guest-slot bookings and settle the
      // whole group in the same transaction.
      if (bookingType === BookingType.GROUP_BOOKING) {
        const seats = organizerPlayerCount ?? 1;
        const guestCount = Math.max(0, seats - (hostPlays ? 1 : 0));
        for (let i = 0; i < guestCount; i++) {
          await tx.booking.create({
            data: {
              userId: hostId, // owned by the organizer; occupant TBD
              matchId: created.id,
              status: 'CONFIRMED',
              teamSide: hostSide,
              isGuestSlot: true,
              guestLabel: `Guest ${i + 1}`,
              qrCode: `${created.id}_guest${i + 1}_${randomBytes(4).toString('hex')}`,
            },
          });
        }

        const groupTotal = pricePerPlayer * seats;
        if (groupTotal > 0) {
          // Debits the organizer through the ledger; throws
          // "Insufficient wallet balance" (whole tx rolls back) if they can't cover it.
          const hostBooking = await tx.booking.findFirst({
            where: { matchId: created.id, userId: hostId },
            orderBy: { createdAt: 'asc' },
          });
          await this.wallet.adjust(
            hostId,
            -groupTotal,
            'MATCH_PAYMENT',
            { reference: created.id, description: `Group booking (${seats} players) — ${created.title}` },
            tx,
          );
          // Escrow: held until the match ends, then released to the pitch owner
          // minus the platform fee (same model as an individual join).
          if (hostBooking) {
            await tx.transaction.create({
              data: {
                userId: hostId,
                bookingId: hostBooking.id,
                amount: groupTotal,
                platformFee: groupTotal * PLATFORM_FEE_RATE,
                gateway: 'WALLET',
                status: 'HELD',
                heldAt: new Date(),
              },
            });
          }
        }
      }

      await syncPlayerCount(tx, created.id);
      return created;
    });

    // A group booking pre-pays into escrow — schedule its release to the owner
    // after the match ends (idempotent per match).
    if (bookingType === BookingType.GROUP_BOOKING && pricePerPlayer > 0) {
      await this.escrow
        .scheduleMatchRelease({
          id: match.id,
          startTime: match.startTime,
          durationMinutes: match.durationMinutes,
        })
        .catch(() => {});
    }

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

    await this.prisma.$transaction(async (tx) => {
      await tx.match.update({ where: { id }, data: { status: 'CANCELLED' } });

      for (const booking of match.bookings) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED_REFUND' },
        });
        // Refund only money that was actually paid (HELD/RELEASED) — a PENDING
        // transaction never debited the wallet.
        if (booking.transaction && ['HELD', 'RELEASED'].includes(booking.transaction.status)) {
          await tx.transaction.update({
            where: { id: booking.transaction.id },
            data: { status: 'REFUNDED', refundedAt: new Date() },
          });
          // Host/admin cancellation refunds the full amount to the wallet.
          await this.wallet.adjust(
            booking.userId,
            Number(booking.transaction.amount),
            'REFUND',
            { reference: id, description: 'Match cancelled — full refund' },
            tx,
          );
        }
      }
    });

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
    const bookings = await this.prisma.booking.findMany({
      where: { matchId, status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'COMPLETED'] } },
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
      orderBy: { createdAt: 'asc' },
    });
    // One occupied slot per booking (host, guest, or a joined player).
    return bookings.map((b) => ({
      bookingId: b.id,
      user: b.user,
      isHost: b.isHostBooking,
      isGuest: b.isGuestSlot,
      guestLabel: b.guestLabel,
      teamSide: b.teamSide,
      checkedIn: b.checkedIn,
      position: b.positionTaken ?? null,
    }));
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

    // Padel level-set requirement + host level range (hard wall, server-side).
    await this.assertJoinEligibility(match, userId);

    // Guest slots are owned by the organizer but are not that user's own
    // membership — exclude them so the organizer isn't wrongly told "already booked".
    const existingBooking = await this.prisma.booking.findFirst({
      where: {
        matchId,
        userId,
        isGuestSlot: false,
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

    const price = Number(match.pricePerPlayer ?? 0);

    // Slot allocation AND payment happen in one transaction — if either fails,
    // no money moves and no slot is taken.
    let result: { booking: any; count: number };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        // Serialize concurrent joins on the last slot: lock the match row so two
        // players racing for the final spot can't both pass the capacity check.
        await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE`;

        // Re-count occupancy from real bookings inside the tx — never trust the
        // cached currentPlayers for the capacity decision.
        const occupied = await tx.booking.count({
          where: { matchId, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } },
        });
        if (occupied >= match.maxPlayers) {
          throw new ConflictException({ code: 'MATCH_FULL' });
        }

        // Verify funds before creating anything, so the error carries real numbers.
        if (price > 0) {
          const u = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { credit: true },
          });
          if (Number(u.credit) < price) {
            throw new BadRequestException({
              code: 'INSUFFICIENT_BALANCE',
              needed: price,
              balance: Number(u.credit),
            });
          }
        }

        const b = await tx.booking.create({
          data: {
            userId,
            matchId,
            status: 'CONFIRMED', // paid below (or free) — never a dangling PENDING slot
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

        if (price > 0) {
          // Debit the wallet through the ledger (single source of truth) and hold
          // the payment in escrow until the match ends.
          await this.wallet.adjust(
            userId,
            -price,
            'MATCH_PAYMENT',
            { reference: matchId, description: `Joined ${match.title}` },
            tx,
          );
          await tx.transaction.create({
            data: {
              userId,
              bookingId: b.id,
              amount: price,
              platformFee: price * PLATFORM_FEE_RATE,
              gateway: 'WALLET',
              status: 'HELD',
              heldAt: new Date(),
            },
          });
        }

        const count = await syncPlayerCount(tx, matchId);
        return { booking: b, count };
      });
    } finally {
      // Release the position reservation whether the join committed or rolled
      // back, so a rejected join doesn't hold the slot until the lock's TTL.
      if (positionId) {
        await this.redis.releasePosition(positionId);
      }
    }

    const booking = result.booking;

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

    // Schedule auto-release of escrow after the match ends (idempotent per
    // match) and broadcast the join to anyone viewing this match live.
    await this.escrow
      .scheduleMatchRelease({
        id: match.id,
        startTime: match.startTime,
        durationMinutes: match.durationMinutes,
      })
      .catch(() => {});
    this.matchGateway.emitPlayerJoined(matchId, {
      userId,
      teamSide: teamSide ?? null,
      currentPlayers: result.count,
      maxPlayers: match.maxPlayers,
    });

    return { booking, paid: price > 0, amount: price };
  }

  async leave(matchId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        matchId,
        userId,
        isGuestSlot: false, // the user's own membership, not a seat they hold for a guest
        status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
      },
      include: { match: true, transaction: true, positionTaken: true },
    });

    if (!booking) throw new NotFoundException('Active booking not found');

    // When the organizer of a group booking leaves, all the seats they paid for
    // (their host slot + every guest slot) are released together.
    const guestSlots = booking.isHostBooking
      ? await this.prisma.booking.findMany({
          where: {
            matchId,
            userId,
            isGuestSlot: true,
            status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
          },
        })
      : [];

    const hoursBeforeMatch =
      (new Date(booking.match.startTime).getTime() - Date.now()) / (1000 * 60 * 60);

    // Only money that actually left the wallet can come back: a PENDING
    // transaction was never paid, so it must never produce a refund credit.
    const paidTransaction =
      booking.transaction && ['HELD', 'RELEASED'].includes(booking.transaction.status)
        ? booking.transaction
        : null;

    let newStatus: any = 'CANCELLED_REFUND';
    let refundAmount: number | null | undefined = paidTransaction?.amount?.toNumber();

    if (hoursBeforeMatch <= 0) {
      newStatus = 'NO_SHOW';
      refundAmount = null;
    } else if (hoursBeforeMatch <= booking.match.cancellationDeadlineHours) {
      newStatus = 'CANCELLED_PENALTY';
      refundAmount = paidTransaction ? Number(paidTransaction.amount) * 0.5 : null;
    }

    await this.prisma.$transaction(async (tx) => {
      const releasedIds = [booking.id, ...guestSlots.map((g) => g.id)];
      await tx.booking.updateMany({
        where: { id: { in: releasedIds } },
        data: { status: newStatus },
      });

      if (booking.transaction) {
        const txStatus = !paidTransaction
          ? 'FAILED' // never paid — close it out, nothing to refund
          : newStatus === 'CANCELLED_REFUND'
            ? 'REFUNDED'
            : 'PARTIALLY_REFUNDED';
        await tx.transaction.update({
          where: { id: booking.transaction.id },
          data: { status: txStatus, refundedAt: paidTransaction ? new Date() : null },
        });
      }

      if (refundAmount) {
        await this.wallet.adjust(
          userId,
          refundAmount,
          'REFUND',
          {
            reference: matchId,
            description:
              newStatus === 'CANCELLED_PENALTY'
                ? 'Left match (late) — 50% refund'
                : 'Left match — full refund',
          },
          tx,
        );
      }

      // Free any positions held by the released bookings.
      await tx.matchPosition.updateMany({
        where: { bookingId: { in: releasedIds } },
        data: { bookingId: null, isLocked: false },
      });

      // currentPlayers is recomputed from the surviving bookings — never decremented by hand.
      await syncPlayerCount(tx, matchId);
    });

    this.matchGateway.emitPlayerLeft(matchId, { userId });

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

    // Release held escrow through the escrow service so the pitch owner's
    // payout is credited (ledgered) — never flip transactions RELEASED here.
    await this.escrow.releaseMatchEscrow(matchId);

    for (const booking of match.bookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'COMPLETED' },
      });
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

  // ─── MATCH RESULTS & SCORING ──────────────────────────────────────────────
  private determineWinner(dto: SubmitResultDto): number {
    let team1Sets = 0;
    let team2Sets = 0;
    const sets: [number | undefined, number | undefined][] = [
      [dto.team1Set1, dto.team2Set1],
      [dto.team1Set2, dto.team2Set2],
      [dto.team1Set3, dto.team2Set3],
    ];
    for (const [a, b] of sets) {
      if (a == null || b == null) continue;
      if (a > b) team1Sets++;
      else if (b > a) team2Sets++;
    }
    return team1Sets >= team2Sets ? 1 : 2;
  }

  async getResult(matchId: string) {
    return this.prisma.matchResult.findUnique({
      where: { matchId },
      include: {
        players: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async submitResult(matchId: string, userId: string, dto: SubmitResultDto) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { result: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (match.result) {
      throw new ConflictException('A result has already been submitted for this match');
    }

    // Verify the submitter actually played in this match.
    const participants = await this.prisma.booking.findMany({
      where: { matchId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      select: { userId: true },
    });
    const playerIds = participants.map((p) => p.userId);
    if (!playerIds.includes(userId)) {
      throw new ForbiddenException('Only players in this match can submit a result');
    }

    const result = await this.prisma.matchResult.create({
      data: {
        matchId,
        team1Set1: dto.team1Set1,
        team2Set1: dto.team2Set1,
        team1Set2: dto.team1Set2,
        team2Set2: dto.team2Set2,
        team1Set3: dto.team1Set3 ?? null,
        team2Set3: dto.team2Set3 ?? null,
        winningTeam: this.determineWinner(dto),
        submittedById: userId,
        confirmedBy: [userId],
        players: { connect: playerIds.map((id) => ({ id })) },
      },
    });

    // Ask the other players to confirm the score.
    for (const pid of playerIds) {
      if (pid === userId) continue;
      await this.notifications
        .send(pid, 'MATCH_CONFIRMED' as any, matchId, { matchTitle: match.title })
        .catch(() => {});
    }

    return result;
  }

  async confirmResult(matchId: string, userId: string) {
    const result = await this.prisma.matchResult.findUnique({ where: { matchId } });
    if (!result) throw new NotFoundException('No result submitted for this match');
    if (result.isConfirmed) return result;

    const confirmedBy = [...new Set([...result.confirmedBy, userId])];
    const updated = await this.prisma.matchResult.update({
      where: { matchId },
      data: { confirmedBy, isConfirmed: confirmedBy.length >= 2, isDisputed: false },
    });

    // Once confirmed by at least two players → run the rating algorithm.
    if (updated.isConfirmed) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { resultSubmitted: true, status: 'COMPLETED' },
      });
      await this.level.processMatchResult(matchId);
    }
    return updated;
  }

  async disputeResult(matchId: string, userId: string) {
    const result = await this.prisma.matchResult.findUnique({ where: { matchId } });
    if (!result) throw new NotFoundException('No result submitted for this match');
    if (result.isConfirmed) {
      throw new ConflictException('This result is already confirmed and cannot be disputed');
    }
    return this.prisma.matchResult.update({
      where: { matchId },
      data: { isDisputed: true },
    });
  }
}
