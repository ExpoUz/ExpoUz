import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Invite acceptance. An OrgInvite carries a secret `token` (the capability).
 * Any authenticated user holding a valid token can join — this is how an
 * invited MANAGER/STAFF who is otherwise a PLAYER gains partner-panel access.
 */
@Injectable()
export class OrgInviteService {
  constructor(private prisma: PrismaService) {}

  /** Preview an invite before accepting (org name + role), without joining. */
  async preview(token: string) {
    const invite = await this.prisma.orgInvite.findUnique({
      where: { token },
      include: { org: { select: { name: true, logoUrl: true, status: true } } },
    });
    if (!invite) return { valid: false as const, reason: 'not_found' };
    if (invite.acceptedAt) return { valid: false as const, reason: 'already_used' };
    if (invite.expiresAt < new Date()) return { valid: false as const, reason: 'expired' };
    if (invite.org.status !== 'ACTIVE') return { valid: false as const, reason: 'org_inactive' };
    return {
      valid: true as const,
      orgName: invite.org.name,
      orgLogoUrl: invite.org.logoUrl,
      role: invite.role,
    };
  }

  async accept(userId: string, token: string) {
    const invite = await this.prisma.orgInvite.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.acceptedAt) throw new BadRequestException('Invite already used');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite expired');

    const existing = await this.prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: invite.orgId, userId } },
    });

    // Mark the invite consumed regardless; create membership if not already there.
    await this.prisma.$transaction([
      this.prisma.orgInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
      ...(existing
        ? []
        : [
            this.prisma.orgMember.create({
              data: {
                orgId: invite.orgId,
                userId,
                role: invite.role,
                invitedBy: invite.createdById,
              },
            }),
          ]),
    ]);

    return { orgId: invite.orgId, role: existing?.role ?? invite.role };
  }
}
