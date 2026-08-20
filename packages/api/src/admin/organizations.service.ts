import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgContactType, OrgPipelineStage, OrgRole, OrgStatus, Prisma } from '@prisma/client';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Superadmin-facing management of partner organizations (PART 1). Every method
 * here runs as a SUPER_ADMIN (guarded at the controller) and can therefore see
 * across all tenants — this is deliberately the ONE place that is not org-scoped.
 * Partner-facing code must never call into this service.
 */
@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  // ---- platform defaults (used when an org leaves a rate blank) ----
  private async platformDefaults() {
    const s = await this.prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    return {
      commissionPct: Math.round((s?.commissionRate ?? 0.1) * 100 * 100) / 100,
      playerFeePct: Math.round((s?.platformFeeRate ?? 0.05) * 100 * 100) / 100,
    };
  }

  /** org.commissionRate is stored as a percentage (12.00 = 12%); null = default. */
  private effectivePct(orgRate: Prisma.Decimal | null, fallback: number) {
    return orgRate == null ? fallback : Number(orgRate);
  }

  // ---- list with per-org headline stats ----
  async list(filters: { search?: string; status?: OrgStatus }) {
    const where: Prisma.OrganizationWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [orgs, defaults] = await Promise.all([
      this.prisma.organization.findMany({ where, orderBy: { createdAt: 'desc' } }),
      this.platformDefaults(),
    ]);

    return Promise.all(
      orgs.map(async (org) => {
        const stats = await this.orgStats(org.id);
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logoUrl: org.logoUrl,
          status: org.status,
          pipelineStage: org.pipelineStage,
          commissionPct: this.effectivePct(org.commissionRate, defaults.commissionPct),
          commissionIsDefault: org.commissionRate == null,
          ...stats,
        };
      }),
    );
  }

  /** Headline counts + this-month revenue for one org. */
  private async orgStats(orgId: string) {
    const pitchIds = await this.pitchIds(orgId);
    const monthStart = dayjs().startOf('month').toDate();

    const [venues, staff, players, revenueAgg] = await Promise.all([
      this.prisma.pitch.count({ where: { organizationId: orgId } }),
      this.prisma.orgMember.count({ where: { orgId } }),
      pitchIds.length
        ? this.prisma.booking
            .findMany({
              where: { match: { pitchId: { in: pitchIds } } },
              select: { userId: true },
              distinct: ['userId'],
            })
            .then((r) => r.length)
        : Promise.resolve(0),
      this.monthRevenue(pitchIds, monthStart),
    ]);

    return { venues, staff, players, monthRevenue: revenueAgg };
  }

  private async pitchIds(orgId: string): Promise<string[]> {
    const pitches = await this.prisma.pitch.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    return pitches.map((p) => p.id);
  }

  private async monthRevenue(pitchIds: string[], from: Date): Promise<number> {
    if (!pitchIds.length) return 0;
    const agg = await this.prisma.transaction.aggregate({
      where: {
        status: { in: ['HELD', 'RELEASED'] },
        createdAt: { gte: from },
        OR: [
          { booking: { match: { pitchId: { in: pitchIds } } } },
          { pitchBooking: { pitchId: { in: pitchIds } } },
        ],
      },
      _sum: { amount: true },
    });
    return Math.round(Number(agg._sum.amount ?? 0));
  }

  // ---- create ----
  async create(
    createdById: string,
    dto: {
      name: string;
      slug: string;
      logoUrl?: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
      commissionRate?: number | null;
      playerFeeRate?: number | null;
      contractStartDate?: string;
      contractEndDate?: string;
      notes?: string;
      // Optional first OWNER to attach immediately.
      ownerUserId?: string;
    },
  ) {
    if (!dto.name?.trim()) throw new BadRequestException('Name is required');
    const slug = (dto.slug || dto.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) throw new BadRequestException('Invalid slug');

    const existing = await this.prisma.organization.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('An organization with this slug already exists');

    if (dto.ownerUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.ownerUserId } });
      if (!user) throw new NotFoundException('Owner user not found');
    }

    return this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        slug,
        logoUrl: dto.logoUrl || null,
        contactEmail: dto.contactEmail || null,
        contactPhone: dto.contactPhone || null,
        address: dto.address || null,
        commissionRate: dto.commissionRate == null ? null : new Prisma.Decimal(dto.commissionRate),
        playerFeeRate: dto.playerFeeRate == null ? null : new Prisma.Decimal(dto.playerFeeRate),
        contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : null,
        contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : null,
        notes: dto.notes || null,
        createdById,
        members: dto.ownerUserId
          ? { create: { userId: dto.ownerUserId, role: 'OWNER', invitedBy: createdById } }
          : undefined,
      },
      include: { members: { include: { user: true } } },
    });
  }

  // ---- detail: overview ----
  async getById(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    const defaults = await this.platformDefaults();
    const stats = await this.orgStats(id);
    return {
      ...org,
      commissionRate: org.commissionRate == null ? null : Number(org.commissionRate),
      playerFeeRate: org.playerFeeRate == null ? null : Number(org.playerFeeRate),
      effectiveCommissionPct: this.effectivePct(org.commissionRate, defaults.commissionPct),
      effectivePlayerFeePct: this.effectivePct(org.playerFeeRate, defaults.playerFeePct),
      platformDefaults: defaults,
      ...stats,
    };
  }

  async update(
    id: string,
    dto: Partial<{
      name: string;
      logoUrl: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      address: string | null;
      commissionRate: number | null;
      playerFeeRate: number | null;
      contractStartDate: string | null;
      contractEndDate: string | null;
      notes: string | null;
    }>,
  ) {
    await this.mustExist(id);
    const data: Prisma.OrganizationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.commissionRate !== undefined)
      data.commissionRate = dto.commissionRate == null ? null : new Prisma.Decimal(dto.commissionRate);
    if (dto.playerFeeRate !== undefined)
      data.playerFeeRate = dto.playerFeeRate == null ? null : new Prisma.Decimal(dto.playerFeeRate);
    if (dto.contractStartDate !== undefined)
      data.contractStartDate = dto.contractStartDate ? new Date(dto.contractStartDate) : null;
    if (dto.contractEndDate !== undefined)
      data.contractEndDate = dto.contractEndDate ? new Date(dto.contractEndDate) : null;
    if (dto.notes !== undefined) data.notes = dto.notes;
    return this.prisma.organization.update({ where: { id }, data });
  }

  /**
   * Change status. Suspending must NOT cancel players' already-confirmed games —
   * we only flip the org flag; venues stop taking NEW bookings (enforced where
   * bookings are created) but existing bookings are honoured.
   */
  async setStatus(id: string, status: OrgStatus) {
    await this.mustExist(id);
    return this.prisma.organization.update({ where: { id }, data: { status } });
  }

  // ---- venues ----
  async getVenues(id: string) {
    await this.mustExist(id);
    const [venues, unassigned] = await Promise.all([
      this.prisma.pitch.findMany({
        where: { organizationId: id },
        include: { _count: { select: { matches: true, pitchBookings: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      // Pitches not yet attached to any org — candidates to attach.
      this.prisma.pitch.findMany({
        where: { organizationId: null },
        select: { id: true, name: true, district: true, city: true, sport: true, ownerId: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return { venues, unassigned };
  }

  /**
   * Attach a venue to this org. If it already belongs to another org this is a
   * MOVE, which transfers future-booking visibility and must be explicitly
   * confirmed by the caller (confirmMove). The audit interceptor records it.
   */
  async assignVenue(id: string, pitchId: string, confirmMove = false) {
    await this.mustExist(id);
    const pitch = await this.prisma.pitch.findUnique({ where: { id: pitchId } });
    if (!pitch) throw new NotFoundException('Venue not found');
    if (pitch.organizationId && pitch.organizationId !== id && !confirmMove) {
      throw new ConflictException(
        'Venue already belongs to another organization; pass confirmMove to move it',
      );
    }
    return this.prisma.pitch.update({
      where: { id: pitchId },
      data: { organizationId: id },
    });
  }

  async removeVenue(id: string, pitchId: string) {
    await this.mustExist(id);
    const pitch = await this.prisma.pitch.findUnique({ where: { id: pitchId } });
    if (!pitch || pitch.organizationId !== id)
      throw new NotFoundException('Venue not in this organization');
    return this.prisma.pitch.update({ where: { id: pitchId }, data: { organizationId: null } });
  }

  // ---- staff ----
  async getStaff(id: string) {
    await this.mustExist(id);
    const [members, invites] = await Promise.all([
      this.prisma.orgMember.findMany({
        where: { orgId: id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatarUrl: true,
              telegramUsername: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      }),
      this.prisma.orgInvite.findMany({
        where: { orgId: id, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { members, invites };
  }

  /** Directly attach an existing user account as a member (superadmin power). */
  async attachUser(id: string, userId: string, role: OrgRole, actorId: string) {
    await this.mustExist(id);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const dupe = await this.prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: id, userId } },
    });
    if (dupe) throw new ConflictException('User is already a member');
    return this.prisma.orgMember.create({
      data: { orgId: id, userId, role, invitedBy: actorId },
      include: { user: true },
    });
  }

  /** Create an invite (by phone or Telegram) with a join token. */
  async invite(
    id: string,
    dto: { phone?: string; telegramId?: string; role?: OrgRole },
    actorId: string,
  ) {
    await this.mustExist(id);
    if (!dto.phone && !dto.telegramId)
      throw new BadRequestException('Provide a phone number or Telegram username');
    return this.prisma.orgInvite.create({
      data: {
        orgId: id,
        phone: dto.phone || null,
        telegramId: dto.telegramId || null,
        role: dto.role ?? 'STAFF',
        createdById: actorId,
        // 7-day invite window.
        expiresAt: dayjs().add(7, 'day').toDate(),
      },
    });
  }

  async revokeInvite(id: string, inviteId: string) {
    await this.mustExist(id);
    const invite = await this.prisma.orgInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.orgId !== id) throw new NotFoundException('Invite not found');
    return this.prisma.orgInvite.delete({ where: { id: inviteId } });
  }

  async changeMemberRole(id: string, memberId: string, role: OrgRole) {
    const member = await this.prisma.orgMember.findUnique({ where: { id: memberId } });
    if (!member || member.orgId !== id) throw new NotFoundException('Member not found');
    return this.guardLastOwner(id, member, role, async () =>
      this.prisma.orgMember.update({ where: { id: memberId }, data: { role } }),
    );
  }

  async removeMember(id: string, memberId: string) {
    const member = await this.prisma.orgMember.findUnique({ where: { id: memberId } });
    if (!member || member.orgId !== id) throw new NotFoundException('Member not found');
    return this.guardLastOwner(id, member, null, async () =>
      this.prisma.orgMember.delete({ where: { id: memberId } }),
    );
  }

  /** Never leave an org without an OWNER. */
  private async guardLastOwner<T>(
    orgId: string,
    member: { id: string; role: OrgRole },
    newRole: OrgRole | null,
    action: () => Promise<T>,
  ): Promise<T> {
    const demotingOwner = member.role === 'OWNER' && newRole !== 'OWNER';
    if (demotingOwner) {
      const owners = await this.prisma.orgMember.count({ where: { orgId, role: 'OWNER' } });
      if (owners <= 1)
        throw new ForbiddenException('Cannot remove or demote the last OWNER of an organization');
    }
    return action();
  }

  // ---- players (customers who booked at this org's venues) ----
  async getPlayers(id: string) {
    await this.mustExist(id);
    const pitchIds = await this.pitchIds(id);
    if (!pitchIds.length) return [];
    return this.prisma.booking.findMany({
      where: { match: { pitchId: { in: pitchIds } }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatarUrl: true,
            eloRating: true,
            reliabilityScore: true,
          },
        },
      },
      distinct: ['userId'],
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ---- revenue ----
  async getRevenue(id: string) {
    await this.mustExist(id);
    const pitches = await this.prisma.pitch.findMany({
      where: { organizationId: id },
      select: { id: true, name: true },
    });
    const org = await this.prisma.organization.findUnique({ where: { id } });
    const defaults = await this.platformDefaults();
    const commissionPct = this.effectivePct(org!.commissionRate, defaults.commissionPct);

    const perVenue = await Promise.all(
      pitches.map(async (p) => {
        const agg = await this.prisma.transaction.aggregate({
          where: {
            status: { in: ['HELD', 'RELEASED'] },
            OR: [{ booking: { match: { pitchId: p.id } } }, { pitchBooking: { pitchId: p.id } }],
          },
          _sum: { amount: true },
        });
        const gross = Number(agg._sum.amount ?? 0);
        const commission = Math.round((gross * commissionPct) / 100);
        return { pitchId: p.id, pitchName: p.name, gross, commission, payout: gross - commission };
      }),
    );

    const totalGross = perVenue.reduce((s, v) => s + v.gross, 0);
    const totalCommission = perVenue.reduce((s, v) => s + v.commission, 0);
    return {
      commissionPct,
      perVenue,
      totalGross,
      totalCommission,
      totalPayout: totalGross - totalCommission,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 3 — Partner-relationship CRM (managing the partner, not their players)
  // ══════════════════════════════════════════════════════════════════════════

  /** Contact log + follow-up + computed health for one org's CRM screen. */
  async getCrm(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    const [contacts, health] = await Promise.all([this.listContacts(id), this.computeHealth(id, org)]);
    return {
      id: org.id,
      name: org.name,
      pipelineStage: org.pipelineStage,
      followUpDate: org.followUpDate,
      followUpUserId: org.followUpUserId,
      contractStartDate: org.contractStartDate,
      contractEndDate: org.contractEndDate,
      contacts,
      health,
    };
  }

  async listContacts(id: string) {
    const logs = await this.prisma.orgContactLog.findMany({
      where: { orgId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    if (!logs.length) return [];
    const authors = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(logs.map((l) => l.authorId))] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(authors.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim()]));
    return logs.map((l) => ({ ...l, authorName: nameById.get(l.authorId) ?? 'Admin' }));
  }

  async addContact(
    id: string,
    authorId: string,
    dto: { type?: OrgContactType; summary: string; followUpDate?: string | null },
  ) {
    await this.mustExist(id);
    const summary = (dto.summary ?? '').trim();
    if (!summary) throw new BadRequestException('A summary is required');
    const log = await this.prisma.orgContactLog.create({
      data: { orgId: id, authorId, type: dto.type ?? 'NOTE', summary: summary.slice(0, 2000) },
    });
    // Logging a contact may also set the next follow-up in one step.
    if (dto.followUpDate !== undefined) {
      await this.prisma.organization.update({
        where: { id },
        data: {
          followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
          followUpUserId: dto.followUpDate ? authorId : null,
        },
      });
    }
    return log;
  }

  /** Move an org along the sales pipeline (LEAD → … → ACTIVE → CHURNED). */
  async setPipeline(id: string, stage: OrgPipelineStage) {
    await this.mustExist(id);
    return this.prisma.organization.update({ where: { id }, data: { pipelineStage: stage } });
  }

  /** Set/clear the next follow-up and the superadmin who owns it. */
  async setFollowUp(id: string, dto: { date: string | null; userId?: string | null }) {
    await this.mustExist(id);
    return this.prisma.organization.update({
      where: { id },
      data: {
        followUpDate: dto.date ? new Date(dto.date) : null,
        followUpUserId: dto.date ? dto.userId ?? null : null,
      },
    });
  }

  // ---- health indicators ----

  /** Bookings count at the org's venues within [from, to). */
  private async bookingsInWindow(pitchIds: string[], from: Date, to: Date): Promise<number> {
    if (!pitchIds.length) return 0;
    return this.prisma.booking.count({
      where: {
        match: { pitchId: { in: pitchIds } },
        isGuestSlot: false,
        status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
        createdAt: { gte: from, lt: to },
      },
    });
  }

  private async revenueInWindow(pitchIds: string[], from: Date, to: Date): Promise<number> {
    if (!pitchIds.length) return 0;
    const agg = await this.prisma.transaction.aggregate({
      where: {
        status: { in: ['HELD', 'RELEASED'] },
        createdAt: { gte: from, lt: to },
        OR: [
          { booking: { match: { pitchId: { in: pitchIds } } } },
          { pitchBooking: { pitchId: { in: pitchIds } } },
        ],
      },
      _sum: { amount: true },
    });
    return Math.round(Number(agg._sum.amount ?? 0));
  }

  /** up / flat / down comparing a recent window to the one before it. */
  private trend(recent: number, previous: number): 'up' | 'flat' | 'down' {
    if (previous === 0) return recent > 0 ? 'up' : 'flat';
    const ratio = recent / previous;
    if (ratio <= 0.6) return 'down'; // 40%+ decline
    if (ratio >= 1.1) return 'up';
    return 'flat';
  }

  /**
   * Health snapshot for the partner-CRM: venue utilisation, 30-day booking and
   * revenue trends, last activity, unresolved disputes, and the derived flags a
   * superadmin scans to answer "which partner needs attention this week".
   */
  private async computeHealth(
    id: string,
    org: { contractEndDate: Date | null },
  ) {
    const pitchIds = await this.pitchIds(id);
    const now = Date.now();
    const d30 = new Date(now - 30 * 24 * 3600 * 1000);
    const d60 = new Date(now - 60 * 24 * 3600 * 1000);
    const nowDate = new Date(now);

    const [venuesListed, venuesActiveRows, last30, prev30, rev30, revPrev30, lastBooking, disputes] =
      await Promise.all([
        this.prisma.pitch.count({ where: { organizationId: id } }),
        pitchIds.length
          ? this.prisma.booking.findMany({
              where: {
                match: { pitchId: { in: pitchIds } },
                isGuestSlot: false,
                status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
                createdAt: { gte: d30 },
              },
              select: { match: { select: { pitchId: true } } },
              distinct: ['matchId'],
            })
          : Promise.resolve([]),
        this.bookingsInWindow(pitchIds, d30, nowDate),
        this.bookingsInWindow(pitchIds, d60, d30),
        this.revenueInWindow(pitchIds, d30, nowDate),
        this.revenueInWindow(pitchIds, d60, d30),
        pitchIds.length
          ? this.prisma.booking.findFirst({
              where: { match: { pitchId: { in: pitchIds } }, isGuestSlot: false },
              orderBy: { createdAt: 'desc' },
              select: { createdAt: true },
            })
          : Promise.resolve(null),
        pitchIds.length
          ? this.prisma.matchResult.count({
              where: { isDisputed: true, isConfirmed: false, match: { pitchId: { in: pitchIds } } },
            })
          : Promise.resolve(0),
      ]);

    const venuesActive = new Set(venuesActiveRows.map((b) => b.match.pitchId)).size;
    const bookingsTrend = this.trend(last30, prev30);
    const revenueTrend = this.trend(rev30, revPrev30);
    const lastActivityAt = lastBooking?.createdAt ?? null;
    const dormant = !lastActivityAt || lastActivityAt.getTime() < now - 30 * 24 * 3600 * 1000;
    const renewalDue =
      !!org.contractEndDate &&
      org.contractEndDate.getTime() > now &&
      org.contractEndDate.getTime() < now + 30 * 24 * 3600 * 1000;

    const flags: string[] = [];
    if (bookingsTrend === 'down' && prev30 > 0) flags.push('AT_RISK');
    if (dormant) flags.push('DORMANT');
    if (renewalDue) flags.push('RENEWAL_DUE');

    return {
      venuesListed,
      venuesActive,
      bookingsLast30: last30,
      bookingsPrev30: prev30,
      bookingsTrend,
      revenueLast30: rev30,
      revenuePrev30: revPrev30,
      revenueTrend,
      lastActivityAt,
      unresolvedDisputes: disputes,
      flags,
    };
  }

  /**
   * Portfolio view across all organizations: revenue leaderboard, at-risk and
   * renewals-due lists, and the onboarding funnel by pipeline stage.
   */
  async insights() {
    const orgs = await this.prisma.organization.findMany({
      where: { status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'desc' },
    });

    const rows = await Promise.all(
      orgs.map(async (org) => {
        const health = await this.computeHealth(org.id, org);
        return {
          id: org.id,
          name: org.name,
          logoUrl: org.logoUrl,
          status: org.status,
          pipelineStage: org.pipelineStage,
          contractEndDate: org.contractEndDate,
          followUpDate: org.followUpDate,
          ...health,
        };
      }),
    );

    const funnel: Record<OrgPipelineStage, number> = {
      LEAD: 0,
      CONTACTED: 0,
      DEMO: 0,
      NEGOTIATING: 0,
      ACTIVE: 0,
      CHURNED: 0,
    };
    for (const r of rows) funnel[r.pipelineStage]++;

    return {
      revenueByOrg: [...rows].sort((a, b) => b.revenueLast30 - a.revenueLast30),
      atRisk: rows.filter((r) => r.flags.includes('AT_RISK')),
      dormant: rows.filter((r) => r.flags.includes('DORMANT')),
      renewalsDue: rows
        .filter((r) => r.flags.includes('RENEWAL_DUE'))
        .sort((a, b) => (a.contractEndDate?.getTime() ?? 0) - (b.contractEndDate?.getTime() ?? 0)),
      onboardingFunnel: funnel,
    };
  }

  private async mustExist(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!org) throw new NotFoundException('Organization not found');
  }
}
