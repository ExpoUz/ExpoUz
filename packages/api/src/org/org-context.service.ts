import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface OrgContext {
  orgId: string;
  role: OrgRole;
}

/**
 * The single source of truth for what a partner user is allowed to touch.
 *
 * The tenant boundary is ALWAYS resolved server-side from the caller's
 * OrgMember row — never from a client-supplied org id, route param or body
 * field. Every `/v1/org/*` query starts by resolving this context.
 */
@Injectable()
export class OrgContextService {
  constructor(private prisma: PrismaService) {}

  /**
   * Resolve the active membership for a user. Returns null when the user has no
   * membership or their organization is not ACTIVE (e.g. SUSPENDED/ARCHIVED),
   * which the caller can turn into a friendly "no access" state.
   */
  async findMembership(userId: string): Promise<OrgContext | null> {
    const membership = await this.prisma.orgMember.findFirst({
      // A user normally belongs to exactly one org. If they somehow belong to
      // several, prefer OWNER, then the most recently joined — deterministic.
      where: { userId, org: { status: 'ACTIVE' } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'desc' }],
    });
    if (!membership) return null;
    return { orgId: membership.orgId, role: membership.role };
  }

  /**
   * Like findMembership but throws when there is no active membership. This is
   * the function the OrgGuard uses to gate every partner endpoint.
   */
  async resolveOrgContext(userId: string): Promise<OrgContext> {
    const ctx = await this.findMembership(userId);
    if (!ctx) throw new ForbiddenException('No active organization membership');
    return ctx;
  }

  /** Ids of the venues owned by an org — the scope for every partner query. */
  async pitchIdsForOrg(orgId: string): Promise<string[]> {
    const pitches = await this.prisma.pitch.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    return pitches.map((p) => p.id);
  }

  /** Convenience: venues for the caller, scoped to their resolved org. */
  async pitchesForCaller(userId: string) {
    const { orgId } = await this.resolveOrgContext(userId);
    return this.prisma.pitch.findMany({ where: { organizationId: orgId } });
  }
}
