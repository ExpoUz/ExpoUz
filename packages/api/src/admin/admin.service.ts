import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

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
    ]);

    return {
      totalUsers,
      activeMatches,
      revenueToday: revenueToday._sum.amount || 0,
      revenueMonth: revenueMonth._sum.amount || 0,
      pendingPitches,
      failedTransactions,
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
    return this.prisma.match.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
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

  async updateCommission(rate: number) {
    return this.prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: { commissionRate: rate },
      create: { id: 'singleton', commissionRate: rate, platformFeeRate: 0.05 },
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
}
