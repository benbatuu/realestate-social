import {
  type ChangePlanRequest,
  changePlanRequestSchema,
  type SubscriptionView,
  subscriptionViewSchema,
} from '@app/shared';
import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentAuth,
  CurrentTenant,
  type AuthContext,
  type TenantContext,
  ReqId,
} from '../common/http/request-context';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/http/zod';
import { TenantScoped } from '../tenants/tenant.guard';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('billing')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get()
  @TenantScoped('MANAGER')
  @ApiZodResponse(200, subscriptionViewSchema)
  view(@CurrentTenant() tenant: TenantContext): Promise<SubscriptionView> {
    return this.subs.view(tenant.tenantId);
  }

  @Post('change')
  @TenantScoped('OWNER')
  @ApiZodBody(changePlanRequestSchema)
  @ApiZodResponse(201, subscriptionViewSchema)
  change(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(changePlanRequestSchema)) body: ChangePlanRequest,
    @ReqId() requestId: string | undefined,
  ): Promise<SubscriptionView> {
    return this.subs.change(tenant.tenantId, auth.userId, body.planCode, requestId);
  }

  @Delete('change')
  @TenantScoped('OWNER')
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @ReqId() requestId: string | undefined,
  ): Promise<SubscriptionView> {
    return this.subs.cancelPending(tenant.tenantId, auth.userId, requestId);
  }
}
