import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityCategory, ActorType, Prisma } from '@prisma/client';

/**
 * User-facing activity logging, persisted to the shared ActivityLog table.
 * `action` keeps backward-compat with the admin audit trail (free string),
 * while `category` gives a typed classification for user history feeds.
 */
@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async log(
    userId: string,
    category: ActivityCategory,
    description: string,
    meta?: Record<string, any>,
    ipAddress?: string,
    // Optional attribution (PART 4). Player activity is the default; pass
    // ORG_STAFF/SYSTEM and an orgId/target for partner and system events.
    opts?: {
      actorType?: ActorType;
      orgId?: string | null;
      entityType?: string;
      entityId?: string;
    },
  ) {
    try {
      return await this.prisma.activityLog.create({
        data: {
          userId,
          actorType: opts?.actorType ?? 'PLAYER',
          orgId: opts?.orgId ?? undefined,
          action: category,
          category,
          description,
          entityType: opts?.entityType,
          entityId: opts?.entityId,
          meta: (meta as Prisma.InputJsonValue) ?? undefined,
          ipAddress,
        },
      });
    } catch {
      // Activity logging must never break the primary flow.
      return null;
    }
  }

  /**
   * Log a SYSTEM event (escrow release, refund processed, job failure, webhook
   * error) — no human actor. Best-effort; never throws.
   */
  async logSystem(
    action: string,
    description: string,
    opts?: { orgId?: string | null; entityType?: string; entityId?: string; meta?: Record<string, any> },
  ) {
    try {
      return await this.prisma.activityLog.create({
        data: {
          userId: null,
          actorType: 'SYSTEM',
          orgId: opts?.orgId ?? undefined,
          action,
          description,
          entityType: opts?.entityType,
          entityId: opts?.entityId,
          meta: (opts?.meta as Prisma.InputJsonValue) ?? undefined,
        },
      });
    } catch {
      return null;
    }
  }

  async getUserHistory(userId: string, limit = 50, offset = 0) {
    const [activities, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.activityLog.count({ where: { userId } }),
    ]);
    return { activities, total, limit, offset };
  }

  async getAllActivity(filters: {
    category?: ActivityCategory;
    userId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.ActivityLogWhereInput = {};
    if (filters.category) where.category = filters.category;
    if (filters.userId) where.userId = filters.userId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    const [activities, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 100,
        skip: filters.offset ?? 0,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              phone: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { activities, total };
  }
}
