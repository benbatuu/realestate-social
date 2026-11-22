import {
  type AnalyticsLatest,
  analyticsLatestSchema,
  type AnalyticsQuery,
  analyticsQuerySchema,
  type AnalyticsSnapshotStatus,
  analyticsSnapshotStatusSchema,
} from '@app/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentTenant, type TenantContext } from '../common/http/request-context';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/http/zod';
import { TenantScoped } from '../tenants/tenant.guard';
import { AnalyticsService } from './analytics.service';

const runRequestSchema = z.object({ days: analyticsQuerySchema.shape.days });

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Newest finished result plus the newest run's status. Never waits for a calculation. */
  @Get('properties')
  @TenantScoped()
  @ApiZodResponse(200, analyticsLatestSchema)
  latest(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodPipe(analyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<AnalyticsLatest> {
    return this.analytics.latest(tenant.tenantId, query.days);
  }

  /** Starts a background run. Returns at once; a run already in progress is returned as is. */
  @Post('runs')
  @TenantScoped('MEMBER')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiZodBody(runRequestSchema)
  @ApiZodResponse(202, analyticsSnapshotStatusSchema)
  start(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodPipe(runRequestSchema)) body: { days: number },
  ): Promise<AnalyticsSnapshotStatus> {
    return this.analytics.start(tenant.tenantId, body.days);
  }
}
