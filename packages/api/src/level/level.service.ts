import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LevelBand {
  label: string;
  color: string;
  range: string;
}

export interface OnboardingAnswers {
  experience: 'never' | 'few_times' | 'months' | 'years';
  otherRacketSports: boolean;
  selfAssessment: number; // 1-5
  competitivePlay: boolean;
}

@Injectable()
export class LevelService {
  constructor(private prisma: PrismaService) {}

  // Level bands for display (0.0 - 7.0 scale)
  getLevelBand(level: number): LevelBand {
    if (level < 1.0) return { label: 'Initiation', color: '#9CA3AF', range: '0.0–1.0' };
    if (level < 1.5) return { label: 'Beginner', color: '#34D399', range: '1.0–1.5' };
    if (level < 2.5) return { label: 'Improver', color: '#10B981', range: '1.5–2.5' };
    if (level < 3.5) return { label: 'Intermediate', color: '#00B0FF', range: '2.5–3.5' };
    if (level < 4.5)
      return { label: 'Advanced Intermediate', color: '#8B5CF6', range: '3.5–4.5' };
    if (level < 5.5) return { label: 'Advanced', color: '#F59E0B', range: '4.5–5.5' };
    if (level < 6.0) return { label: 'Competitive', color: '#EF4444', range: '5.5–6.0' };
    return { label: 'Pro', color: '#FFD700', range: '6.0–7.0' };
  }

  // Initial level from the onboarding questionnaire
  calculateInitialLevel(answers: OnboardingAnswers): { level: number; reliability: number } {
    let level = 0.5;
    if (answers.experience === 'few_times') level = 1.0;
    if (answers.experience === 'months') level = 2.0;
    if (answers.experience === 'years') level = 3.0;
    if (answers.otherRacketSports) level += 0.5;
    level += (answers.selfAssessment - 3) * 0.3;
    if (answers.competitivePlay) level += 0.5;
    level = Math.max(0.0, Math.min(7.0, Math.round(level * 4) / 4)); // round to 0.25
    return { level, reliability: 20 }; // low reliability until matches played
  }

  // ─── THE CORE ELO ALGORITHM ──────────────────────────────────────────────
  // Called after a COMPETITIVE match result is confirmed. Considers level +
  // reliability of all players, expected vs actual outcome, and score margin.
  async processMatchResult(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        result: true,
        bookings: {
          where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
          include: { user: true },
        },
      },
    });

    if (!match?.result?.isConfirmed) return;
    if (match.matchType !== 'COMPETITIVE') return; // casual doesn't affect level
    // This ELO ladder is the padel level track. Football has no set-based
    // result flow (it ranks via games attended / thumbs), so it never reaches
    // here — but guard explicitly so the two tracks can never cross-contaminate.
    if (match.sport !== 'PADEL') return;

    // Split players into teams by their booking's team side
    const team1 = match.bookings.filter((b) => b.teamSide === 'HOME').map((b) => b.user);
    const team2 = match.bookings.filter((b) => b.teamSide === 'AWAY').map((b) => b.user);
    if (team1.length === 0 || team2.length === 0) return;

    // Average level per team (padel level)
    const team1Avg = team1.reduce((s, p) => s + p.padelLevel, 0) / team1.length;
    const team2Avg = team2.reduce((s, p) => s + p.padelLevel, 0) / team2.length;

    // Expected outcome (ELO formula, scaled for the 0-7 range).
    // Divide by 1.5 to spread sensitivity across the padel scale.
    const expected1 = 1 / (1 + Math.pow(10, (team2Avg - team1Avg) / 1.5));
    const expected2 = 1 - expected1;

    // Actual outcome
    const team1Won = match.result.winningTeam === 1;
    const actual1 = team1Won ? 1 : 0;
    const actual2 = team1Won ? 0 : 1;

    // Score margin multiplier (winning 6-0,6-0 moves more than 7-6,7-6)
    const margin = this.calculateMargin(match.result);

    for (const player of team1) {
      await this.adjustPlayerLevel(player, expected1, actual1, margin, matchId, team1Won);
    }
    for (const player of team2) {
      await this.adjustPlayerLevel(player, expected2, actual2, margin, matchId, !team1Won);
    }
  }

  private async adjustPlayerLevel(
    player: { id: string; padelLevel: number; padelReliability: number; currentStreak: number; longestWinStreak: number },
    expected: number,
    actual: number,
    margin: number,
    matchId: string,
    won: boolean,
  ) {
    // K-factor scales with reliability: new players (low reliability) move fast,
    // established players move slowly. 1.0 down to 0.3.
    const kBase = 0.4;
    const reliabilityFactor = 1 - (player.padelReliability / 100) * 0.7;
    const k = kBase * reliabilityFactor;

    const change = k * (actual - expected) * margin;
    const newLevel = Math.max(0.0, Math.min(7.0, player.padelLevel + change));

    // Reliability increases with each match (caps at 100)
    const newReliability = Math.min(
      100,
      player.padelReliability + (player.padelReliability < 50 ? 8 : 3),
    );

    const newStreak = won
      ? player.currentStreak >= 0
        ? player.currentStreak + 1
        : 1
      : player.currentStreak <= 0
        ? player.currentStreak - 1
        : -1;

    await this.prisma.user.update({
      where: { id: player.id },
      data: {
        padelLevel: Math.round(newLevel * 100) / 100,
        padelReliability: newReliability,
        padelMatchesPlayed: { increment: 1 },
        padelMatchesWon: won ? { increment: 1 } : undefined,
        padelMatchesLost: won ? undefined : { increment: 1 },
        currentStreak: newStreak,
        longestWinStreak:
          won && newStreak > player.longestWinStreak ? newStreak : undefined,
      },
    });

    await this.prisma.levelHistory.create({
      data: {
        userId: player.id,
        level: Math.round(newLevel * 100) / 100,
        reliability: newReliability,
        change: Math.round(change * 100) / 100,
        matchId,
        reason: won
          ? expected < 0.5
            ? 'Won vs higher-level opponents'
            : 'Won competitive match'
          : expected > 0.5
            ? 'Lost to lower-level opponents'
            : 'Lost competitive match',
      },
    });
  }

  private calculateMargin(result: {
    team1Set1: number | null; team2Set1: number | null;
    team1Set2: number | null; team2Set2: number | null;
    team1Set3: number | null; team2Set3: number | null;
  }): number {
    // More decisive wins = bigger level change. Range ~0.7 to 1.3
    let totalGamesDiff = 0;
    let sets = 0;
    if (result.team1Set1 != null && result.team2Set1 != null) {
      totalGamesDiff += Math.abs(result.team1Set1 - result.team2Set1);
      sets++;
    }
    if (result.team1Set2 != null && result.team2Set2 != null) {
      totalGamesDiff += Math.abs(result.team1Set2 - result.team2Set2);
      sets++;
    }
    if (result.team1Set3 != null && result.team2Set3 != null) {
      totalGamesDiff += Math.abs(result.team1Set3 - result.team2Set3);
      sets++;
    }
    const avgDiff = sets > 0 ? totalGamesDiff / sets : 3;
    return 0.7 + Math.min(0.6, avgDiff / 10);
  }

  // Apply the onboarding result to a user and seed their level history.
  async applyOnboarding(userId: string, answers: OnboardingAnswers) {
    const { level, reliability } = this.calculateInitialLevel(answers);
    await this.prisma.user.update({
      where: { id: userId },
      data: { padelLevel: level, padelReliability: reliability, padelInitialSet: true },
    });
    await this.prisma.levelHistory.create({
      data: { userId, level, reliability, change: level, reason: 'Initial assessment' },
    });
    return { level, reliability, band: this.getLevelBand(level) };
  }

  async getLevelHistory(userId: string) {
    return this.prisma.levelHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
