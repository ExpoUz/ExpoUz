import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

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
    ]);

    return {
      totalUsers,
      activeMatches,
      revenueToday: revenueToday._sum.amount || 0,
      revenueMonth: revenueMonth._sum.amount || 0,
      pendingPitches,
      failedTransactions,
      dailyActiveUsers: activeBookingsToday,
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

  async getMatches(filters: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = filters;
    const where: any = {};
    if (status) where.status = status;

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
}
