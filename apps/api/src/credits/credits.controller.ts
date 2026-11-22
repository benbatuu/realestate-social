import {
  creditAdjustmentRequestSchema,
  type CreditAdjustmentRequest,
  creditBalanceSchema,
  type CreditBalance,
  creditLedgerQuerySchema,
  type CreditLedgerQuery,
  creditLedgerResponseSchema,
  type CreditLedgerResponse,
} from '@app/shared';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type AuthContext,
  CurrentAuth,
  CurrentTenant,
  ReqId,
  type TenantContext,
} from '../common/http/request-context';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/http/zod';
import { TenantScoped } from '../tenants/tenant.guard';
import { CreditsService } from './credits.service';

@ApiTags('credits')
@Controller('credits')
@TenantScoped()
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get()
  @ApiZodResponse(200, creditBalanceSchema)
  balance(@CurrentTenant() tenant: TenantContext): Promise<CreditBalance> {
    return this.credits.balance(tenant.tenantId);
  }

  @Get('ledger')
  @TenantScoped('MANAGER')
  @ApiZodResponse(200, creditLedgerResponseSchema)
  ledger(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodPipe(creditLedgerQuerySchema)) query: CreditLedgerQuery,
  ): Promise<CreditLedgerResponse> {
    return this.credits.ledger(tenant.tenantId, query);
  }

  @Post('adjustments')
  @TenantScoped('OWNER')
  @ApiZodBody(creditAdjustmentRequestSchema)
  @ApiZodResponse(201, creditBalanceSchema)
  adjust(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(creditAdjustmentRequestSchema)) body: CreditAdjustmentRequest,
    @ReqId() requestId: string | undefined,
  ): Promise<CreditBalance> {
    return this.credits.adjust(tenant.tenantId, auth.userId, body, requestId);
  }
}
