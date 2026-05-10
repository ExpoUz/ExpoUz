import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
