import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../../entitlements/entitlements.module';
import { QUEUES } from '../../queues/queues';
import { LeadPilotService } from './leadpilot.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.crmSync }), EntitlementsModule],
  providers: [LeadPilotService],
  exports: [LeadPilotService],
})
export class LeadPilotModule {}
