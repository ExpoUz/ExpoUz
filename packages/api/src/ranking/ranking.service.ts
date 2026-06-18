import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerLevel } from '@prisma/client';

export interface LevelInfo {
  label: string;
  color: string;
  icon: string;
  minGames: number;
  nextAt: number | null;
}

const LEVELS: Record<string, LevelInfo> = {
  NEW: { label: 'New Player', color: '#9CA3AF', icon: '🌱', minGames: 0, nextAt: 1 },
  ROOKIE: { label: 'Rookie', color: '#10B981', icon: '🎾', minGames: 1, nextAt: 6 },
  REGULAR: { label: 'Regular', color: '#00B0FF', icon: '🔵', minGames: 6, nextAt: 16 },
  EXPERIENCED: { label: 'Experienced', color: '#8B5CF6', icon: '🔥', minGames: 16, nextAt: 31 },
  VETERAN: { label: 'Veteran', color: '#F59E0B', icon: '⭐', minGames: 31, nextAt: 61 },
  ELITE: { label: 'Elite', color: '#FFD700', icon: '👑', minGames: 61, nextAt: null },
};

@Injectable()
export class RankingService {
  constructor(private prisma: PrismaService) {}

  calculateLevel(gamesAttended: number): PlayerLevel {
    if (gamesAttended >= 61) return 'ELITE';
    if (gamesAttended >= 31) return 'VETERAN';
    if (gamesAttended >= 16) return 'EXPERIENCED';
    if (gamesAttended >= 6) return 'REGULAR';
    if (gamesAttended >= 1) return 'ROOKIE';
    return 'NEW';
  }

  getLevelInfo(level: string): LevelInfo {
    return LEVELS[level] ?? LEVELS.NEW;
  }

  /** Bump games-attended for each user and re-derive their level. */
  async incrementGamesAttended(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          gamesAttended: { increment: 1 },
          gamesThisMonth: { increment: 1 },
        },
        select: { id: true, gamesAttended: true, playerLevel: true },
      });
      const newLevel = this.calculateLevel(user.gamesAttended);
      if (newLevel !== user.playerLevel) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { playerLevel: newLevel },
        });
      }
    }
  }

  async getLeaderboard(city?: string, limit = 50) {
    const users = await this.prisma.user.findMany({
      where: { role: 'PLAYER', isBanned: false, ...(city ? { city } : {}) },
      orderBy: [{ gamesAttended: 'desc' }, { eloRating: 'desc' }],
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        gamesAttended: true,
        playerLevel: true,
        eloRating: true,
        city: true,
      },
    });
    return users.map((u, i) => ({ rank: i + 1, ...u, levelInfo: this.getLevelInfo(u.playerLevel) }));
  }

  async getUserRanking(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        gamesAttended: true,
        gamesThisMonth: true,
        playerLevel: true,
        eloRating: true,
        winCount: true,
      },
    });
    if (!user) return null;
    const info = this.getLevelInfo(user.playerLevel);
    const gamesToNext = info.nextAt != null ? Math.max(0, info.nextAt - user.gamesAttended) : 0;
    const progressPct =
      info.nextAt != null
        ? Math.min(
            100,
            ((user.gamesAttended - info.minGames) / (info.nextAt - info.minGames)) * 100,
          )
        : 100;
    return { ...user, levelInfo: info, gamesToNext, progressPct: Math.round(progressPct) };
  }
}
