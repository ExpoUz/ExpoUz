import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private sessions = new Map<string, ChatSession>();

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY not set -- AI features disabled');
    }
  }

  private isEnabled(): boolean {
    return this.genAI !== null;
  }

  async getSystemSnapshot() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      totalPitches,
      activePitches,
      pendingVerification,
      totalMatches,
      activeMatches,
      totalPitchBookings,
      revenueMonth,
      revenueToday,
      onlineSessions,
      recentActivity,
      topPitches,
      usersByRole,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.pitch.count(),
      this.prisma.pitch.count({ where: { isActive: true } }),
      this.prisma.pitch.count({ where: { isVerified: false, rejectionReason: null } }),
      this.prisma.match.count(),
      this.prisma.match.count({ where: { status: { in: ['OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS'] } } }),
      this.prisma.pitchBooking.count(),
      this.prisma.transaction.aggregate({
        where: { status: { in: ['HELD', 'RELEASED'] }, createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { status: { in: ['HELD', 'RELEASED'] }, createdAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      this.prisma.userSession.count({
        where: { lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
      }),
      this.prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true, role: true } } },
      }),
      this.prisma.pitch.findMany({
        take: 5,
        orderBy: { matches: { _count: 'desc' } },
        select: {
          name: true,
          city: true,
          isActive: true,
          isVerified: true,
          _count: { select: { matches: true, pitchBookings: true } },
        },
      }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
    ]);

    return {
      timestamp: now.toISOString(),
      users: {
        total: totalUsers,
        byRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count.id])),
        onlineNow: onlineSessions,
      },
      pitches: {
        total: totalPitches,
        active: activePitches,
        pendingVerification,
        topByMatches: topPitches,
      },
      matches: {
        total: totalMatches,
        active: activeMatches,
      },
      pitchBookings: {
        total: totalPitchBookings,
      },
      revenue: {
        today: Number(revenueToday._sum.amount ?? 0),
        thisMonth: Number(revenueMonth._sum.amount ?? 0),
        currency: 'UZS',
      },
      recentActivity: recentActivity.map((a) => ({
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        by: a.user ? `${a.user.firstName} ${a.user.lastName} (${a.user.role})` : 'System',
        at: a.createdAt.toISOString(),
      })),
    };
  }

  private buildSystemPrompt(snapshot: any): string {
    return `You are an AI assistant for ScoreWithUs -- a sports venue booking and matchmaking platform in Uzbekistan.
You have access to live system data and help administrators analyze trends, understand platform health, and make decisions.

CURRENT SYSTEM DATA (as of ${new Date(snapshot.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Tashkent' })} Tashkent time):

USERS:
- Total registered: ${snapshot.users.total}
- By role: ${JSON.stringify(snapshot.users.byRole)}
- Currently online: ${snapshot.users.onlineNow}

PITCHES (Venues):
- Total: ${snapshot.pitches.total} (${snapshot.pitches.active} active)
- Awaiting verification: ${snapshot.pitches.pendingVerification}
- Top venues by match count:
${snapshot.pitches.topByMatches.map((p: any) => `  - ${p.name} (${p.city}) -- ${p._count.matches} matches, ${p._count.pitchBookings} bookings`).join('\n')}

MATCHES:
- Total ever: ${snapshot.matches.total}
- Currently active: ${snapshot.matches.active}

PITCH BOOKINGS (venue hire):
- Total bookings: ${snapshot.pitchBookings.total}

REVENUE:
- Today: ${snapshot.revenue.today.toLocaleString()} UZS
- This month: ${snapshot.revenue.thisMonth.toLocaleString()} UZS

RECENT ADMIN ACTIVITY (last 10 actions):
${snapshot.recentActivity.map((a: any) => `  - [${new Date(a.at).toLocaleTimeString()}] ${a.action} on ${a.entityType} by ${a.by}`).join('\n')}

INSTRUCTIONS:
- Respond concisely and analytically. Use data to support insights.
- If asked about trends, compare ratios (e.g., active vs total pitches).
- Flag anomalies (e.g., high pending verifications, low revenue).
- You can discuss user behavior, pitch performance, revenue, and platform health.
- Currency is UZS (Uzbekistani Sum). 1 USD approx 12,700 UZS.
- Be helpful, direct, and professional. Use brief bullet points when listing multiple items.`;
  }

  async analyze(prompt?: string): Promise<{ text: string; snapshot: any }> {
    const snapshot = await this.getSystemSnapshot();

    if (!this.isEnabled()) {
      return { text: this.generateFallbackAnalysis(snapshot), snapshot };
    }

    try {
      const model = this.genAI!.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const systemPrompt = this.buildSystemPrompt(snapshot);
      const userPrompt = prompt ?? 'Give me a comprehensive overview of the platform health and any issues that need attention.';
      const result = await model.generateContent(`${systemPrompt}\n\nUSER REQUEST: ${userPrompt}`);
      return { text: result.response.text(), snapshot };
    } catch (err: any) {
      this.logger.error(`Gemini analyze failed: ${err?.message}`);
      return { text: this.generateFallbackAnalysis(snapshot, err?.message), snapshot };
    }
  }

  async chat(sessionId: string, userMessage: string): Promise<{ text: string }> {
    const snapshot = await this.getSystemSnapshot();

    if (!this.isEnabled()) {
      return { text: this.generateFallbackAnalysis(snapshot) };
    }

    try {
      const model = this.genAI!.getGenerativeModel({ model: 'gemini-2.0-flash' });

      if (!this.sessions.has(sessionId)) {
        const chat = model.startChat({
          history: [
            {
              role: 'user',
              parts: [{ text: this.buildSystemPrompt(snapshot) }],
            },
            {
              role: 'model',
              parts: [{ text: 'Understood. I have the current system data loaded and am ready to help you analyze the ScoreWithUs platform. What would you like to know?' }],
            },
          ],
        });
        this.sessions.set(sessionId, chat);
      }

      const chat = this.sessions.get(sessionId)!;
      const result = await chat.sendMessage(userMessage);
      return { text: result.response.text() };
    } catch (err: any) {
      this.logger.error(`Gemini chat failed: ${err?.message}`);
      this.sessions.delete(sessionId);
      return { text: this.generateFallbackAnalysis(snapshot, err?.message) };
    }
  }

  clearSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  private generateFallbackAnalysis(snapshot: any, errorMsg?: string): string {
    const issues: string[] = [];
    const highlights: string[] = [];

    if (snapshot.pitches.pendingVerification > 0) {
      issues.push(`${snapshot.pitches.pendingVerification} pitch(es) awaiting verification`);
    }
    if (snapshot.pitches.active < snapshot.pitches.total * 0.7) {
      issues.push(`Only ${snapshot.pitches.active}/${snapshot.pitches.total} pitches active`);
    }
    if (snapshot.revenue.today === 0) {
      issues.push('No revenue recorded today');
    }
    if (snapshot.users.onlineNow > 5) {
      highlights.push(`${snapshot.users.onlineNow} users currently online`);
    }
    if (snapshot.matches.active > 3) {
      highlights.push(`${snapshot.matches.active} active matches running`);
    }

    const revenueRatio = snapshot.revenue.thisMonth > 0
      ? ((snapshot.revenue.today / snapshot.revenue.thisMonth) * 100).toFixed(1)
      : '0';

    const isQuotaError = errorMsg && (errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota'));
    const hint = isQuotaError
      ? 'Gemini API quota exceeded. Enable billing at console.cloud.google.com or wait for quota reset.'
      : this.isEnabled()
        ? 'Gemini AI temporarily unavailable. Showing live data summary.'
        : 'Set GEMINI_API_KEY in .env to enable AI-powered analysis and chat.';

    return [
      `Platform Snapshot (${new Date(snapshot.timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Tashkent' })})`,
      '',
      `Users: ${snapshot.users.total} total, ${snapshot.users.onlineNow} online`,
      `Pitches: ${snapshot.pitches.active}/${snapshot.pitches.total} active`,
      `Matches: ${snapshot.matches.active} active / ${snapshot.matches.total} total`,
      `Revenue: ${snapshot.revenue.today.toLocaleString()} UZS today (${revenueRatio}% of monthly ${snapshot.revenue.thisMonth.toLocaleString()} UZS)`,
      '',
      highlights.length ? `Highlights:\n${highlights.map((h) => `  - ${h}`).join('\n')}` : '',
      issues.length ? `Needs attention:\n${issues.map((i) => `  - ${i}`).join('\n')}` : 'No issues detected',
      '',
      hint,
    ].filter(Boolean).join('\n');
  }
}
