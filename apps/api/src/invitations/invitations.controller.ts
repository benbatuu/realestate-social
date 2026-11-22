import {
  createInvitationRequestSchema,
  type CreateInvitationRequest,
  createInvitationResponseSchema,
  type CreateInvitationResponse,
  invitationPreviewSchema,
  type InvitationPreview,
  invitationSchema,
  type Invitation,
  invitationTokenRequestSchema,
  tenantSummarySchema,
  type TenantSummary,
} from '@app/shared';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '../auth/public.decorator';
import {
  type AuthContext,
  CurrentAuth,
  CurrentTenant,
  ReqId,
  type TenantContext,
} from '../common/http/request-context';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/http/zod';
import { UuidParam } from '../common/http/uuid-param';
import { TenantScoped } from '../tenants/tenant.guard';
import { InvitationsService } from './invitations.service';

type TokenBody = z.infer<typeof invitationTokenRequestSchema>;

@ApiTags('invitations')
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('tenants/:tenantId/invitations')
  @TenantScoped('ADMIN')
  @ApiZodBody(createInvitationRequestSchema)
  @ApiZodResponse(201, createInvitationResponseSchema)
  create(
    @Param('tenantId') _tenantId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(createInvitationRequestSchema)) body: CreateInvitationRequest,
    @ReqId() requestId: string | undefined,
  ): Promise<CreateInvitationResponse> {
    return this.invitations.create(tenant, auth.userId, body, requestId);
  }

  @Get('tenants/:tenantId/invitations')
  @TenantScoped('ADMIN')
  @ApiZodResponse(200, z.array(invitationSchema))
  list(
    @Param('tenantId') _tenantId: string,
    @CurrentTenant() tenant: TenantContext,
  ): Promise<Invitation[]> {
    return this.invitations.listPending(tenant.tenantId);
  }

  /** Public so a not-yet-registered invitee can see what they are joining. */
  @Public()
  @Post('invitations/preview')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(invitationTokenRequestSchema)
  @ApiZodResponse(200, invitationPreviewSchema)
  preview(
    @Body(new ZodPipe(invitationTokenRequestSchema)) body: TokenBody,
  ): Promise<InvitationPreview> {
    return this.invitations.preview(body.token);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(invitationTokenRequestSchema)
  @ApiZodResponse(200, tenantSummarySchema)
  accept(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(invitationTokenRequestSchema)) body: TokenBody,
    @ReqId() requestId: string | undefined,
  ): Promise<TenantSummary> {
    return this.invitations.accept(auth.userId, body.token, requestId);
  }

  @Delete('tenants/:tenantId/invitations/:invitationId')
  @TenantScoped('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('invitationId', UuidParam) invitationId: string,
    @ReqId() requestId: string | undefined,
  ): Promise<void> {
    await this.invitations.revoke(tenant.tenantId, auth.userId, invitationId, requestId);
  }
}
