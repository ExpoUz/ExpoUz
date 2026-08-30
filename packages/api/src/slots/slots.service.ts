import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SlotStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgContextService } from '../org/org-context.service';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; // JS getDay() order
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

type DayHours = { open: string; close: string };

/** Parse the venue openingHours JSON into a {mon:{open,close},...} map. */
function parseOpeningHours(input: any): Record<string, DayHours> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, DayHours> = {};
  for (const day of DAYS) {
    const h = input[day];
    if (h && typeof h.open === 'string' && typeof h.close === 'string' && HHMM.test(h.open) && HHMM.test(h.close)) {
      out[day] = { open: h.open, close: h.close };
    }
  }
  return out;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * PART 6 — slot lifecycle.
 *
 * Admin operations are scoped server-side via OrgContextService.assertCanManagePitch
 * (org boundary + venue-admin assignment overlay). Users never set prices; they
 * read AVAILABLE slots and book into them via the matches flow.
 */
@Injectable()
export class SlotsService {
  constructor(
    private prisma: PrismaService,
    private orgContext: OrgContextService,
  ) {}

  // ─────────────────────────── ADMIN ───────────────────────────

  /**
   * Generate AVAILABLE slots for a date range from the venue's opening hours,
   * one per court per time block, at the default price. Never generates a slot
   * in the past; the unique (pitchId, courtNumber, startTime) constraint plus
   * skipDuplicates guarantees no overlaps with existing slots.
   */
  async generate(
    userId: string,
    pitchId: string,
    dto: { from: string; to: string; price?: number },
  ) {
    await this.orgContext.assertCanManagePitch(userId, pitchId);
    const pitch = await this.prisma.pitch.findUniqueOrThrow({ where: { id: pitchId } });

    const hours = parseOpeningHours(pitch.openingHours);
    if (Object.keys(hours).length === 0) {
      throw new BadRequestException('Set opening hours before generating slots');
    }
    const duration = pitch.slotDuration || 60;
    const courts = Math.max(1, pitch.courtCount || 1);
    const price = dto.price ?? Number(pitch.defaultPrice ?? 0);
    if (!price || price <= 0) {
      throw new BadRequestException('Set a default price (or pass one) before generating slots');
    }

    const from = new Date(dto.from);
    const to = new Date(dto.to);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
      throw new BadRequestException('Invalid date range');
    }
    // Guard against runaway generation.
    const dayCount = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    if (dayCount > 90) throw new BadRequestException('Generate at most 90 days at a time');

    const now = new Date();
    const data: Prisma.SlotCreateManyInput[] = [];

    for (let d = 0; d < dayCount; d++) {
      const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + d);
      const h = hours[DAYS[day.getDay()]];
      if (!h) continue; // closed that day
      const open = minutesOf(h.open);
      const close = minutesOf(h.close);
      for (let t = open; t + duration <= close; t += duration) {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
        start.setMinutes(t);
        if (start <= now) continue; // never generate slots in the past
        const end = new Date(start.getTime() + duration * 60000);
        for (let court = 1; court <= courts; court++) {
          data.push({
            pitchId,
            startTime: start,
            endTime: end,
            price: new Prisma.Decimal(price),
            courtNumber: court,
            createdById: userId,
          });
        }
      }
    }

    if (data.length === 0) {
      return { created: 0, message: 'No slots to create in that range (past or closed days).' };
    }
    const res = await this.prisma.slot.createMany({ data, skipDuplicates: true });
    return { created: res.count, requested: data.length };
  }

  /** Grid data for the admin slot manager. */
  async listForPitch(userId: string, pitchId: string, from: string, to: string) {
    await this.orgContext.assertCanManagePitch(userId, pitchId);
    return this.prisma.slot.findMany({
      where: {
        pitchId,
        startTime: { gte: new Date(from), lte: new Date(to) },
      },
      include: {
        match: {
          select: {
            id: true,
            title: true,
            currentPlayers: true,
            maxPlayers: true,
            host: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ startTime: 'asc' }, { courtNumber: 'asc' }],
    });
  }

  private async loadManageableSlot(userId: string, slotId: string) {
    const slot = await this.prisma.slot.findUnique({ where: { id: slotId } });
    if (!slot) throw new NotFoundException('Slot not found');
    await this.orgContext.assertCanManagePitch(userId, slot.pitchId);
    return slot;
  }

  /** Edit a slot's price, or block/unblock it. BOOKED slots cannot be edited here. */
  async updateSlot(
    userId: string,
    slotId: string,
    dto: { price?: number; status?: 'AVAILABLE' | 'BLOCKED'; blockReason?: string },
  ) {
    const slot = await this.loadManageableSlot(userId, slotId);
    if (slot.status === 'BOOKED') {
      throw new ConflictException(
        'This slot is booked. Cancel the match before editing or blocking it.',
      );
    }

    const data: Prisma.SlotUpdateInput = {};
    if (dto.price !== undefined) {
      if (dto.price <= 0) throw new BadRequestException('Price must be positive');
      data.price = new Prisma.Decimal(dto.price);
    }
    if (dto.status !== undefined) {
      if (dto.status !== 'AVAILABLE' && dto.status !== 'BLOCKED') {
        throw new BadRequestException('Admins can only set AVAILABLE or BLOCKED');
      }
      data.status = dto.status;
      data.blockReason = dto.status === 'BLOCKED' ? (dto.blockReason ?? null) : null;
    }
    if (Object.keys(data).length === 0) return slot;

    const updated = await this.prisma.slot.update({ where: { id: slotId }, data });
    await this.audit(userId, 'SLOT_UPDATED', slot.pitchId, slotId, { before: { price: slot.price, status: slot.status }, after: dto });
    return updated;
  }

  /** Bulk price change / block-unblock across many slots (skips BOOKED). */
  async bulkUpdate(
    userId: string,
    dto: { slotIds: string[]; price?: number; status?: 'AVAILABLE' | 'BLOCKED'; blockReason?: string },
  ) {
    if (!dto.slotIds?.length) throw new BadRequestException('No slots selected');
    const slots = await this.prisma.slot.findMany({ where: { id: { in: dto.slotIds } } });
    const pitchIds = [...new Set(slots.map((s) => s.pitchId))];
    for (const pid of pitchIds) await this.orgContext.assertCanManagePitch(userId, pid);

    const editable = slots.filter((s) => s.status !== 'BOOKED').map((s) => s.id);
    const data: Prisma.SlotUpdateManyMutationInput = {};
    if (dto.price !== undefined) {
      if (dto.price <= 0) throw new BadRequestException('Price must be positive');
      data.price = new Prisma.Decimal(dto.price);
    }
    if (dto.status !== undefined) {
      if (dto.status !== 'AVAILABLE' && dto.status !== 'BLOCKED') {
        throw new BadRequestException('Admins can only set AVAILABLE or BLOCKED');
      }
      data.status = dto.status;
      data.blockReason = dto.status === 'BLOCKED' ? (dto.blockReason ?? null) : null;
    }
    const res = await this.prisma.slot.updateMany({ where: { id: { in: editable } }, data });
    await this.audit(userId, 'SLOT_BULK_UPDATED', pitchIds[0] ?? null, null, {
      count: res.count,
      skippedBooked: slots.length - editable.length,
      change: dto,
    });
    return { updated: res.count, skippedBooked: slots.length - editable.length };
  }

  /** Delete a single slot — only when AVAILABLE or BLOCKED (never BOOKED). */
  async deleteSlot(userId: string, slotId: string) {
    const slot = await this.loadManageableSlot(userId, slotId);
    if (slot.status === 'BOOKED') {
      throw new ConflictException('A booked slot cannot be deleted. Cancel the match first.');
    }
    await this.prisma.slot.delete({ where: { id: slotId } });
    await this.audit(userId, 'SLOT_DELETED', slot.pitchId, slotId, { startTime: slot.startTime });
    return { success: true };
  }

  /** Bulk-delete unbooked slots in a date range. */
  async bulkDelete(userId: string, pitchId: string, from: string, to: string) {
    await this.orgContext.assertCanManagePitch(userId, pitchId);
    const res = await this.prisma.slot.deleteMany({
      where: {
        pitchId,
        startTime: { gte: new Date(from), lte: new Date(to) },
        status: { in: ['AVAILABLE', 'BLOCKED'] },
      },
    });
    await this.audit(userId, 'SLOT_BULK_DELETED', pitchId, null, { count: res.count, from, to });
    return { deleted: res.count };
  }

  // ─────────────────────────── PUBLIC (users) ───────────────────────────

  /**
   * AVAILABLE, future slots for the create-match picker and empty-state
   * suggestions. Grouped by venue for the UI.
   */
  async available(filters: {
    pitchId?: string;
    sport?: string;
    city?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const now = new Date();
    const where: Prisma.SlotWhereInput = {
      status: 'AVAILABLE',
      startTime: { gt: filters.from ? new Date(filters.from) : now },
      pitch: { isActive: true },
    };
    if (filters.to) (where.startTime as any).lte = new Date(filters.to);
    if (filters.pitchId) where.pitchId = filters.pitchId;
    if (filters.sport || filters.city) {
      where.pitch = {
        isActive: true,
        ...(filters.sport ? { sport: filters.sport as any } : {}),
        ...(filters.city ? { city: filters.city } : {}),
      };
    }

    const slots = await this.prisma.slot.findMany({
      where,
      include: {
        pitch: {
          select: { id: true, name: true, city: true, district: true, sport: true, photos: true },
        },
      },
      orderBy: [{ startTime: 'asc' }, { price: 'asc' }],
      take: filters.limit ?? 200,
    });

    // Group by venue for the picker.
    const byVenue = new Map<string, any>();
    for (const s of slots) {
      const key = s.pitchId;
      if (!byVenue.has(key)) {
        byVenue.set(key, { pitch: s.pitch, slots: [] });
      }
      byVenue.get(key).slots.push({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        price: s.price,
        courtNumber: s.courtNumber,
      });
    }
    return Array.from(byVenue.values());
  }

  // ─────────────────────────── HOUSEKEEPING ───────────────────────────

  /**
   * Roll the window forward: mark AVAILABLE/BLOCKED slots whose start time has
   * passed as PAST. Intended for a nightly job; also safe to call ad hoc.
   * (Reads already filter on startTime > now, so this is bookkeeping.)
   */
  async markPastSlots() {
    const res = await this.prisma.slot.updateMany({
      where: { startTime: { lt: new Date() }, status: { in: ['AVAILABLE', 'BLOCKED'] } },
      data: { status: 'PAST' },
    });
    return { updated: res.count };
  }

  private async audit(
    userId: string,
    action: string,
    pitchId: string | null,
    slotId: string | null,
    meta: any,
  ) {
    await this.prisma.activityLog
      .create({
        data: {
          userId,
          actorType: 'ORG_STAFF',
          action,
          entityType: slotId ? 'Slot' : 'Pitch',
          entityId: slotId ?? pitchId ?? undefined,
          meta,
        },
      })
      .catch(() => {});
  }
}
