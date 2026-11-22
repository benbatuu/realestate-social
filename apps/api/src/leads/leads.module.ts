import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { LeadPilotModule } from '../integrations/leadpilot/leadpilot.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [TenantsModule, LeadPilotModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
