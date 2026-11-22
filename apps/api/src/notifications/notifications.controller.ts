import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { type NotificationPreference, updateNotificationPreferenceSchema } from '@app/shared';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CurrentAuth,
  CurrentTenant,
  type AuthContext,
  type TenantContext,
} from '../common/http/request-context';
import { UuidParam } from '../common/http/uuid-param';
import { ZodPipe } from '../common/http/zod';
import { TenantScoped, ViewerWritable } from '../tenants/tenant.guard';
import { NotificationsService } from './notifications.service';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(25),
  q: z.string().trim().max(100).optional(),
  read: z.enum(['all', 'unread', 'read']).default('all'),
  kind: z.string().max(100).optional(),
});

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @TenantScoped()
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodPipe(listQuery)) query: z.infer<typeof listQuery>,
  ) {
    return this.notifications.list(tenant.tenantId, auth.userId, query);
  }

  @Get('unread-count')
  @TenantScoped()
  async unread(@CurrentTenant() tenant: TenantContext, @CurrentAuth() auth: AuthContext) {
    return { unread: await this.notifications.unreadCount(tenant.tenantId, auth.userId) };
  }

  @Get('preferences')
  @TenantScoped()
  preferences(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
  ): Promise<NotificationPreference[]> {
    return this.notifications.preferences(tenant.tenantId, auth.userId);
  }

  @Put('preferences/:kind')
  @TenantScoped()
  @ViewerWritable()
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPreference(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('kind') kind: string,
    @Body() body: unknown,
  ): Promise<void> {
    const parsed = updateNotificationPreferenceSchema.parse(body);
    await this.notifications.setPreference(tenant.tenantId, auth.userId, kind, parsed.enabled);
  }

  @Post('read-all')
  @TenantScoped()
  @ViewerWritable()
  @HttpCode(HttpStatus.NO_CONTENT)
  async readAll(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
  ): Promise<void> {
    await this.notifications.markAllRead(tenant.tenantId, auth.userId);
  }

  @Post(':id/read')
  @TenantScoped()
  @ViewerWritable()
  @HttpCode(HttpStatus.NO_CONTENT)
  async read(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
  ): Promise<void> {
    await this.notifications.markRead(tenant.tenantId, auth.userId, id);
  }
}
