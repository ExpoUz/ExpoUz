import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { RankingService } from '../ranking/ranking.service';
import { LevelService } from '../level/level.service';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private ranking: RankingService,
    private level: LevelService,
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        preferredPositions: true,
        _count: {
          select: {
            bookings: true,
            ratingsReceived: true,
          },
        },
      },
    });
    return user;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const updateData: any = { ...dto };
    if (dto.dateOfBirth) {
      updateData.dateOfBirth = new Date(dto.dateOfBirth);
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ avatarUrl: string }> {
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'avatars', public_id: `user_${userId}`, overwrite: true },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      uploadStream.end(file.buffer);
    });

    const avatarUrl = uploadResult.secure_url;
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return { avatarUrl };
  }

  async getMyBookings(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { userId },
        include: {
          match: {
            include: {
              pitch: { select: { name: true, addressLine: true, district: true } },
            },
          },
          transaction: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where: { userId } }),
    ]);

    return { data: bookings, total, page, limit };
  }

  async getMyStats(userId: string) {
    const now = new Date();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last365d = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [total, last7Days, last30Days, lastYear, thumbsUp, thumbsDown, user] =
      await Promise.all([
        this.prisma.booking.count({ where: { userId, status: 'COMPLETED' } }),
        this.prisma.booking.count({
          where: { userId, status: 'COMPLETED', createdAt: { gte: last7d } },
        }),
        this.prisma.booking.count({
          where: { userId, status: 'COMPLETED', createdAt: { gte: last30d } },
        }),
        this.prisma.booking.count({
          where: { userId, status: 'COMPLETED', createdAt: { gte: last365d } },
        }),
        this.prisma.playerRating.count({ where: { ratedId: userId, thumbsUp: true } }),
        this.prisma.playerRating.count({ where: { ratedId: userId, thumbsUp: false } }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { eloRating: true, reliabilityScore: true, skillLevel: true },
        }),
      ]);

    return {
      gamesPlayed: { total, last7Days, last30Days, lastYear },
      ratings: { thumbsUp, thumbsDown, total: thumbsUp + thumbsDown },
      eloRating: user?.eloRating,
      reliabilityScore: user?.reliabilityScore,
      skillLevel: user?.skillLevel,
    };
  }

  async getMyNotifications(userId: string, page = 1) {
    const limit = 20;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return { data: notifications, total, page, limit };
  }

  async markNotificationRead(userId: string, notifId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id: notifId, userId },
    });
    if (!notif) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true },
    });
  }

  async setPreferredPositions(
    userId: string,
    positions: { position: string; isPrimary: boolean }[],
  ) {
    await this.prisma.userPosition.deleteMany({ where: { userId } });

    if (positions.length > 0) {
      await this.prisma.userPosition.createMany({
        data: positions.map((p) => ({
          userId,
          position: p.position as any,
          isPrimary: p.isPrimary,
        })),
      });
    }

    return this.prisma.userPosition.findMany({ where: { userId } });
  }

  async getPublicProfile(targetId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
        eloRating: true,
        reliabilityScore: true,
        skillLevel: true,
        padelLevel: true,
        padelReliability: true,
        padelInitialSet: true,
        padelMatchesPlayed: true,
        padelMatchesWon: true,
        currentStreak: true,
        bestHand: true,
        courtPosition: true,
        city: true,
        district: true,
        gamesAttended: true,
        gamesThisMonth: true,
        playerLevel: true,
        createdAt: true,
        preferredPositions: true,
        _count: {
          select: {
            bookings: true,
            ratingsReceived: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const [thumbsUp, thumbsDown] = await Promise.all([
      this.prisma.playerRating.count({ where: { ratedId: targetId, thumbsUp: true } }),
      this.prisma.playerRating.count({ where: { ratedId: targetId, thumbsUp: false } }),
    ]);

    const recentMatches = await this.prisma.booking.findMany({
      where: { userId: targetId, status: 'COMPLETED' },
      include: {
        match: {
          select: {
            id: true,
            title: true,
            sport: true,
            startTime: true,
            pitch: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      ...user,
      levelInfo: this.ranking.getLevelInfo(user.playerLevel),
      band: this.level.getLevelBand(user.padelLevel),
      ratings: { thumbsUp, thumbsDown },
      recentMatches,
    };
  }

  async searchPlayers(query: string, city?: string) {
    if (!query || query.trim().length < 2) return [];
    return this.prisma.user.findMany({
      where: {
        role: 'PLAYER',
        isBanned: false,
        ...(city ? { city } : {}),
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { telegramUsername: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        gamesAttended: true,
        playerLevel: true,
        eloRating: true,
        city: true,
        district: true,
      },
      orderBy: { gamesAttended: 'desc' },
      take: 30,
    });
  }

  async getMatchPlayers(matchId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { matchId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            gamesAttended: true,
            playerLevel: true,
            eloRating: true,
            padelLevel: true,
          },
        },
        positionTaken: { select: { position: true } },
      },
    });
    return bookings.map((b) => ({
      ...b.user,
      position: b.positionTaken?.position ?? null,
      teamSide: b.teamSide,
      checkedIn: b.checkedIn,
    }));
  }

  // ─── PLAYER STATISTICS (skill rating profile) ─────────────────────────────
  async getStatistics(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        padelLevel: true,
        padelReliability: true,
        padelMatchesPlayed: true,
        padelMatchesWon: true,
        padelMatchesLost: true,
        currentStreak: true,
        longestWinStreak: true,
        bestHand: true,
        courtPosition: true,
        preferredMatchType: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const effectiveness =
      user.padelMatchesPlayed > 0
        ? Math.round((user.padelMatchesWon / user.padelMatchesPlayed) * 100)
        : 0;

    const [{ partners, opponents, clubs }, levelHistory] = await Promise.all([
      this.getPlayHistory(userId),
      this.level.getLevelHistory(userId),
    ]);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      level: user.padelLevel,
      reliability: user.padelReliability,
      band: this.level.getLevelBand(user.padelLevel),
      matchesPlayed: user.padelMatchesPlayed,
      matchesWon: user.padelMatchesWon,
      matchesLost: user.padelMatchesLost,
      effectiveness,
      currentStreak: user.currentStreak,
      longestWinStreak: user.longestWinStreak,
      preferences: {
        bestHand: user.bestHand,
        courtPosition: user.courtPosition,
        preferredMatchType: user.preferredMatchType,
      },
      recentPartners: partners,
      recentOpponents: opponents,
      recentClubs: clubs,
      levelHistory,
    };
  }

  // Single pass over the user's recent completed matches to derive the social
  // history shown on the profile: partners (same team), opponents (other team),
  // and clubs played at (with visit counts).
  private async getPlayHistory(userId: string) {
    const myBookings = await this.prisma.booking.findMany({
      where: { userId, status: { in: ['COMPLETED', 'CONFIRMED'] } },
      select: {
        teamSide: true,
        match: {
          select: {
            id: true,
            startTime: true,
            pitch: { select: { id: true, name: true, district: true } },
            bookings: {
              where: { status: { in: ['COMPLETED', 'CONFIRMED'] } },
              select: {
                teamSide: true,
                user: {
                  select: { id: true, firstName: true, lastName: true, avatarUrl: true, padelLevel: true },
                },
              },
            },
          },
        },
      },
      orderBy: { match: { startTime: 'desc' } },
      take: 40,
    });

    type PlayerLite = { id: string; firstName: string; lastName: string; avatarUrl: string | null; padelLevel: number };
    const partnerMap = new Map<string, PlayerLite & { count: number }>();
    const opponentMap = new Map<string, PlayerLite & { count: number }>();
    const clubMap = new Map<string, { id: string; name: string; district: string | null; visits: number }>();

    for (const b of myBookings) {
      const pitch = b.match.pitch;
      if (pitch) {
        const c = clubMap.get(pitch.id);
        if (c) c.visits++;
        else clubMap.set(pitch.id, { id: pitch.id, name: pitch.name, district: pitch.district, visits: 1 });
      }
      for (const co of b.match.bookings) {
        if (co.user.id === userId) continue;
        const sameTeam = b.teamSide != null && co.teamSide != null && b.teamSide === co.teamSide;
        const map = sameTeam ? partnerMap : opponentMap;
        const existing = map.get(co.user.id);
        if (existing) existing.count++;
        else map.set(co.user.id, { ...co.user, count: 1 });
      }
    }

    const sortByCount = <T extends { count: number }>(arr: T[]) =>
      arr.sort((a, b) => b.count - a.count).slice(0, 10);

    return {
      partners: sortByCount([...partnerMap.values()]),
      opponents: sortByCount([...opponentMap.values()]),
      clubs: [...clubMap.values()].sort((a, b) => b.visits - a.visits).slice(0, 10),
    };
  }

  async applyReferral(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.referredBy) {
      throw new BadRequestException('Referral already applied');
    }

    const referrer = await this.prisma.user.findFirst({
      where: { referralCode: code },
    });

    if (!referrer) throw new NotFoundException('Referral code not found');
    if (referrer.id === userId) throw new BadRequestException('Cannot refer yourself');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          referredBy: referrer.id,
          credit: { increment: 50000 },
        },
      }),
      this.prisma.user.update({
        where: { id: referrer.id },
        data: { credit: { increment: 50000 } },
      }),
    ]);

    return { message: 'Referral applied. 50,000 UZS credit added to both accounts.' };
  }
}
