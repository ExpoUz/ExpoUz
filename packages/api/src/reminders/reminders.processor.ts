import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { RemindersService } from './reminders.service';

@Processor('reminders')
export class RemindersProcessor {
  constructor(private readonly remindersService: RemindersService) {}

  @Process('cancellation-warning')
  async handleCancellationWarning(job: Job<{ matchId: string }>) {
    await this.remindersService.sendCancellationWarning(job.data.matchId);
  }
}
