import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlatformSettings {
  commissionRate: number;
  platformFeeRate: number;
  cancellationFeeRate: number;
  cancellationWindowHours: number;
}

const DEFAULTS: PlatformSettings = {
  commissionRate: 0.1,
  platformFeeRate: 0.05,
  cancellationFeeRate: 0.5,
  cancellationWindowHours: 5,
};

/**
 * Single source of truth for platform money settings (commission, platform fee,
 * cancellation window/fee). The Super Admin edits the AppSettings singleton;
 * ALL booking/refund math reads it through here — no panel hardcodes a rate.
 * Cached in-process for 30s so hot paths don't hit the DB every time.
 */
@Injectable()
export class SettingsService {
  private cache: { at: number; value: PlatformSettings } | null = null;
  private readonly ttlMs = 30_000;

  constructor(private prisma: PrismaService) {}

  async get(): Promise<PlatformSettings> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) return this.cache.value;
    try {
      const row = await this.prisma.appSettings.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton' },
      });
      const value: PlatformSettings = {
        commissionRate: row.commissionRate ?? DEFAULTS.commissionRate,
        platformFeeRate: row.platformFeeRate ?? DEFAULTS.platformFeeRate,
        cancellationFeeRate: row.cancellationFeeRate ?? DEFAULTS.cancellationFeeRate,
        cancellationWindowHours: row.cancellationWindowHours ?? DEFAULTS.cancellationWindowHours,
      };
      this.cache = { at: Date.now(), value };
      return value;
    } catch {
      // Never block a booking on a settings read — fall back to defaults.
      return DEFAULTS;
    }
  }

  /** Call after an admin updates settings so the next read is fresh. */
  invalidate() {
    this.cache = null;
  }
}
