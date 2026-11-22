import {
  type IntegrationConnectRequest,
  type IntegrationConnectResult,
  integrationConnectRequestSchema,
  type IntegrationsResponse,
  integrationsResponseSchema,
} from '@app/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UuidParam } from '../common/http/uuid-param';
import {
  CurrentAuth,
  CurrentTenant,
  type AuthContext,
  type TenantContext,
} from '../common/http/request-context';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/http/zod';
import { TenantScoped } from '../tenants/tenant.guard';
import { IntegrationsService } from './integrations.service';
import { z } from 'zod';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  @TenantScoped()
  @ApiZodResponse(200, integrationsResponseSchema)
  list(@CurrentTenant() tenant: TenantContext): Promise<IntegrationsResponse> {
    return this.integrations.list(tenant.tenantId);
  }

  @Post('connections')
  @TenantScoped('MANAGER')
  @ApiZodBody(integrationConnectRequestSchema)
  connect(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(integrationConnectRequestSchema)) body: IntegrationConnectRequest,
  ): Promise<IntegrationConnectResult> {
    return this.integrations.connect(tenant.tenantId, auth.userId, body);
  }

  @Delete('connections/:id')
  @TenantScoped('MANAGER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
  ): Promise<void> {
    await this.integrations.remove(tenant.tenantId, id);
  }

  @Post('connections/:id/sync')
  @TenantScoped('MANAGER')
  @HttpCode(HttpStatus.ACCEPTED)
  async sync(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
  ): Promise<void> {
    await this.integrations.requestSync(tenant.tenantId, id);
  }

  @Patch('connections/:id')
  @TenantScoped('MANAGER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setEnabled(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
    @Body(new ZodPipe(z.object({ enabled: z.boolean() }))) body: { enabled: boolean },
  ): Promise<void> {
    await this.integrations.disable(tenant.tenantId, id, body.enabled);
  }
}
