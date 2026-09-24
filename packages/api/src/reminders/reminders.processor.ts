import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { RemindersService } from './reminders.service';
import { BookingsService } from '../bookings/bookings.service';

@Processor('reminders')
export class RemindersProcessor {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Process('cancellation-warning')
  async handleCancellationWarning(job: Job<{ matchId: string }>) {
    await this.remindersService.sendCancellationWarning(job.data.matchId);
  }

  // Step 5: auto-expire an unconfirmed booking after its 2h hold window.
  @Process('booking-expiry')
  async handleBookingExpiry(job: Job<{ bookingId: string }>) {
    await this.bookingsService.expireIfStale(job.data.bookingId);
  }
}
