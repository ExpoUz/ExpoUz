import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { OrgContextService } from '../org/org-context.service';

/**
 * The CRM tenant boundary for one caller. `pitchWhere` scopes the accessible
 * venues (organizationId for members, ownerId for legacy owners); `orgId` is
 * set for members and makes notes/reveals/broadcasts org-level; `actorId` is
 * the acting member (author/attribution + legacy key).
 */
interface CrmScope {
  pitchWhere: Prisma.PitchWhereInput;
  orgId: string | null;
  actorId: string;
}

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
    private orgContext: OrgContextService,
  ) {}

  // ─── Scoping (server-side, non-negotiable) ─────────────────────────────────

  /**
   * Resolve the caller's CRM scope. Organization-scoped for members (STAFF are
   * rejected — no CRM), legacy owner-scoped otherwise. This is the ONLY place
   * the accessible venue set is decided.
   */
  private async scope(userId: string): Promise<CrmScope> {
    const ctx = await this.orgContext.resolvePortalContext(userId);
    this.orgContext.assertNotStaff(ctx.role, 'CRM');
    return { pitchWhere: ctx.pitchWhere, orgId: ctx.orgId, actorId: userId };
  }

  private async ownedPitchIds(scope: CrmScope): Promise<string[]> {
    const pitches = await this.prisma.pitch.findMany({
      where: scope.pitchWhere,
      select: { id: true },
    });
    return pitches.map((p) => p.id);
  }

  /** Throws unless `playerId` has a real booking at one of the scoped venues. */
  private async assertOwnsPlayerRelationship(scope: CrmScope, playerId: string) {
    const link = await this.prisma.booking.findFirst({
      where: {
        userId: playerId,
        isGuestSlot: false,
        match: { pitch: scope.pitchWhere },
        status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
      },
      select: { id: true },
    });
    if (!link) throw new ForbiddenException({ code: 'NO_PLAYER_RELATIONSHIP' });
  }

  private async assertCrmEnabled(actorId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { crmDisabled: true },
    });
    if (owner?.crmDisabled) throw new ForbiddenException({ code: 'CRM_DISABLED' });
  }

  // ─── Core aggregation (one pass over the scoped venues' bookings) ──────────

  private async computeAggregates(scope: CrmScope): Promise<Map<string, PlayerAgg>> {
    const pitchIds = await this.ownedPitchIds(scope);
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
    userId: string,
    opts: { search?: string; segment?: string; sort?: string; page?: number; limit?: number },
  ) {
    const scope = await this.scope(userId);
    await this.assertCrmEnabled(scope.actorId);
    const { search, segment, sort = 'recent', page = 1, limit = 50 } = opts;

    const aggregates = await this.computeAggregates(scope);
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

  async getSegments(userId: string) {
    const scope = await this.scope(userId);
    await this.assertCrmEnabled(scope.actorId);
    const aggregates = await this.computeAggregates(scope);
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

  async getPlayerDetail(userId: string, playerId: string) {
    const scope = await this.scope(userId);
    await this.assertCrmEnabled(scope.actorId);
    await this.assertOwnsPlayerRelationship(scope, playerId);

    const aggregates = await this.computeAggregates(scope);
    const agg = aggregates.get(playerId);
    if (!agg) throw new NotFoundException({ code: 'NO_PLAYER_RELATIONSHIP' });

    const notes = await this.notesForScope(scope, playerId);
    return {
      ...this.toCard(agg),
      contactAvailable: await this.isContactWindowOpen(scope, playerId),
      notes,
    };
  }

  async getPlayerHistory(userId: string, playerId: string) {
    const scope = await this.scope(userId);
    await this.assertOwnsPlayerRelationship(scope, playerId);
    const pitchIds = await this.ownedPitchIds(scope);
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

  // ─── Notes (org-level for members; owner-private for legacy) ───────────────

  /** Public endpoint entry: resolves scope, then reads the org/owner notes. */
  async listNotes(userId: string, playerId: string) {
    const scope = await this.scope(userId);
    await this.assertOwnsPlayerRelationship(scope, playerId);
    return this.notesForScope(scope, playerId);
  }

  async addNote(userId: string, playerId: string, note: string, pitchId?: string) {
    const scope = await this.scope(userId);
    await this.assertOwnsPlayerRelationship(scope, playerId);
    const trimmed = (note ?? '').trim();
    if (!trimmed) throw new NotFoundException({ code: 'EMPTY_NOTE' });
    return this.prisma.venuePlayerNote.create({
      data: {
        // ownerId stays = author for legacy queries; orgId makes it org-shared.
        ownerId: scope.actorId,
        orgId: scope.orgId,
        authorId: scope.actorId,
        playerId,
        note: trimmed.slice(0, 2000),
        pitchId: pitchId ?? null,
      },
    });
  }

  /** Org members share notes (any MANAGER/OWNER); legacy owners see their own. */
  private async notesForScope(scope: CrmScope, playerId: string) {
    const notes = await this.prisma.venuePlayerNote.findMany({
      where: scope.orgId ? { orgId: scope.orgId, playerId } : { ownerId: scope.actorId, playerId },
      orderBy: { createdAt: 'desc' },
    });
    if (notes.length === 0) return notes;
    // Attribute each note to its author (org notes may be written by any member).
    const authorIds = [...new Set(notes.map((n) => n.authorId ?? n.ownerId))];
    const authors = await this.prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(authors.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim()]));
    return notes.map((n) => ({ ...n, authorName: nameById.get(n.authorId ?? n.ownerId) ?? 'Staff' }));
  }

  // ─── Phone reveal (window-gated + audit-logged) ────────────────────────────

  private async isContactWindowOpen(scope: CrmScope, playerId: string): Promise<boolean> {
    const pitchIds = await this.ownedPitchIds(scope);
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

  async revealContact(userId: string, playerId: string, reason: string) {
    const scope = await this.scope(userId);
    await this.assertCrmEnabled(scope.actorId);
    await this.assertOwnsPlayerRelationship(scope, playerId);

    if (!(await this.isContactWindowOpen(scope, playerId))) {
      // Outside ±7 days of a booking the venue can only reach the player in-app.
      throw new ForbiddenException({ code: 'CONTACT_WINDOW_CLOSED' });
    }

    // Audit EVERY reveal against both the acting member AND the org.
    await this.prisma.contactReveal.create({
      data: {
        ownerId: scope.actorId,
        orgId: scope.orgId,
        playerId,
        reason: (reason ?? 'contact player').slice(0, 300),
      },
    });

    const player = await this.prisma.user.findUnique({
      where: { id: playerId },
      select: { phone: true, firstName: true },
    });
    return { phone: player?.phone ?? null, firstName: player?.firstName };
  }

  // ─── In-app message ────────────────────────────────────────────────────────

  async messagePlayer(userId: string, playerId: string, content: string) {
    const scope = await this.scope(userId);
    await this.assertOwnsPlayerRelationship(scope, playerId);
    const text = (content ?? '').trim();
    if (!text) throw new NotFoundException({ code: 'EMPTY_MESSAGE' });
    const conversation = await this.messages.createOrGetDirect(scope.actorId, playerId);
    await this.messages.sendMessage(conversation.id, scope.actorId, text.slice(0, 2000));
    return { conversationId: conversation.id };
  }

  // ─── Insights ──────────────────────────────────────────────────────────────

  async getInsights(userId: string) {
    const scope = await this.scope(userId);
    await this.assertCrmEnabled(scope.actorId);
    const aggregates = await this.computeAggregates(scope);
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

  /** Per-segment recipient counts EXCLUDING muted players (what the sender sees). */
  async getBroadcastCounts(userId: string) {
    const scope = await this.scope(userId);
    await this.assertCrmEnabled(scope.actorId);
    const aggregates = await this.computeAggregates(scope);
    const muted = await this.mutedPlayerIds(scope);

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
    return { counts, sentThisWeek: await this.broadcastsThisWeek(scope), weeklyLimit: 2 };
  }

  /** Weekly broadcast count — per ORGANISATION for members, per owner otherwise. */
  private async broadcastsThisWeek(scope: CrmScope): Promise<number> {
    const weekAgo = new Date(Date.now() - 7 * DAY);
    return this.prisma.venueBroadcast.count({
      where: scope.orgId
        ? { orgId: scope.orgId, createdAt: { gte: weekAgo } }
        : { ownerId: scope.actorId, createdAt: { gte: weekAgo } },
    });
  }

  /**
   * Muted players for the scope. For an org, a mute against ANY member of the
   * org suppresses the org's broadcasts to that player.
   */
  private async mutedPlayerIds(scope: CrmScope): Promise<Set<string>> {
    let ownerIds = [scope.actorId];
    if (scope.orgId) {
      const members = await this.prisma.orgMember.findMany({
        where: { orgId: scope.orgId },
        select: { userId: true },
      });
      ownerIds = members.map((m) => m.userId);
    }
    const mutes = await this.prisma.venueBroadcastMute.findMany({
      where: { ownerId: { in: ownerIds } },
      select: { playerId: true },
    });
    return new Set(mutes.map((m) => m.playerId));
  }

  async broadcast(userId: string, segment: string, message: string) {
    const scope = await this.scope(userId);
    await this.assertCrmEnabled(scope.actorId);
    const owner = await this.prisma.user.findUnique({
      where: { id: scope.actorId },
      select: { broadcastDisabled: true, firstName: true },
    });
    if (owner?.broadcastDisabled) throw new ForbiddenException({ code: 'BROADCAST_DISABLED' });

    const text = (message ?? '').trim();
    if (!text) throw new NotFoundException({ code: 'EMPTY_MESSAGE' });

    // Weekly rate limit: 2 broadcasts per ORGANISATION per rolling 7 days, so
    // one member cannot silently spend the whole quota.
    if ((await this.broadcastsThisWeek(scope)) >= 2) {
      throw new ForbiddenException({ code: 'BROADCAST_LIMIT' });
    }

    // Resolve recipients from the segment, excluding muted players.
    const aggregates = await this.computeAggregates(scope);
    const muted = await this.mutedPlayerIds(scope);
    const recipients = [...aggregates.values()].filter((agg) => {
      if (muted.has(agg.id)) return false;
      return segment === 'ALL' || this.computeSegment(agg) === segment;
    });

    // Log first (admin oversight + rate limit basis), against member and org.
    await this.prisma.venueBroadcast.create({
      data: {
        ownerId: scope.actorId,
        orgId: scope.orgId,
        segment,
        message: text.slice(0, 1000),
        recipientCount: recipients.length,
      },
    });

    // Deliver as a real in-app direct message from the sender to each recipient.
    const body = `📣 ${owner?.firstName ?? 'Your venue'}: ${text.slice(0, 1000)}`;
    for (const r of recipients) {
      try {
        const conv = await this.messages.createOrGetDirect(scope.actorId, r.id);
        await this.messages.sendMessage(conv.id, scope.actorId, body);
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
