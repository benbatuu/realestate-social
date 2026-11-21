import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationsController } from '../invitations/invitations.controller';
import { InvitationsService } from '../invitations/invitations.service';
import { TenantGuard } from './tenant.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantsController, InvitationsController],
  providers: [TenantsService, InvitationsService, TenantGuard],
  exports: [TenantGuard],
})
export class TenantsModule {}
