import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { EscrowService } from './escrow.service';

@Processor('escrow')
export class EscrowProcessor {
  constructor(private readonly escrowService: EscrowService) {}

  @Process('release-escrow')
  async handleReleaseEscrow(job: Job<{ transactionId: string }>) {
    await this.escrowService.releaseEscrow(job.data.transactionId);
  }
}
