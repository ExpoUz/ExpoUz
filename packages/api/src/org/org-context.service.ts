import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrgRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface OrgContext {
  orgId: string;
  role: OrgRole;
}

/**
 * The scope the pitch-portal operates under. Either:
 *  - a real org membership (`legacy: false`), scoping by organizationId, or
 *  - a legacy owner with no membership yet (`legacy: true`), scoping by
 *    ownerId so existing owners keep working BEFORE the personal-org migration.
 * The `pitchWhere` fragment is the tenant boundary for every portal query.
 */
export interface PortalContext {
  legacy: boolean;
  orgId: string | null;
  role: OrgRole; // legacy owners are treated as OWNER of their own venues
  org: { id: string; name: string; logoUrl: string | null } | null;
  pitchWhere: Prisma.PitchWhereInput;
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

  /**
   * PART 3 overlay — venue-admin assignment.
   *
   * When a caller has any VenueAdminAssignment rows, their portal scope is
   * INTERSECTED with those pitch ids (still bounded by the base org/owner
   * boundary — assignments never expand access). With no rows, `base` is
   * returned unchanged (full org scope). Callers pass their already-resolved
   * base `pitchWhere`.
   */
  async applyAssignmentOverlay(
    userId: string,
    base: Prisma.PitchWhereInput,
  ): Promise<Prisma.PitchWhereInput> {
    const assignments = await this.prisma.venueAdminAssignment.findMany({
      where: { userId },
      select: { pitchId: true },
    });
    if (assignments.length === 0) return base;
    return { ...base, id: { in: assignments.map((a) => a.pitchId) } };
  }

  /** Convenience: venues for the caller, scoped to their resolved org. */
  async pitchesForCaller(userId: string) {
    const { orgId } = await this.resolveOrgContext(userId);
    return this.prisma.pitch.findMany({ where: { organizationId: orgId } });
  }

  /**
   * Resolve the pitch-portal scope for a caller. Distinguishes three cases:
   *  - member of an ACTIVE org  → org-scoped { organizationId }
   *  - member of a non-ACTIVE org (SUSPENDED/ARCHIVED) → locked out (throws)
   *  - no membership at all      → legacy owner, scoped by { ownerId }
   * This is what makes suspending an org lock its staff out immediately while
   * not breaking owners who haven't been migrated to a personal org yet.
   */
  async resolvePortalContext(userId: string): Promise<PortalContext> {
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId },
      include: { org: { select: { id: true, name: true, logoUrl: true, status: true } } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'desc' }],
    });

    if (memberships.length === 0) {
      // Legacy path: only genuine venue owners (own at least one pitch) get in.
      // A random user with no membership and no venues gets a clear no-access
      // state rather than an empty panel.
      const ownsVenue = await this.prisma.pitch.count({ where: { ownerId: userId } });
      if (ownsVenue === 0) {
        throw new ForbiddenException('You do not have access to a partner workspace');
      }
      return {
        legacy: true,
        orgId: null,
        role: 'OWNER',
        org: null,
        pitchWhere: await this.applyAssignmentOverlay(userId, { ownerId: userId }),
      };
    }

    const active = memberships.find((m) => m.org.status === 'ACTIVE');
    if (!active) {
      throw new ForbiddenException('Your organization is suspended');
    }

    return {
      legacy: false,
      orgId: active.orgId,
      role: active.role,
      org: { id: active.org.id, name: active.org.name, logoUrl: active.org.logoUrl },
      pitchWhere: await this.applyAssignmentOverlay(userId, { organizationId: active.orgId }),
    };
  }

  /**
   * Guard a single-venue action. Throws unless the pitch is inside the caller's
   * resolved portal scope — i.e. within their org AND (if they are assignment-
   * scoped) among their assigned venues. This is the ONLY authority for
   * "can this user manage this venue"; never trust a client-supplied id.
   */
  async assertCanManagePitch(userId: string, pitchId: string): Promise<void> {
    const { pitchWhere } = await this.resolvePortalContext(userId);
    const pitch = await this.prisma.pitch.findFirst({
      where: { id: pitchId, ...pitchWhere },
      select: { id: true },
    });
    if (!pitch) throw new ForbiddenException('Not assigned to this venue');
  }

  /** STAFF may only see the schedule + check-in — never revenue or CRM. */
  assertNotStaff(role: OrgRole, feature = 'this feature') {
    if (role === 'STAFF') {
      throw new ForbiddenException(`Your role cannot access ${feature}`);
    }
  }
}
