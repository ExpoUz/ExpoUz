import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface SlotQuery {
  sport: string;
  city?: string;
  district?: string;
  date: string; // YYYY-MM-DD
  from?: string; // "18:00"
  to?: string; // "22:00"
  duration?: number; // desired minutes
}

type DayHours = { open: string; close: string };
type OpeningHours = Partial<Record<string, DayHours>>;

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// Matches that occupy a court (so they block a free slot) — anything not cancelled.
const OCCUPYING = ['DRAFT', 'PUBLISHED', 'OPEN', 'FULL', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
// Matches a player can still join.
const JOINABLE = ['PUBLISHED', 'OPEN', 'CONFIRMED'];

@Injectable()
export class AvailabilityService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ─── time helpers ──────────────────────────────────────────────────────────

  /** Minutes since local midnight for "HH:MM". "00:00" as a close = end of day. */
  private toMin(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** A local Date for `date` (YYYY-MM-DD) at `minutes` past midnight. */
  private dateAt(date: string, minutes: number): Date {
    const [y, mo, d] = date.split('-').map(Number);
    return new Date(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
  }

  private startOfDay(date: string): Date {
    const [y, mo, d] = date.split('-').map(Number);
    return new Date(y, mo - 1, d, 0, 0, 0, 0);
  }

  private endOfDay(date: string): Date {
    const [y, mo, d] = date.split('-').map(Number);
    return new Date(y, mo - 1, d, 23, 59, 59, 999);
  }

  /** Window bounds in minutes-of-day; defaults to the whole day. */
  private windowMin(q: SlotQuery): { fromMin: number; toMin: number } {
    const fromMin = q.from ? this.toMin(q.from) : 0;
    let toMin = q.to ? this.toMin(q.to) : 24 * 60;
    if (toMin === 0) toMin = 24 * 60; // "00:00" upper bound = end of day
    return { fromMin, toMin };
  }

  private hoursForDate(openingHours: OpeningHours | null, date: string): DayHours | null {
    if (!openingHours) return null;
    const [y, mo, d] = date.split('-').map(Number);
    const key = DOW[new Date(y, mo - 1, d).getDay()];
    const h = openingHours[key];
    if (!h || !h.open || !h.close) return null;
    return h;
  }

  /** All slot start-minutes the venue is open on this date. */
  private generateSlots(hours: DayHours, slotDuration: number): number[] {
    const open = this.toMin(hours.open);
    let close = this.toMin(hours.close);
    if (close <= open) close += 24 * 60; // past-midnight close (e.g. 00:00 → 24:00)
    const out: number[] = [];
    for (let t = open; t + slotDuration <= close; t += slotDuration) out.push(t);
    return out;
  }

  /** Does [slotStart, slotStart+dur) overlap a booking? Both in minutes-of-day. */
  private overlaps(slotStart: number, slotDur: number, bStart: number, bDur: number): boolean {
    return slotStart < bStart + bDur && bStart < slotStart + slotDur;
  }

  // ─── 1) games joinable in the window ─────────────────────────────────────────

  async getJoinableInWindow(q: SlotQuery) {
    const { fromMin, toMin } = this.windowMin(q);
    const start = this.dateAt(q.date, fromMin);
    const end = this.dateAt(q.date, toMin);

    const matches = await this.prisma.match.findMany({
      where: {
        sport: q.sport as any,
        status: { in: JOINABLE as any },
        startTime: { gte: start, lt: end },
        ...(q.city ? { pitch: { city: q.city } } : {}),
        ...(q.district ? { pitch: { district: q.district } } : {}),
      },
      include: {
        pitch: { select: { id: true, name: true, district: true, city: true, photos: true, lat: true, lng: true } },
        host: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        _count: {
          select: { bookings: { where: { status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } } } },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // Real open spots only — counted from bookings, never the cached field.
    return matches.filter((m) => m._count.bookings < m.maxPlayers);
  }

  // ─── 2) free courts in the window ────────────────────────────────────────────

  async getFreeSlots(q: SlotQuery) {
    const duration = q.duration ?? 60;
    const pitches = await this.prisma.pitch.findMany({
      where: {
        sport: q.sport as any,
        isActive: true,
        isVerified: true,
        ...(q.city ? { city: q.city } : {}),
        ...(q.district ? { district: q.district } : {}),
      },
      select: {
        id: true, name: true, district: true, city: true, photos: true, lat: true, lng: true,
        hourlyRate: true, openingHours: true, slotDuration: true, courtCount: true,
      },
    });
    if (pitches.length === 0) return [];

    const booked = await this.prisma.match.findMany({
      where: {
        pitchId: { in: pitches.map((p) => p.id) },
        status: { in: OCCUPYING as any },
        startTime: { gte: this.startOfDay(q.date), lt: this.endOfDay(q.date) },
      },
      select: { pitchId: true, startTime: true, durationMinutes: true },
    });

    const { fromMin, toMin } = this.windowMin(q);

    const results = pitches.map((pitch) => {
      const hours = this.hoursForDate(pitch.openingHours as OpeningHours | null, q.date);
      if (!hours) return null; // no hours / closed → never "free" (absence ≠ availability)

      const slotLen = Math.max(pitch.slotDuration || 60, duration);
      const allSlots = this.generateSlots(hours, pitch.slotDuration || 60);
      const pitchBookings = booked
        .filter((b) => b.pitchId === pitch.id)
        .map((b) => ({ start: b.startTime.getHours() * 60 + b.startTime.getMinutes(), dur: b.durationMinutes || 60 }));

      const free = allSlots.filter((slot) => {
        if (slot < fromMin || slot + duration > toMin) return false;
        const overlapping = pitchBookings.filter((b) => this.overlaps(slot, slotLen, b.start, b.dur)).length;
        return overlapping < (pitch.courtCount || 1);
      });

      if (free.length === 0) return null;
      return {
        pitch: {
          id: pitch.id, name: pitch.name, district: pitch.district, city: pitch.city,
          photo: pitch.photos?.[0] ?? null, lat: pitch.lat, lng: pitch.lng,
          hourlyRate: Number(pitch.hourlyRate),
        },
        slots: free.map((m) => this.fmt(m)),
      };
    });

    return results.filter(Boolean);
  }

  private fmt(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ─── slot chip counts (ONE query, not per-chip) ──────────────────────────────

  /**
   * For a strip of hourly slots on a date, return per-slot: joinable game count
   * and whether any verified venue is free then. Powers the sheet's slot chips.
   */
  async getSlotCounts(q: SlotQuery & { slots?: string[] }) {
    const cacheKey = `avail:counts:${q.sport}:${q.city ?? ''}:${q.district ?? ''}:${q.date}`;
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached);

    // Default strip: hourly 06:00–23:00.
    const slotMins = (q.slots?.length ? q.slots.map((s) => this.toMin(s)) : range(6 * 60, 23 * 60, 60));

    const dayStart = this.startOfDay(q.date);
    const dayEnd = this.endOfDay(q.date);

    const [matches, pitches] = await Promise.all([
      this.prisma.match.findMany({
        where: {
          sport: q.sport as any,
          status: { in: JOINABLE as any },
          startTime: { gte: dayStart, lt: dayEnd },
          ...(q.city ? { pitch: { city: q.city } } : {}),
          ...(q.district ? { pitch: { district: q.district } } : {}),
        },
        select: {
          startTime: true, maxPlayers: true,
          _count: { select: { bookings: { where: { status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } } } } },
        },
      }),
      this.prisma.pitch.findMany({
        where: {
          sport: q.sport as any, isActive: true, isVerified: true,
          ...(q.city ? { city: q.city } : {}),
          ...(q.district ? { district: q.district } : {}),
        },
        select: { openingHours: true, slotDuration: true, courtCount: true, id: true },
      }),
    ]);

    const joinable = matches.filter((m) => m._count.bookings < m.maxPlayers);
    const anyHours = pitches.some((p) => this.hoursForDate(p.openingHours as OpeningHours | null, q.date));

    // Booked matches per pitch for the free calc (occupying statuses).
    const occupying = await this.prisma.match.findMany({
      where: {
        pitchId: { in: pitches.map((p) => p.id) },
        status: { in: OCCUPYING as any },
        startTime: { gte: dayStart, lt: dayEnd },
      },
      select: { pitchId: true, startTime: true, durationMinutes: true },
    });

    const chips = slotMins.map((slot) => {
      const games = joinable.filter((m) => {
        const mm = m.startTime.getHours() * 60 + m.startTime.getMinutes();
        return mm >= slot && mm < slot + 60;
      }).length;

      let free = false;
      for (const p of pitches) {
        const hours = this.hoursForDate(p.openingHours as OpeningHours | null, q.date);
        if (!hours) continue;
        const slots = this.generateSlots(hours, p.slotDuration || 60);
        if (!slots.includes(slot)) continue;
        const bookings = occupying
          .filter((b) => b.pitchId === p.id)
          .map((b) => ({ start: b.startTime.getHours() * 60 + b.startTime.getMinutes(), dur: b.durationMinutes || 60 }));
        const overlapping = bookings.filter((b) => this.overlaps(slot, p.slotDuration || 60, b.start, b.dur)).length;
        if (overlapping < (p.courtCount || 1)) { free = true; break; }
      }

      return { slot: this.fmt(slot), games, free };
    });

    const result = { chips, freeCourtsAvailable: anyHours };
    await this.redis.set(cacheKey, JSON.stringify(result), 60).catch(() => {});
    return result;
  }

  /** Invalidate the cached counts for a venue's city (call on match create/cancel). */
  async invalidateForCity(sport: string, city: string | null, date: string) {
    if (!city) return;
    await this.redis.del(`avail:counts:${sport}::${date}`).catch(() => {});
    await this.redis.del(`avail:counts:${sport}:${city}::${date}`).catch(() => {});
  }
}

function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i += step) out.push(i);
  return out;
}
