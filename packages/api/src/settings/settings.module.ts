import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';

// Global so any money path (matches, bookings, admin) can read the single
// source of truth without repeated imports.
@Global()
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
