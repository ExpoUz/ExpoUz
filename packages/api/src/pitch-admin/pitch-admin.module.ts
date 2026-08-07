import { Module } from '@nestjs/common';
import { PitchAdminService } from './pitch-admin.service';
import { PitchAdminController } from './pitch-admin.controller';
import { CrmController } from './crm.controller';
import { VenuePrivacyController } from './venue-privacy.controller';
import { CrmService } from './crm.service';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [MessagesModule],
  controllers: [PitchAdminController, CrmController, VenuePrivacyController],
  providers: [PitchAdminService, CrmService],
  exports: [PitchAdminService, CrmService],
})
export class PitchAdminModule {}
