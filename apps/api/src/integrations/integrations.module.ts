import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { TenantsModule } from '../tenants/tenants.module';
import { IntegrationsController } from './integrations.controller';
import { LeadPilotModule } from './leadpilot/leadpilot.module';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [TenantsModule, EntitlementsModule, LeadPilotModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
})
export class IntegrationsModule {}
