import {
  createTenantRequestSchema,
  type CreateTenantRequest,
  entitlementsSchema,
  type Entitlements,
  memberSchema,
  type Member,
  tenantSummarySchema,
  type TenantSummary,
} from '@app/shared';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import {
  type AuthContext,
  CurrentAuth,
  CurrentTenant,
  ReqId,
  type TenantContext,
} from '../common/http/request-context';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/http/zod';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { TenantScoped } from './tenant.guard';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly auth: AuthService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get()
  @ApiZodResponse(200, z.array(tenantSummarySchema))
  async list(@CurrentAuth() auth: AuthContext): Promise<TenantSummary[]> {
    return (await this.auth.me(auth.userId)).tenants;
  }

  @Post()
  @ApiZodBody(createTenantRequestSchema)
  @ApiZodResponse(201, tenantSummarySchema)
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(createTenantRequestSchema)) body: CreateTenantRequest,
    @ReqId() requestId: string | undefined,
  ): Promise<TenantSummary> {
    return this.tenants.create(auth.userId, body, requestId);
  }

  @Get(':tenantId/members')
  @TenantScoped()
  @ApiZodResponse(200, z.array(memberSchema))
  members(
    @Param('tenantId') _tenantId: string,
    @CurrentTenant() tenant: TenantContext,
  ): Promise<Member[]> {
    return this.tenants.members(tenant.tenantId);
  }

  @Get(':tenantId/entitlements')
  @TenantScoped()
  @ApiZodResponse(200, entitlementsSchema)
  entitlementsSummary(
    @Param('tenantId') _tenantId: string,
    @CurrentTenant() tenant: TenantContext,
  ): Promise<Entitlements> {
    return this.entitlements.summary(tenant.tenantId);
  }
}
