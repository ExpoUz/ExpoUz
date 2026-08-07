import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LevelService } from '../level/level.service';
import { WalletService } from '../payments/wallet/wallet.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private level: LevelService,
    private wallet: WalletService,
  ) {}

  /**
   * Manual wallet top-up / correction by an admin. Used during the
   * gateway-pending launch period to credit users who paid via offline bank
   * transfer, and to resolve disputes. Always ledgered.
   */
  async adjustWallet(
    targetUserId: string,
    amount: number,
    description: string,
    type: 'TOPUP' | 'ADMIN_ADJUSTMENT' = 'TOPUP',
  ) {
    if (!amount || Number.isNaN(amount)) {
      throw new BadRequestException('A non-zero amount is required');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    const balance = await this.wallet.adjust(targetUserId, amount, type, {
      description: description || (amount > 0 ? 'Admin top-up' : 'Admin adjustment'),
      // Admin corrections may push a balance negative (e.g. clawing back a bonus).
      allowOverdraft: type === 'ADMIN_ADJUSTMENT',
    });
    return { userId: targetUserId, balance };
  }

  async linkTelegram(userId: string, telegramId: string) {
    if (!telegramId) throw new BadRequestException('telegramId is required');
    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramId: String(telegramId) },
    });
    return { linked: true };
  }

  async getDashboard() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      activeMatches,
      revenueToday,
      revenueMonth,
      pendingPitches,
      failedTransactions,
      activeBookingsToday,
      footballMatches,
      padelMatches,
      footballPitches,
      padelPitches,
      assessedPadelPlayers,
      unverifiedPhoneUsers,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, isBanned: false } }),
      this.prisma.match.count({ where: { status: { in: ['OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS'] } } }),
      this.prisma.transaction.aggregate({
        where: {
          status: { in: ['HELD', 'RELEASED'] },
          createdAt: { gte: todayStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: { in: ['HELD', 'RELEASED'] },
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.pitch.count({ where: { isVerified: false, rejectionReason: null } }),
      this.prisma.transaction.count({ where: { status: 'FAILED' } }),
      this.prisma.booking.count({
        where: {
          status: 'CONFIRMED',
          createdAt: { gte: todayStart },
        },
      }),
      this.prisma.match.count({ where: { sport: 'FOOTBALL' } }),
      this.prisma.match.count({ where: { sport: 'PADEL' } }),
      this.prisma.pitch.count({ where: { sport: 'FOOTBALL' } }),
      this.prisma.pitch.count({ where: { sport: 'PADEL' } }),
      this.prisma.user.count({ where: { padelInitialSet: true } }),
      this.prisma.user.count({
        where: { deletedAt: null, isBanned: false, phoneVerified: false },
      }),
    ]);

    return {
      totalUsers,
      activeMatches,
      revenueToday: revenueToday._sum.amount || 0,
      revenueMonth: revenueMonth._sum.amount || 0,
      pendingPitches,
      failedTransactions,
      unverifiedPhoneUsers,
      dailyActiveUsers: activeBookingsToday,
      sportBreakdown: {
        football: { matches: footballMatches, pitches: footballPitches },
        padel: { matches: padelMatches, pitches: padelPitches, assessedPlayers: assessedPadelPlayers },
      },
    };
  }

  async getUsers(filters: {
    role?: string;
    isBanned?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { role, isBanned, search, page = 1, limit = 20 } = filters;
    const where: any = {};
    if (role) where.role = role;
    if (isBanned !== undefined) where.isBanned = isBanned;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
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
          phone: true,
          email: true,
          role: true,
          isBanned: true,
          eloRating: true,
          skillLevel: true,
          reliabilityScore: true,
          gamesAttended: true,
          padelLevel: true,
          padelInitialSet: true,
          phoneVerified: true,
          phoneVerifyMethod: true,
          phoneVerifiedAt: true,
          city: true,
          createdAt: true,
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

  async changeUserRole(id: string, role: string) {
    return this.prisma.user.update({
      where: { id },
      data: { role: role as any },
    });
  }

  async banUser(id: string, reason: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const newBanned = !user.isBanned;

    return this.prisma.user.update({
      where: { id },
      data: {
        isBanned: newBanned,
        bannedAt: newBanned ? new Date() : null,
        bannedReason: newBanned ? reason : null,
      },
    });
  }

  async getPendingPitches() {
    return this.prisma.pitch.findMany({
      where: { isVerified: false, rejectionReason: null },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, phone: true } },
        amenities: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async verifyPitch(id: string, approved: boolean, reason?: string) {
    return this.prisma.pitch.update({
      where: { id },
      data: {
        isVerified: approved,
        rejectionReason: approved ? null : reason,
      },
    });
  }

  async getMatches(filters: { sport?: string; status?: string; page?: number; limit?: number }) {
    const { sport, status, page = 1, limit = 20 } = filters;
    const where: any = {};
    if (status) where.status = status;
    if (sport) where.sport = sport;

    const skip = (page - 1) * limit;
    const [matches, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        include: {
          pitch: { select: { name: true, district: true } },
          host: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { bookings: true } },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.match.count({ where }),
    ]);

    return { data: matches, total, page, limit };
  }

  async cancelMatch(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        bookings: { where: { status: 'CONFIRMED' }, include: { transaction: true } },
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status === 'CANCELLED') return match;

    await this.prisma.$transaction(async (tx) => {
      await tx.match.update({ where: { id }, data: { status: 'CANCELLED' } });

      for (const booking of match.bookings) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED_REFUND' },
        });
        // Admin force-cancel refunds every paid player in full, to the wallet.
        if (booking.transaction && ['HELD', 'RELEASED'].includes(booking.transaction.status)) {
          await tx.transaction.update({
            where: { id: booking.transaction.id },
            data: { status: 'REFUNDED', refundedAt: new Date() },
          });
          await this.wallet.adjust(
            booking.userId,
            Number(booking.transaction.amount),
            'REFUND',
            { reference: id, description: 'Match cancelled by admin — full refund' },
            tx,
          );
        }
      }
    });

    return { id, status: 'CANCELLED', refunded: match.bookings.length };
  }

  async getTransactions(filters: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = filters;
    const where: any = {};
    if (status) where.status = status;

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          booking: { include: { match: { select: { title: true, startTime: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data: transactions, total, page, limit };
  }

  async manualRelease(transactionId: string) {
    const transaction = await this.prisma.transaction.findUniqueOrThrow({
      where: { id: transactionId },
    });

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    await this.prisma.booking.update({
      where: { id: transaction.bookingId },
      data: { status: 'COMPLETED' },
    });

    return { message: 'Transaction released manually' };
  }

  async getRevenueAnalytics(period: 'week' | 'month' | 'year') {
    const now = new Date();
    let since: Date;
    let groupBy: string;

    switch (period) {
      case 'week':
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case 'month':
        since = new Date(now.getFullYear(), now.getMonth(), 1);
        groupBy = 'day';
        break;
      case 'year':
        since = new Date(now.getFullYear(), 0, 1);
        groupBy = 'month';
        break;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        status: { in: ['HELD', 'RELEASED'] },
        createdAt: { gte: since },
      },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<string, { date: string; revenue: number; bookings: number }> = {};

    for (const tx of transactions) {
      const d = new Date(tx.createdAt);
      const key =
        groupBy === 'month'
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      if (!grouped[key]) grouped[key] = { date: key, revenue: 0, bookings: 0 };
      grouped[key].revenue += Number(tx.amount);
      grouped[key].bookings += 1;
    }

    return Object.values(grouped);
  }

  // Padel-specific analytics: level distribution across the 0–7 bands and the
  // casual vs competitive match split. Only counts players who've been assessed.
  async getPadelAnalytics() {
    const [players, casual, competitive] = await Promise.all([
      this.prisma.user.findMany({
        where: { padelInitialSet: true },
        select: { padelLevel: true },
      }),
      this.prisma.match.count({ where: { sport: 'PADEL', matchType: 'CASUAL' } }),
      this.prisma.match.count({ where: { sport: 'PADEL', matchType: 'COMPETITIVE' } }),
    ]);

    const bands = [
      { band: '0–1', min: 0, max: 1 },
      { band: '1–2', min: 1, max: 2 },
      { band: '2–3', min: 2, max: 3 },
      { band: '3–4', min: 3, max: 4 },
      { band: '4–5', min: 4, max: 5 },
      { band: '5–6', min: 5, max: 6 },
      { band: '6–7', min: 6, max: 7.0001 },
    ];
    const distribution = bands.map((b) => ({
      band: b.band,
      count: players.filter((p) => p.padelLevel >= b.min && p.padelLevel < b.max).length,
    }));

    return {
      totalAssessed: players.length,
      distribution,
      matchTypeSplit: { casual, competitive },
    };
  }

  // Football analytics: match count + capacity fill rate per format (5v5/6v6).
  async getFootballAnalytics() {
    const matches = await this.prisma.match.findMany({
      where: { sport: 'FOOTBALL' },
      select: { format: true, currentPlayers: true, maxPlayers: true },
    });
    const byFormat: Record<string, { matches: number; filled: number; capacity: number }> = {};
    for (const m of matches) {
      const f = m.format || 'other';
      if (!byFormat[f]) byFormat[f] = { matches: 0, filled: 0, capacity: 0 };
      byFormat[f].matches++;
      byFormat[f].filled += m.currentPlayers;
      byFormat[f].capacity += m.maxPlayers || 0;
    }
    const formats = Object.entries(byFormat).map(([format, v]) => ({
      format,
      matches: v.matches,
      fillRate: v.capacity > 0 ? Math.round((v.filled / v.capacity) * 100) : 0,
    }));
    return { totalMatches: matches.length, formats };
  }

  // ─── Disputed padel-result moderation ──────────────────────────────────────
  async getDisputedResults() {
    return this.prisma.matchResult.findMany({
      where: { isDisputed: true },
      include: {
        match: { select: { id: true, title: true, sport: true, format: true, startTime: true } },
        players: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Confirm a disputed result (applies level changes) or dismiss the dispute.
  async resolveDispute(matchId: string, confirm: boolean) {
    const result = await this.prisma.matchResult.findUnique({ where: { matchId } });
    if (!result) throw new NotFoundException('No result for this match');

    if (confirm) {
      await this.prisma.matchResult.update({
        where: { matchId },
        data: { isConfirmed: true, isDisputed: false },
      });
      await this.prisma.match.update({
        where: { id: matchId },
        data: { resultSubmitted: true, status: 'COMPLETED' },
      });
      await this.level.processMatchResult(matchId);
    } else {
      await this.prisma.matchResult.update({
        where: { matchId },
        data: { isDisputed: false },
      });
    }
    return { resolved: true, confirmed: confirm };
  }

  async updateCommission(rate: number) {
    return this.prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { commissionRate: rate },
      create: { id: 'singleton', commissionRate: rate, platformFeeRate: 0.05 },
    });
  }

  /** Read platform settings, creating the singleton row with defaults if absent. */
  async getSettings() {
    return this.prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
  }

  /** Patch platform settings (commission, platform fee, cancellation window/fee). */
  async updateSettings(dto: {
    commissionRate?: number;
    platformFeeRate?: number;
    cancellationFeeRate?: number;
    cancellationWindowHours?: number;
  }) {
    const data: any = {};
    if (dto.commissionRate != null) data.commissionRate = Number(dto.commissionRate);
    if (dto.platformFeeRate != null) data.platformFeeRate = Number(dto.platformFeeRate);
    if (dto.cancellationFeeRate != null)
      data.cancellationFeeRate = Number(dto.cancellationFeeRate);
    if (dto.cancellationWindowHours != null)
      data.cancellationWindowHours = Math.round(Number(dto.cancellationWindowHours));
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No valid settings provided');
    }
    return this.prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    });
  }

  async createAnnouncement(dto: {
    title: string;
    body: string;
    targetRole?: string;
    city?: string;
  }) {
    const where: any = {};
    if (dto.targetRole) where.role = dto.targetRole;
    if (dto.city) where.city = dto.city;

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    let sent = 0;
    for (const user of users) {
      await this.notificationsService.send(user.id, 'ADMIN_ANNOUNCEMENT', undefined, {
        title: dto.title,
        body: dto.body,
      });
      sent++;
    }

    return { message: `Announcement sent to ${sent} users` };
  }

  /** Announcement history, reconstructed from the notifications that were sent. */
  async getAnnouncements() {
    const groups = await this.prisma.notification.groupBy({
      by: ['title', 'body'],
      where: { type: 'ADMIN_ANNOUNCEMENT' },
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: 50,
    });
    return groups.map((g) => ({
      title: g.title,
      body: g.body,
      recipients: g._count._all,
      sentAt: g._max.createdAt,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN — Pitch Admin Management
  // ═══════════════════════════════════════════════════════════════════════════

  async getPitchAdmins(filters: {
    search?: string;
    city?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, city, page = 1, limit = 20 } = filters;
    const where: any = {
      role: { in: ['PITCH_OWNER', 'ADMIN'] },
      deletedAt: null,
    };
    if (city) where.city = city;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const skip = (page - 1) * limit;
    const [admins, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          role: true,
          city: true,
          isBanned: true,
          createdAt: true,
          session: { select: { lastSeenAt: true } },
          ownedPitches: {
            select: {
              id: true,
              name: true,
              isActive: true,
              isVerified: true,
              city: true,
              _count: { select: { matches: true, pitchBookings: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const ONLINE_THRESHOLD_MINUTES = 5;
    const now = new Date();
    const result = admins.map((a) => ({
      ...a,
      isOnline:
        a.session
          ? (now.getTime() - new Date(a.session.lastSeenAt).getTime()) <
            ONLINE_THRESHOLD_MINUTES * 60 * 1000
          : false,
      lastSeenAt: a.session?.lastSeenAt ?? null,
      pitchCount: a.ownedPitches.length,
      activePitchCount: a.ownedPitches.filter((p) => p.isActive && p.isVerified).length,
    }));

    return { data: result, total, page, limit };
  }

  async getPitchAdminById(id: string) {
    const admin = await this.prisma.user.findFirstOrThrow({
      where: { id, role: { in: ['PITCH_OWNER', 'ADMIN'] } },
      include: {
        session: true,
        ownedPitches: {
          include: {
            amenities: true,
            location: true,
            _count: { select: { matches: true, pitchBookings: true, followers: true } },
          },
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    const pitchIds = admin.ownedPitches.map((p) => p.id);

    const [totalBookings, totalRevenue, recentBookings] = await Promise.all([
      this.prisma.booking.count({
        where: { match: { pitchId: { in: pitchIds } }, status: 'CONFIRMED' },
      }),
      this.prisma.transaction.aggregate({
        where: {
          booking: { match: { pitchId: { in: pitchIds } } },
          status: { in: ['HELD', 'RELEASED'] },
        },
        _sum: { amount: true },
      }),
      this.prisma.booking.findMany({
        where: { match: { pitchId: { in: pitchIds } } },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          match: { select: { title: true, startTime: true, pitch: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const ONLINE_THRESHOLD_MINUTES = 5;
    const now = new Date();

    return {
      ...admin,
      isOnline:
        admin.session
          ? (now.getTime() - new Date(admin.session.lastSeenAt).getTime()) <
            ONLINE_THRESHOLD_MINUTES * 60 * 1000
          : false,
      stats: {
        totalBookings,
        totalRevenue: totalRevenue._sum.amount || 0,
        pitchCount: admin.ownedPitches.length,
      },
      recentBookings,
    };
  }

  async createPitchAdmin(dto: {
    phone: string;
    firstName: string;
    lastName: string;
    city: string;
    email?: string;
  }) {
    // Check no existing user with same phone
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) {
      // Upgrade existing player to PITCH_OWNER
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { role: 'PITCH_OWNER' },
        select: { id: true, firstName: true, lastName: true, phone: true, role: true },
      });
    }

    return this.prisma.user.create({
      data: {
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        city: dto.city,
        email: dto.email,
        role: 'PITCH_OWNER',
        isVerified: true,
      },
      select: { id: true, firstName: true, lastName: true, phone: true, role: true },
    });
  }

  async updatePitchAdmin(id: string, dto: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    city?: string;
    email?: string;
    isBanned?: boolean;
    bannedReason?: string;
  }) {
    const data: any = { ...dto };
    if (dto.isBanned !== undefined) {
      data.bannedAt = dto.isBanned ? new Date() : null;
    }
    return this.prisma.user.update({ where: { id }, data });
  }

  async deletePitchAdmin(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), role: 'PLAYER' },
    });
    return { message: 'Pitch admin removed' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN — Enhanced User Management
  // ═══════════════════════════════════════════════════════════════════════════

  async getUserById(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: {
        session: true,
        preferredPositions: true,
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 30 },
        bookings: {
          include: {
            match: { select: { title: true, startTime: true, status: true } },
            transaction: { select: { amount: true, status: true, gateway: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        walletTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        pitchBookings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    const ONLINE_THRESHOLD_MINUTES = 5;
    const now = new Date();

    return {
      ...user,
      isOnline:
        user.session
          ? (now.getTime() - new Date(user.session.lastSeenAt).getTime()) <
            ONLINE_THRESHOLD_MINUTES * 60 * 1000
          : false,
      stats: {
        totalBookings: user.bookings.length,
        confirmedBookings: user.bookings.filter((b) => b.status === 'CONFIRMED').length,
        totalSpent: user.transactions
          .filter((t) => ['HELD', 'RELEASED'].includes(t.status))
          .reduce((sum, t) => sum + Number(t.amount), 0),
      },
    };
  }

  async updateUser(id: string, dto: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    city?: string;
    email?: string;
    role?: string;
    credit?: number;
    skillLevel?: string;
  }) {
    return this.prisma.user.update({
      where: { id },
      data: dto as any,
      select: {
        id: true, firstName: true, lastName: true, phone: true,
        role: true, city: true, credit: true, skillLevel: true,
      },
    });
  }

  async deleteUser(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'User soft-deleted' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN — Location Management
  // ═══════════════════════════════════════════════════════════════════════════

  async getLocations(filters: { city?: string; search?: string }) {
    const where: any = {};
    if (filters.city) where.city = filters.city;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { district: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.location.findMany({
      where,
      include: { _count: { select: { pitches: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createLocation(dto: {
    name: string;
    city: string;
    district?: string;
    lat?: number;
    lng?: number;
  }) {
    return this.prisma.location.create({ data: dto });
  }

  async updateLocation(id: string, dto: {
    name?: string;
    city?: string;
    district?: string;
    lat?: number;
    lng?: number;
    isActive?: boolean;
  }) {
    return this.prisma.location.update({ where: { id }, data: dto });
  }

  async deleteLocation(id: string) {
    // Unlink pitches first to avoid FK violation
    await this.prisma.pitch.updateMany({
      where: { locationId: id },
      data: { locationId: null },
    });
    await this.prisma.location.delete({ where: { id } });
    return { message: 'Location deleted' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN — Pitch Management (full CRUD)
  // ═══════════════════════════════════════════════════════════════════════════

  async getAllPitches(filters: {
    sport?: string;
    city?: string;
    ownerId?: string;
    locationId?: string;
    isVerified?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, isVerified, sport, city, ownerId, locationId, search } = filters;
    const where: any = {};
    if (sport) where.sport = sport;
    if (city) where.city = city;
    if (ownerId) where.ownerId = ownerId;
    if (locationId) where.locationId = locationId;
    if (isVerified !== undefined) where.isVerified = isVerified;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const skip = (page - 1) * limit;
    const [pitches, total] = await Promise.all([
      this.prisma.pitch.findMany({
        where,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, phone: true } },
          location: true,
          amenities: true,
          _count: { select: { matches: true, pitchBookings: true, followers: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pitch.count({ where }),
    ]);

    return { data: pitches, total, page, limit };
  }

  async createPitch(dto: {
    ownerId: string;
    name: string;
    addressLine: string;
    district: string;
    city: string;
    lat: number;
    lng: number;
    hourlyRate: number;
    surfaceType?: string;
    pitchSize?: string;
    isIndoor?: boolean;
    locationId?: string;
    commission?: number;
    description?: string;
    photos?: string[];
  }) {
    return this.prisma.pitch.create({
      data: {
        ...dto,
        isVerified: true, // Super admin creates pitches pre-verified
        hourlyRate: dto.hourlyRate as any,
        surfaceType: (dto.surfaceType ?? 'ARTIFICIAL') as any,
        pitchSize: (dto.pitchSize ?? 'SEVEN_A_SIDE') as any,
      },
      include: { owner: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async updatePitch(id: string, dto: {
    name?: string;
    addressLine?: string;
    district?: string;
    city?: string;
    lat?: number;
    lng?: number;
    hourlyRate?: number;
    isActive?: boolean;
    isVerified?: boolean;
    locationId?: string;
    ownerId?: string;
    commission?: number;
    description?: string;
  }) {
    return this.prisma.pitch.update({ where: { id }, data: dto as any });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN — Activity Log & Online Status
  // ═══════════════════════════════════════════════════════════════════════════

  async getActivityLog(filters: {
    userId?: string;
    entityType?: string;
    action?: string;
    category?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const { userId, entityType, action, category, from, to, page = 1, limit = 30 } = filters;
    const where: any = {};
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (category) where.category = category as any;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { data: logs, total, page, limit };
  }

  async recordActivity(
    userId: string,
    action: string,
    entityType?: string,
    entityId?: string,
    meta?: any,
    ipAddress?: string,
  ) {
    return this.prisma.activityLog.create({
      data: { userId, action, entityType, entityId, meta, ipAddress },
    });
  }

  async getOnlineStatus() {
    const ONLINE_THRESHOLD_MINUTES = 5;
    const since = new Date(Date.now() - ONLINE_THRESHOLD_MINUTES * 60 * 1000);

    const sessions = await this.prisma.userSession.findMany({
      where: { lastSeenAt: { gte: since } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    const byRole = sessions.reduce(
      (acc, s) => {
        const role = s.user.role;
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalOnline: sessions.length,
      byRole,
      sessions: sessions.map((s) => ({
        userId: s.userId,
        user: s.user,
        lastSeenAt: s.lastSeenAt,
        deviceInfo: s.deviceInfo,
      })),
    };
  }

  async updateUserSession(userId: string, deviceInfo?: string, ipAddress?: string) {
    return this.prisma.userSession.upsert({
      where: { userId },
      update: { lastSeenAt: new Date(), deviceInfo, ipAddress },
      create: { userId, deviceInfo, ipAddress },
    });
  }

  // ═══════════ VENUE OWNER CRM OVERSIGHT ═══════════
  // Platform-admin visibility into how venue owners use the CRM: who reveals
  // whose phone, who broadcasts, and who players report — plus the kill switches.

  private async namesFor(ids: string[]) {
    const uniq = [...new Set(ids)].filter(Boolean);
    if (uniq.length === 0) return new Map<string, string>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniq } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  }

  /** Owners actively using CRM features, with reveal/broadcast/report tallies. */
  async getCrmUsage() {
    const owners = await this.prisma.user.findMany({
      where: { role: 'PITCH_OWNER' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        crmDisabled: true,
        broadcastDisabled: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const [reveals, broadcasts, reports] = await Promise.all([
      this.prisma.contactReveal.groupBy({ by: ['ownerId'], _count: { _all: true } }),
      this.prisma.venueBroadcast.groupBy({
        by: ['ownerId'],
        _count: { _all: true },
        _sum: { recipientCount: true },
      }),
      this.prisma.venueReport.groupBy({
        by: ['ownerId'],
        where: { resolved: false },
        _count: { _all: true },
      }),
    ]);

    const revealBy = new Map(reveals.map((r) => [r.ownerId, r._count._all]));
    const bcastBy = new Map(broadcasts.map((b) => [b.ownerId, b]));
    const reportBy = new Map(reports.map((r) => [r.ownerId, r._count._all]));

    return owners.map((o) => ({
      ownerId: o.id,
      name: `${o.firstName} ${o.lastName}`.trim(),
      crmDisabled: o.crmDisabled,
      broadcastDisabled: o.broadcastDisabled,
      reveals: revealBy.get(o.id) ?? 0,
      broadcasts: bcastBy.get(o.id)?._count._all ?? 0,
      broadcastRecipients: bcastBy.get(o.id)?._sum.recipientCount ?? 0,
      openReports: reportBy.get(o.id) ?? 0,
    }));
  }

  /** Contact-reveal audit log across all venues (who revealed whose number, when). */
  async getContactRevealLog(limit = 100) {
    const rows = await this.prisma.contactReveal.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
    const names = await this.namesFor(rows.flatMap((r) => [r.ownerId, r.playerId]));
    return rows.map((r) => ({
      id: r.id,
      ownerId: r.ownerId,
      ownerName: names.get(r.ownerId) ?? '—',
      playerId: r.playerId,
      playerName: names.get(r.playerId) ?? '—',
      reason: r.reason,
      createdAt: r.createdAt,
    }));
  }

  /** Broadcast log across all venues. */
  async getBroadcastLog(limit = 100) {
    const rows = await this.prisma.venueBroadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
    const names = await this.namesFor(rows.map((r) => r.ownerId));
    return rows.map((r) => ({
      id: r.id,
      ownerId: r.ownerId,
      ownerName: names.get(r.ownerId) ?? '—',
      segment: r.segment,
      message: r.message,
      recipientCount: r.recipientCount,
      createdAt: r.createdAt,
    }));
  }

  /** Player reports of venue misuse. */
  async getVenueReports(includeResolved = false) {
    const rows = await this.prisma.venueReport.findMany({
      where: includeResolved ? {} : { resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const names = await this.namesFor(rows.flatMap((r) => [r.ownerId, r.playerId]));
    return rows.map((r) => ({
      id: r.id,
      ownerId: r.ownerId,
      ownerName: names.get(r.ownerId) ?? '—',
      playerId: r.playerId,
      playerName: names.get(r.playerId) ?? '—',
      reason: r.reason,
      resolved: r.resolved,
      createdAt: r.createdAt,
    }));
  }

  async resolveVenueReport(reportId: string) {
    await this.prisma.venueReport.update({
      where: { id: reportId },
      data: { resolved: true },
    });
    return { resolved: true };
  }

  /** Kill switches: disable an owner's CRM view or broadcast ability. */
  async setOwnerCrmFlags(
    ownerId: string,
    flags: { crmDisabled?: boolean; broadcastDisabled?: boolean },
  ) {
    const data: { crmDisabled?: boolean; broadcastDisabled?: boolean } = {};
    if (typeof flags.crmDisabled === 'boolean') data.crmDisabled = flags.crmDisabled;
    if (typeof flags.broadcastDisabled === 'boolean') data.broadcastDisabled = flags.broadcastDisabled;
    if (Object.keys(data).length === 0) throw new BadRequestException('No flags provided');
    const owner = await this.prisma.user.update({
      where: { id: ownerId },
      data,
      select: { id: true, crmDisabled: true, broadcastDisabled: true },
    });
    return owner;
  }
}
