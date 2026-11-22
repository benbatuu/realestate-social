import {
  auditLogQuerySchema,
  auditLogResponseSchema,
  dashboardStatsSchema,
  tenantDetailSchema,
  tenantProfileSchema,
  type AuditLogQuery,
  type TenantProfileUpdate,
  createTenantRequestSchema,
  updateMemberRoleRequestSchema,
  updateMemberStatusRequestSchema,
  type UpdateMemberStatusRequest,
  type UpdateMemberRoleRequest,
  type CreateTenantRequest,
  entitlementsSchema,
  type Entitlements,
  memberSchema,
  type Member,
  tenantSummarySchema,
  type TenantSummary,
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
  Query,
} from '@nestjs/common';
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
import { UuidParam } from '../common/http/uuid-param';
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

  @Patch(':tenantId/members/:membershipId')
  @TenantScoped('ADMIN')
  @ApiZodBody(updateMemberRoleRequestSchema)
  async changeRole(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('membershipId', UuidParam) membershipId: string,
    @Body(new ZodPipe(updateMemberRoleRequestSchema)) body: UpdateMemberRoleRequest,
    @ReqId() requestId: string | undefined,
  ): Promise<void> {
    await this.tenants.changeRole(
      tenant.tenantId,
      { userId: auth.userId, role: tenant.role },
      membershipId,
      body.role,
      requestId,
    );
  }

  @Patch(':tenantId/members/:membershipId/status')
  @TenantScoped('ADMIN')
  @ApiZodBody(updateMemberStatusRequestSchema)
  async setStatus(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('membershipId', UuidParam) membershipId: string,
    @Body(new ZodPipe(updateMemberStatusRequestSchema)) body: UpdateMemberStatusRequest,
    @ReqId() requestId: string | undefined,
  ): Promise<void> {
    await this.tenants.setStatus(
      tenant.tenantId,
      { userId: auth.userId, role: tenant.role },
      membershipId,
      body.status,
      requestId,
    );
  }

  @Delete(':tenantId/members/:membershipId')
  @TenantScoped('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('membershipId', UuidParam) membershipId: string,
    @ReqId() requestId: string | undefined,
  ): Promise<void> {
    await this.tenants.remove(
      tenant.tenantId,
      { userId: auth.userId, role: tenant.role },
      membershipId,
      requestId,
    );
  }

  @Get(':tenantId')
  @TenantScoped()
  @ApiZodResponse(200, tenantDetailSchema)
  detail(@CurrentTenant() tenant: TenantContext) {
    return this.tenants.detail(tenant.tenantId);
  }

  @Patch(':tenantId')
  @TenantScoped('ADMIN')
  @ApiZodBody(tenantProfileSchema)
  @ApiZodResponse(200, tenantDetailSchema)
  updateProfile(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(tenantProfileSchema)) body: TenantProfileUpdate,
    @ReqId() requestId: string | undefined,
  ) {
    return this.tenants.updateProfile(tenant.tenantId, auth.userId, body, requestId);
  }

  @Get(':tenantId/stats')
  @TenantScoped()
  @ApiZodResponse(200, dashboardStatsSchema)
  stats(@CurrentTenant() tenant: TenantContext) {
    return this.tenants.stats(tenant.tenantId);
  }

  @Get(':tenantId/audit')
  @TenantScoped('ADMIN')
  @ApiZodResponse(200, auditLogResponseSchema)
  audit(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodPipe(auditLogQuerySchema)) query: AuditLogQuery,
  ) {
    return this.tenants.auditLog(tenant.tenantId, query);
  }
}
