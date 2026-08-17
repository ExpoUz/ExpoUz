import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrgRole, Prisma } from '@prisma/client';
import * as dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { OrgContextService, PortalContext } from '../org/org-context.service';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Keep only valid {open,close} day entries; drop malformed/closed days. */
function sanitizeHours(input: any): Record<string, { open: string; close: string }> | null {
  if (!input || typeof input !== 'object') return null;
  const out: Record<string, { open: string; close: string }> = {};
  for (const day of DAYS) {
    const h = input[day];
    if (h && typeof h.open === 'string' && typeof h.close === 'string' && HHMM.test(h.open) && HHMM.test(h.close)) {
      out[day] = { open: h.open, close: h.close };
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Partner-panel service. Every query is scoped to the caller's ORGANIZATION
 * (resolved server-side from membership), not to a single owner — so multiple
 * staff share the same venues and schedule. Legacy owners with no membership
 * still work, scoped by ownerId, until the personal-org migration runs.
 */
@Injectable()
export class PitchAdminService {
  constructor(
    private prisma: PrismaService,
    private orgContext: OrgContextService,
  ) {}

  /** The tenant boundary + role for the caller. */
  private scope(userId: string): Promise<PortalContext> {
    return this.orgContext.resolvePortalContext(userId);
  }

  private async ownedPitchIds(pitchWhere: Prisma.PitchWhereInput): Promise<string[]> {
    const rows = await this.prisma.pitch.findMany({ where: pitchWhere, select: { id: true } });
    return rows.map((r) => r.id);
  }

  // ─── Context (org identity + role for the portal shell) ───────────────────
  async getContext(userId: string) {
    const { org, role, legacy } = await this.scope(userId);
    return { org, role, legacy };
  }

  async getDashboard(userId: string) {
    const { pitchWhere, role } = await this.scope(userId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const pitchIds = await this.ownedPitchIds(pitchWhere);
    const matches = await this.prisma.match.findMany({
      where: { pitchId: { in: pitchIds } },
      select: { id: true },
    });
    const matchIds = matches.map((m) => m.id);

    const [totalPitches, matchesThisMonth, revenueData, uniquePlayers] = await Promise.all([
      pitchIds.length,
      this.prisma.match.count({ where: { pitchId: { in: pitchIds }, startTime: { gte: monthStart } } }),
      this.prisma.transaction.aggregate({
        where: { booking: { matchId: { in: matchIds } }, status: { in: ['HELD', 'RELEASED'] } },
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
      // STAFF must not see revenue anywhere in the panel.
      totalRevenue: role === 'STAFF' ? null : revenueData._sum.amount || 0,
      uniquePlayers: uniquePlayers.length,
    };
  }

  async getPitches(userId: string) {
    const { pitchWhere } = await this.scope(userId);
    return this.prisma.pitch.findMany({
      where: pitchWhere,
      include: { amenities: true, _count: { select: { matches: true, followers: true } } },
    });
  }

  async getMatches(userId: string, page = 1, limit = 20) {
    const { pitchWhere } = await this.scope(userId);
    const pitchIds = await this.ownedPitchIds(pitchWhere);

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

  async getPlayers(userId: string) {
    const { pitchWhere, role } = await this.scope(userId);
    this.orgContext.assertNotStaff(role, 'players / CRM');
    const pitchIds = await this.ownedPitchIds(pitchWhere);

    const bookings = await this.prisma.booking.findMany({
      where: { match: { pitchId: { in: pitchIds } }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      distinct: ['userId'],
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, eloRating: true, skillLevel: true },
        },
      },
    });

    return bookings.map((b) => b.user);
  }

  async getRevenue(userId: string) {
    const { pitchWhere, role } = await this.scope(userId);
    this.orgContext.assertNotStaff(role, 'revenue');
    const pitches = await this.prisma.pitch.findMany({ where: pitchWhere, select: { id: true, commission: true } });
    const pitchIds = pitches.map((p) => p.id);
    const avgCommission = pitches.reduce((sum, p) => sum + p.commission, 0) / (pitches.length || 1);

    const revenueData = await this.prisma.transaction.aggregate({
      where: { booking: { match: { pitchId: { in: pitchIds } } }, status: { in: ['HELD', 'RELEASED'] } },
      _sum: { amount: true },
    });

    const grossRevenue = Number(revenueData._sum.amount || 0);
    const commissionDeducted = grossRevenue * avgCommission;
    const netRevenue = grossRevenue - commissionDeducted;

    return { grossRevenue, commissionDeducted, netRevenue };
  }

  async getSchedule(userId: string, from: string, to: string) {
    const { pitchWhere } = await this.scope(userId);
    const pitchIds = await this.ownedPitchIds(pitchWhere);

    return this.prisma.booking.findMany({
      where: {
        match: { pitchId: { in: pitchIds }, startTime: { gte: new Date(from), lte: new Date(to) } },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      include: {
        match: { include: { pitch: { select: { id: true, name: true } } } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { match: { startTime: 'asc' } },
    });
  }

  async getPitchBookings(userId: string, filters: { status?: string; pitchId?: string; page?: number; limit?: number }) {
    const { pitchWhere } = await this.scope(userId);
    const { status, pitchId, page = 1, limit = 20 } = filters;
    const ownedPitchIds = await this.ownedPitchIds(pitchWhere);

    const where: any = { pitchId: pitchId && ownedPitchIds.includes(pitchId) ? pitchId : { in: ownedPitchIds } };
    if (status) where.status = status;

    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      this.prisma.pitchBooking.findMany({
        where,
        include: {
          pitch: { select: { id: true, name: true } },
          host: { select: { id: true, firstName: true, lastName: true, phone: true } },
          participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
          transaction: { select: { status: true, amount: true, gateway: true } },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pitchBooking.count({ where }),
    ]);

    return { data: bookings, total, page, limit };
  }

  async getPitchDetail(userId: string, pitchId: string) {
    const { pitchWhere } = await this.scope(userId);
    const pitch = await this.prisma.pitch.findFirstOrThrow({
      where: { id: pitchId, ...pitchWhere },
      include: {
        amenities: true,
        location: true,
        _count: { select: { matches: true, pitchBookings: true, followers: true } },
      },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayMatches, todayPitchBookings, upcoming] = await Promise.all([
      this.prisma.match.findMany({
        where: { pitchId, startTime: { gte: todayStart, lte: todayEnd } },
        include: { host: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { bookings: true } } },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.pitchBooking.findMany({
        where: { pitchId, startTime: { gte: todayStart, lte: todayEnd }, status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_PAYMENT'] } },
        include: { host: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.match.findMany({
        where: { pitchId, startTime: { gt: new Date() }, status: { in: ['OPEN', 'FULL', 'CONFIRMED'] } },
        include: { _count: { select: { bookings: true } } },
        orderBy: { startTime: 'asc' },
        take: 10,
      }),
    ]);

    return { pitch, todayMatches, todayPitchBookings, upcoming };
  }

  async updatePitchAvailability(userId: string, pitchId: string, isActive: boolean) {
    const { pitchWhere, role } = await this.scope(userId);
    this.orgContext.assertNotStaff(role, 'venue editing');
    const pitch = await this.prisma.pitch.findFirstOrThrow({ where: { id: pitchId, ...pitchWhere } });
    return this.prisma.pitch.update({ where: { id: pitch.id }, data: { isActive } });
  }

  async updateOpeningHours(
    userId: string,
    pitchId: string,
    body: { openingHours?: any; slotDuration?: number; courtCount?: number },
  ) {
    const { pitchWhere, role } = await this.scope(userId);
    this.orgContext.assertNotStaff(role, 'venue editing');
    const pitch = await this.prisma.pitch.findFirstOrThrow({ where: { id: pitchId, ...pitchWhere } });

    const data: any = {};
    if (body.openingHours !== undefined) {
      const clean = sanitizeHours(body.openingHours);
      data.openingHours = clean ?? Prisma.DbNull;
    }
    if (body.slotDuration !== undefined) {
      const d = Number(body.slotDuration);
      if (![30, 60, 90, 120].includes(d)) throw new BadRequestException('Invalid slotDuration');
      data.slotDuration = d;
    }
    if (body.courtCount !== undefined) {
      const c = Number(body.courtCount);
      if (!Number.isInteger(c) || c < 1 || c > 20) throw new BadRequestException('Invalid courtCount');
      data.courtCount = c;
    }

    return this.prisma.pitch.update({ where: { id: pitch.id }, data });
  }

  async getPitchUsers(userId: string, filters: { pitchId?: string; search?: string; page?: number; limit?: number }) {
    const { pitchWhere, role } = await this.scope(userId);
    this.orgContext.assertNotStaff(role, 'players / CRM');
    const { pitchId, search, page = 1, limit = 20 } = filters;
    const ownedPitchIds = await this.ownedPitchIds(pitchWhere);
    const pitchFilter = pitchId && ownedPitchIds.includes(pitchId) ? [pitchId] : ownedPitchIds;

    const [matchUserIds, pitchBookingUserIds] = await Promise.all([
      this.prisma.booking.findMany({
        where: { match: { pitchId: { in: pitchFilter } }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.pitchBookingParticipant.findMany({
        where: { booking: { pitchId: { in: pitchFilter } } },
        distinct: ['userId'],
        select: { userId: true },
      }),
    ]);

    const userIds = [...new Set([...matchUserIds.map((b) => b.userId), ...pitchBookingUserIds.map((p) => p.userId)])];

    const where: any = { id: { in: userIds }, deletedAt: null };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
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
          avatarUrl: true,
          phone: true,
          eloRating: true,
          skillLevel: true,
          reliabilityScore: true,
          isBanned: true,
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

  async cancelMatchOnPitch(userId: string, matchId: string) {
    const { pitchWhere } = await this.scope(userId);
    const match = await this.prisma.match.findFirstOrThrow({ where: { id: matchId, pitch: pitchWhere } });
    return this.prisma.match.update({ where: { id: match.id }, data: { status: 'CANCELLED' } });
  }

  async cancelPitchBooking(userId: string, bookingId: string) {
    const { pitchWhere } = await this.scope(userId);
    const booking = await this.prisma.pitchBooking.findFirstOrThrow({ where: { id: bookingId, pitch: pitchWhere } });
    return this.prisma.pitchBooking.update({ where: { id: booking.id }, data: { status: 'CANCELLED_REFUND' } });
  }

  // ─── Staff management (OWNER only, scoped to the caller's own org) ─────────
  private async requireOwnerOrg(userId: string): Promise<string> {
    const { orgId, role, legacy } = await this.scope(userId);
    if (legacy || !orgId) {
      throw new ForbiddenException('Staff management requires an organization');
    }
    if (role !== 'OWNER') {
      throw new ForbiddenException('Only an OWNER can manage staff');
    }
    return orgId;
  }

  async getStaff(userId: string) {
    const orgId = await this.requireOwnerOrg(userId);
    const [members, invites] = await Promise.all([
      this.prisma.orgMember.findMany({
        where: { orgId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true, telegramUsername: true } },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      }),
      this.prisma.orgInvite.findMany({
        where: { orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { members, invites };
  }

  async inviteStaff(userId: string, dto: { phone?: string; telegramId?: string; role?: OrgRole }) {
    const orgId = await this.requireOwnerOrg(userId);
    if (!dto.phone && !dto.telegramId) throw new BadRequestException('Provide a phone or Telegram username');
    return this.prisma.orgInvite.create({
      data: {
        orgId,
        phone: dto.phone || null,
        telegramId: dto.telegramId || null,
        role: dto.role ?? 'STAFF',
        createdById: userId,
        expiresAt: dayjs().add(7, 'day').toDate(),
      },
    });
  }

  async revokeInvite(userId: string, inviteId: string) {
    const orgId = await this.requireOwnerOrg(userId);
    const invite = await this.prisma.orgInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.orgId !== orgId) throw new NotFoundException('Invite not found');
    return this.prisma.orgInvite.delete({ where: { id: inviteId } });
  }

  async changeStaffRole(userId: string, memberId: string, role: OrgRole) {
    const orgId = await this.requireOwnerOrg(userId);
    const member = await this.prisma.orgMember.findUnique({ where: { id: memberId } });
    if (!member || member.orgId !== orgId) throw new NotFoundException('Member not found');
    await this.guardLastOwner(orgId, member, role);
    return this.prisma.orgMember.update({ where: { id: memberId }, data: { role } });
  }

  async removeStaff(userId: string, memberId: string) {
    const orgId = await this.requireOwnerOrg(userId);
    const member = await this.prisma.orgMember.findUnique({ where: { id: memberId } });
    if (!member || member.orgId !== orgId) throw new NotFoundException('Member not found');
    await this.guardLastOwner(orgId, member, null);
    return this.prisma.orgMember.delete({ where: { id: memberId } });
  }

  /** Never leave an org without an OWNER. */
  private async guardLastOwner(orgId: string, member: { role: OrgRole }, newRole: OrgRole | null) {
    if (member.role === 'OWNER' && newRole !== 'OWNER') {
      const owners = await this.prisma.orgMember.count({ where: { orgId, role: 'OWNER' } });
      if (owners <= 1) throw new ConflictException('Cannot remove or demote the last OWNER');
    }
  }
}
