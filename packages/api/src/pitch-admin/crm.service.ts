import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';

/**
 * Venue Owner CRM — a club owner's private, customer-relationship view of the
 * players who book at THEIR venues.
 *
 * PRIVACY IS THE POINT. Every method derives the owner's accessible player set
 * from bookings at venues they own — never from a client-supplied venue/player
 * id. An owner is not an admin: no wallet balances, no cross-venue data, no
 * players who never booked here. Phone numbers are gated + audited.
 */

export type Segment =
  | 'NEW'
  | 'REGULAR'
  | 'LOYAL'
  | 'AT_RISK'
  | 'LAPSED'
  | 'RISKY';

// Centralized, easily-tuned segment thresholds (days / game counts).
const SEG = {
  newFirstVisitDays: 30,
  regularGames: 3,
  regularWindowDays: 60,
  loyalGames: 10,
  loyalActiveDays: 30,
  atRiskMinGames: 3,
  atRiskFromDays: 30,
  atRiskToDays: 60,
  lapsedDays: 60,
  riskyNoShows: 2,
};

const DAY = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] as const;
const PAID_TX = ['HELD', 'RELEASED', 'PARTIALLY_REFUNDED'];

interface PlayerAgg {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  padelLevel: number;
  padelInitialSet: boolean;
  eloRating: number;
  skillLevel: string;
  gamesHere: number; // COMPLETED bookings
  gamesLast60: number;
  firstVisit: Date | null;
  lastVisit: Date | null;
  noShowsHere: number;
  spentHere: number;
  slotCounts: Map<string, number>; // "Tue 19" -> n
}

@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private messages: MessagesService,
  ) {}

  // ─── Ownership scoping (server-side, non-negotiable) ───────────────────────

  private async ownedPitchIds(ownerId: string): Promise<string[]> {
    const pitches = await this.prisma.pitch.findMany({
      where: { ownerId },
      select: { id: true },
    });
    return pitches.map((p) => p.id);
  }

  /** Throws unless `playerId` has a real booking at one of the owner's venues. */
  private async assertOwnsPlayerRelationship(ownerId: string, playerId: string) {
    const link = await this.prisma.booking.findFirst({
      where: {
        userId: playerId,
        isGuestSlot: false,
        match: { pitch: { ownerId } },
        status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
      },
      select: { id: true },
    });
    if (!link) throw new ForbiddenException({ code: 'NO_PLAYER_RELATIONSHIP' });
  }

  private async assertCrmEnabled(ownerId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { crmDisabled: true },
    });
    if (owner?.crmDisabled) throw new ForbiddenException({ code: 'CRM_DISABLED' });
  }

  // ─── Core aggregation (one pass over this owner's bookings) ─────────────────

  private async computeAggregates(ownerId: string): Promise<Map<string, PlayerAgg>> {
    const pitchIds = await this.ownedPitchIds(ownerId);
    const byPlayer = new Map<string, PlayerAgg>();
    if (pitchIds.length === 0) return byPlayer;

    const bookings = await this.prisma.booking.findMany({
      where: {
        isGuestSlot: false,
        match: { pitchId: { in: pitchIds } },
        status: { in: ACTIVE_STATUSES as any },
      },
      select: {
        userId: true,
        status: true,
        match: { select: { startTime: true } },
        transaction: { select: { amount: true, status: true } },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            padelLevel: true,
            padelInitialSet: true,
            eloRating: true,
            skillLevel: true,
          },
        },
      },
    });

    const now = Date.now();
    for (const b of bookings) {
      const u = b.user;
      let agg = byPlayer.get(u.id);
      if (!agg) {
        agg = {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          avatarUrl: u.avatarUrl,
          padelLevel: Number(u.padelLevel ?? 0),
          padelInitialSet: u.padelInitialSet,
          eloRating: u.eloRating ?? 0,
          skillLevel: u.skillLevel,
          gamesHere: 0,
          gamesLast60: 0,
          firstVisit: null,
          lastVisit: null,
          noShowsHere: 0,
          spentHere: 0,
          slotCounts: new Map(),
        };
        byPlayer.set(u.id, agg);
      }

      const start = b.match?.startTime ? new Date(b.match.startTime) : null;
      if (b.status === 'NO_SHOW') {
        agg.noShowsHere++;
      }
      if (b.status === 'COMPLETED') {
        agg.gamesHere++;
        if (start && now - start.getTime() <= SEG.regularWindowDays * DAY) {
          agg.gamesLast60++;
        }
      }
      // First/last visit + favourite slot use real attended/booked sessions.
      if (start && b.status !== 'NO_SHOW') {
        if (!agg.firstVisit || start < agg.firstVisit) agg.firstVisit = start;
        if (!agg.lastVisit || start > agg.lastVisit) agg.lastVisit = start;
        const key = `${start.toLocaleDateString('en-US', { weekday: 'short' })} ${start.getHours()}`;
        agg.slotCounts.set(key, (agg.slotCounts.get(key) ?? 0) + 1);
      }
      if (b.transaction && PAID_TX.includes(b.transaction.status)) {
        agg.spentHere += Number(b.transaction.amount);
      }
    }

    return byPlayer;
  }

  private computeSegment(agg: PlayerAgg, now = Date.now()): Segment {
    const daysSinceLast = agg.lastVisit ? (now - agg.lastVisit.getTime()) / DAY : Infinity;
    const daysSinceFirst = agg.firstVisit ? (now - agg.firstVisit.getTime()) / DAY : Infinity;

    if (agg.noShowsHere >= SEG.riskyNoShows) return 'RISKY';
    if (daysSinceLast >= SEG.lapsedDays) return 'LAPSED';
    if (
      agg.gamesHere >= SEG.atRiskMinGames &&
      daysSinceLast >= SEG.atRiskFromDays &&
      daysSinceLast < SEG.atRiskToDays
    ) {
      return 'AT_RISK';
    }
    if (agg.gamesHere >= SEG.loyalGames && daysSinceLast <= SEG.loyalActiveDays) return 'LOYAL';
    if (agg.gamesLast60 >= SEG.regularGames) return 'REGULAR';
    if (agg.gamesHere <= 1 && daysSinceFirst <= SEG.newFirstVisitDays) return 'NEW';
    return agg.gamesHere >= SEG.regularGames ? 'REGULAR' : 'NEW';
  }

  private favouriteSlot(agg: PlayerAgg): string | null {
    let best: string | null = null;
    let bestN = 0;
    for (const [k, n] of agg.slotCounts) {
      if (n > bestN) {
        best = k;
        bestN = n;
      }
    }
    return best; // e.g. "Tue 19"
  }

  private toCard(agg: PlayerAgg) {
    return {
      id: agg.id,
      firstName: agg.firstName,
      lastName: agg.lastName,
      avatarUrl: agg.avatarUrl,
      padelLevel: agg.padelInitialSet ? agg.padelLevel : null,
      eloRating: agg.eloRating,
      skillLevel: agg.skillLevel,
      gamesHere: agg.gamesHere,
      firstVisit: agg.firstVisit,
      lastVisit: agg.lastVisit,
      noShowsHere: agg.noShowsHere,
      spentHere: agg.spentHere,
      favouriteSlot: this.favouriteSlot(agg),
      segment: this.computeSegment(agg),
    };
  }

  // ─── Endpoints ─────────────────────────────────────────────────────────────

  async listPlayers(
    ownerId: string,
    opts: { search?: string; segment?: string; sort?: string; page?: number; limit?: number },
  ) {
    await this.assertCrmEnabled(ownerId);
    const { search, segment, sort = 'recent', page = 1, limit = 50 } = opts;

    const aggregates = await this.computeAggregates(ownerId);
    let cards = [...aggregates.values()].map((a) => this.toCard(a));

    if (search) {
      const q = search.toLowerCase();
      cards = cards.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q));
    }
    if (segment && segment !== 'ALL') {
      cards = cards.filter((c) => c.segment === segment);
    }

    cards.sort((a, b) => {
      if (sort === 'games') return b.gamesHere - a.gamesHere;
      if (sort === 'spent') return b.spentHere - a.spentHere;
      // recent visit (default)
      return (b.lastVisit?.getTime() ?? 0) - (a.lastVisit?.getTime() ?? 0);
    });

    const total = cards.length;
    const start = (page - 1) * limit;
    return { data: cards.slice(start, start + limit), total, page, limit };
  }

  async getSegments(ownerId: string) {
    await this.assertCrmEnabled(ownerId);
    const aggregates = await this.computeAggregates(ownerId);
    const counts: Record<string, number> = {
      ALL: 0,
      NEW: 0,
      REGULAR: 0,
      LOYAL: 0,
      AT_RISK: 0,
      LAPSED: 0,
      RISKY: 0,
    };
    for (const agg of aggregates.values()) {
      counts.ALL++;
      counts[this.computeSegment(agg)]++;
    }
    return counts;
  }

  async getPlayerDetail(ownerId: string, playerId: string) {
    await this.assertCrmEnabled(ownerId);
    await this.assertOwnsPlayerRelationship(ownerId, playerId);

    const aggregates = await this.computeAggregates(ownerId);
    const agg = aggregates.get(playerId);
    if (!agg) throw new NotFoundException({ code: 'NO_PLAYER_RELATIONSHIP' });

    const notes = await this.listNotes(ownerId, playerId);
    return {
      ...this.toCard(agg),
      contactAvailable: await this.isContactWindowOpen(ownerId, playerId),
      notes,
    };
  }

  async getPlayerHistory(ownerId: string, playerId: string) {
    await this.assertOwnsPlayerRelationship(ownerId, playerId);
    const pitchIds = await this.ownedPitchIds(ownerId);
    const bookings = await this.prisma.booking.findMany({
      where: {
        userId: playerId,
        isGuestSlot: false,
        match: { pitchId: { in: pitchIds } },
        status: { in: ACTIVE_STATUSES as any },
      },
      select: {
        id: true,
        status: true,
        match: {
          select: {
            id: true,
            title: true,
            format: true,
            sport: true,
            startTime: true,
            pitch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { match: { startTime: 'desc' } },
      take: 50,
    });
    // Only this owner's venues; no cross-venue data.
    return bookings.map((b) => ({
      id: b.id,
      status: b.status,
      matchId: b.match?.id,
      title: b.match?.title,
      format: b.match?.format,
      sport: b.match?.sport,
      startTime: b.match?.startTime,
      pitchName: b.match?.pitch?.name,
    }));
  }

  // ─── Notes (private to the owner who wrote them) ───────────────────────────

  async addNote(ownerId: string, playerId: string, note: string, pitchId?: string) {
    await this.assertOwnsPlayerRelationship(ownerId, playerId);
    const trimmed = (note ?? '').trim();
    if (!trimmed) throw new NotFoundException({ code: 'EMPTY_NOTE' });
    return this.prisma.venuePlayerNote.create({
      data: { ownerId, playerId, note: trimmed.slice(0, 2000), pitchId: pitchId ?? null },
    });
  }

  async listNotes(ownerId: string, playerId: string) {
    // Scoped to this owner — an owner never sees another owner's notes.
    return this.prisma.venuePlayerNote.findMany({
      where: { ownerId, playerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Phone reveal (window-gated + audit-logged) ────────────────────────────

  private async isContactWindowOpen(ownerId: string, playerId: string): Promise<boolean> {
    const pitchIds = await this.ownedPitchIds(ownerId);
    const from = new Date(Date.now() - 7 * DAY);
    const to = new Date(Date.now() + 7 * DAY);
    const inWindow = await this.prisma.booking.findFirst({
      where: {
        userId: playerId,
        isGuestSlot: false,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        match: { pitchId: { in: pitchIds }, startTime: { gte: from, lte: to } },
      },
      select: { id: true },
    });
    return !!inWindow;
  }

  async revealContact(ownerId: string, playerId: string, reason: string) {
    await this.assertCrmEnabled(ownerId);
    await this.assertOwnsPlayerRelationship(ownerId, playerId);

    if (!(await this.isContactWindowOpen(ownerId, playerId))) {
      // Outside ±7 days of a booking the owner can only reach the player in-app.
      throw new ForbiddenException({ code: 'CONTACT_WINDOW_CLOSED' });
    }

    // Audit EVERY reveal before returning the number.
    await this.prisma.contactReveal.create({
      data: { ownerId, playerId, reason: (reason ?? 'contact player').slice(0, 300) },
    });

    const player = await this.prisma.user.findUnique({
      where: { id: playerId },
      select: { phone: true, firstName: true },
    });
    return { phone: player?.phone ?? null, firstName: player?.firstName };
  }

  // ─── In-app message ────────────────────────────────────────────────────────

  async messagePlayer(ownerId: string, playerId: string, content: string) {
    await this.assertOwnsPlayerRelationship(ownerId, playerId);
    const text = (content ?? '').trim();
    if (!text) throw new NotFoundException({ code: 'EMPTY_MESSAGE' });
    const conversation = await this.messages.createOrGetDirect(ownerId, playerId);
    await this.messages.sendMessage(conversation.id, ownerId, text.slice(0, 2000));
    return { conversationId: conversation.id };
  }

  // ─── Insights ──────────────────────────────────────────────────────────────

  async getInsights(ownerId: string) {
    await this.assertCrmEnabled(ownerId);
    const aggregates = await this.computeAggregates(ownerId);
    const players = [...aggregates.values()];
    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const totalPlayers = players.length;
    const returning = players.filter((p) => p.gamesHere > 1).length;
    const repeatRate = totalPlayers ? Math.round((returning / totalPlayers) * 100) : 0;

    const segmentsOf = players.map((p) => this.computeSegment(p));
    const regulars = segmentsOf.filter((s) => s === 'REGULAR' || s === 'LOYAL').length;
    const atRiskPlayers = players
      .filter((p) => this.computeSegment(p) === 'AT_RISK')
      .map((p) => this.toCard(p))
      .sort((a, b) => (a.lastVisit?.getTime() ?? 0) - (b.lastVisit?.getTime() ?? 0));

    const newThisMonth = players.filter(
      (p) => p.firstVisit && p.firstVisit >= monthStart,
    ).length;
    const regularsGainedThisMonth = players.filter(
      (p) =>
        (this.computeSegment(p) === 'REGULAR' || this.computeSegment(p) === 'LOYAL') &&
        p.firstVisit &&
        p.firstVisit >= monthStart,
    ).length;

    // Busiest / quietest slots across all players' attended sessions.
    const slotTotals = new Map<string, number>();
    for (const p of players) {
      for (const [k, n] of p.slotCounts) slotTotals.set(k, (slotTotals.get(k) ?? 0) + n);
    }
    const slots = [...slotTotals.entries()].sort((a, b) => b[1] - a[1]);
    const busiest = slots.slice(0, 3).map(([slot, count]) => ({ slot, count }));
    const quietest = slots.slice(-3).reverse().map(([slot, count]) => ({ slot, count }));

    return {
      repeatRate,
      returning,
      totalPlayers,
      regulars,
      regularsGainedThisMonth,
      newThisMonth,
      atRisk: atRiskPlayers,
      busiest,
      quietest,
    };
  }

  // ─── Broadcast (rate-limited, mute-aware, admin-logged) ────────────────────

  /** Per-segment recipient counts EXCLUDING muted players (what the owner sees). */
  async getBroadcastCounts(ownerId: string) {
    await this.assertCrmEnabled(ownerId);
    const aggregates = await this.computeAggregates(ownerId);
    const muted = await this.mutedPlayerIds(ownerId);

    const counts: Record<string, number> = {
      ALL: 0,
      REGULAR: 0,
      LOYAL: 0,
      AT_RISK: 0,
      LAPSED: 0,
      NEW: 0,
    };
    for (const agg of aggregates.values()) {
      if (muted.has(agg.id)) continue;
      counts.ALL++;
      const seg = this.computeSegment(agg);
      if (seg in counts) counts[seg]++;
    }
    const weekAgo = new Date(Date.now() - 7 * DAY);
    const sentThisWeek = await this.prisma.venueBroadcast.count({
      where: { ownerId, createdAt: { gte: weekAgo } },
    });
    return { counts, sentThisWeek, weeklyLimit: 2 };
  }

  private async mutedPlayerIds(ownerId: string): Promise<Set<string>> {
    const mutes = await this.prisma.venueBroadcastMute.findMany({
      where: { ownerId },
      select: { playerId: true },
    });
    return new Set(mutes.map((m) => m.playerId));
  }

  async broadcast(ownerId: string, segment: string, message: string) {
    await this.assertCrmEnabled(ownerId);
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { broadcastDisabled: true, firstName: true },
    });
    if (owner?.broadcastDisabled) throw new ForbiddenException({ code: 'BROADCAST_DISABLED' });

    const text = (message ?? '').trim();
    if (!text) throw new NotFoundException({ code: 'EMPTY_MESSAGE' });

    // Weekly rate limit: max 2 broadcasts per owner per rolling 7 days.
    const weekAgo = new Date(Date.now() - 7 * DAY);
    const sentThisWeek = await this.prisma.venueBroadcast.count({
      where: { ownerId, createdAt: { gte: weekAgo } },
    });
    if (sentThisWeek >= 2) throw new ForbiddenException({ code: 'BROADCAST_LIMIT' });

    // Resolve recipients from the segment, excluding muted players.
    const aggregates = await this.computeAggregates(ownerId);
    const muted = await this.mutedPlayerIds(ownerId);
    const recipients = [...aggregates.values()].filter((agg) => {
      if (muted.has(agg.id)) return false;
      return segment === 'ALL' || this.computeSegment(agg) === segment;
    });

    // Log first (admin oversight + rate limit basis).
    await this.prisma.venueBroadcast.create({
      data: { ownerId, segment, message: text.slice(0, 1000), recipientCount: recipients.length },
    });

    // Deliver as a real in-app direct message from the owner to each recipient.
    const body = `📣 ${owner?.firstName ?? 'Your venue'}: ${text.slice(0, 1000)}`;
    for (const r of recipients) {
      try {
        const conv = await this.messages.createOrGetDirect(ownerId, r.id);
        await this.messages.sendMessage(conv.id, ownerId, body);
      } catch {
        // best-effort per recipient; one failure never aborts the batch
      }
    }

    return { sent: recipients.length, segment };
  }

  // ─── Player-facing controls (protect users from the venues) ────────────────

  /** A player mutes broadcasts from a specific venue owner. Idempotent. */
  async mutePlayerBroadcast(playerId: string, ownerId: string) {
    await this.assertOwnerHasRelationshipWithPlayer(ownerId, playerId);
    await this.prisma.venueBroadcastMute.upsert({
      where: { ownerId_playerId: { ownerId, playerId } },
      create: { ownerId, playerId },
      update: {},
    });
    return { muted: true };
  }

  /** A player un-mutes broadcasts from a venue owner. Idempotent. */
  async unmutePlayerBroadcast(playerId: string, ownerId: string) {
    await this.prisma.venueBroadcastMute.deleteMany({ where: { ownerId, playerId } });
    return { muted: false };
  }

  /** The venue owners a player currently mutes (for their privacy settings screen). */
  async listPlayerMutes(playerId: string) {
    const mutes = await this.prisma.venueBroadcastMute.findMany({
      where: { playerId },
      select: { ownerId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    if (mutes.length === 0) return [];
    const owners = await this.prisma.user.findMany({
      where: { id: { in: mutes.map((m) => m.ownerId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(owners.map((o) => [o.id, `${o.firstName} ${o.lastName}`.trim()]));
    return mutes.map((m) => ({
      ownerId: m.ownerId,
      ownerName: nameById.get(m.ownerId) ?? 'Venue',
      mutedAt: m.createdAt,
    }));
  }

  /** A player reports a venue for misuse. Surfaced to platform admin. */
  async reportVenue(playerId: string, ownerId: string, reason: string) {
    await this.assertOwnerHasRelationshipWithPlayer(ownerId, playerId);
    const text = (reason ?? '').trim();
    if (!text) throw new NotFoundException({ code: 'EMPTY_REASON' });
    return this.prisma.venueReport.create({
      data: { ownerId, playerId, reason: text.slice(0, 1000) },
    });
  }

  /**
   * Symmetric relationship check for player-initiated actions: the player must
   * actually have booked at this owner's venues (so they can't mute/report a
   * random owner). Same booking-derived rule as the owner-side check.
   */
  private async assertOwnerHasRelationshipWithPlayer(ownerId: string, playerId: string) {
    const link = await this.prisma.booking.findFirst({
      where: {
        userId: playerId,
        isGuestSlot: false,
        match: { pitch: { ownerId } },
        status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
      },
      select: { id: true },
    });
    if (!link) throw new ForbiddenException({ code: 'NO_PLAYER_RELATIONSHIP' });
  }
}
