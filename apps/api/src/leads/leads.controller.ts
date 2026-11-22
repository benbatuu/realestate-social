import {
  type Lead,
  leadCreateSchema,
  type LeadDetail,
  leadDetailSchema,
  type LeadNoteCreate,
  type LeadNoteHistory,
  leadNoteHistorySchema,
  type LeadNoteUpdate,
  leadNoteUpdateSchema,
  leadNoteCreateSchema,
  type LeadCreate,
  leadListQuerySchema,
  type LeadListQuery,
  type LeadListResponse,
  leadListResponseSchema,
  leadSchema,
  leadUpdateSchema,
  type LeadUpdate,
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
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/http/zod';
import { UuidParam } from '../common/http/uuid-param';
import {
  type AuthContext,
  CurrentAuth,
  CurrentTenant,
  ReqId,
  type TenantContext,
} from '../common/http/request-context';
import { TenantScoped } from '../tenants/tenant.guard';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @TenantScoped()
  @ApiZodResponse(200, leadListResponseSchema)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodPipe(leadListQuerySchema)) query: LeadListQuery,
  ): Promise<LeadListResponse> {
    return this.leads.list(tenant.tenantId, query);
  }

  @Get(':id')
  @TenantScoped()
  @ApiZodResponse(200, leadDetailSchema)
  detail(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
  ): Promise<LeadDetail> {
    return this.leads.detail(tenant.tenantId, id);
  }

  @Post(':id/notes')
  @TenantScoped('MEMBER')
  @HttpCode(HttpStatus.CREATED)
  @ApiZodBody(leadNoteCreateSchema)
  async addNote(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @Body(new ZodPipe(leadNoteCreateSchema)) body: LeadNoteCreate,
    @ReqId() requestId: string | undefined,
  ): Promise<void> {
    await this.leads.addNote(tenant.tenantId, auth.userId, id, body.body, requestId);
  }

  @Patch(':id/notes/:noteId')
  @TenantScoped('MEMBER')
  @ApiZodBody(leadNoteUpdateSchema)
  async updateNote(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @Param('noteId', UuidParam) noteId: string,
    @Body(new ZodPipe(leadNoteUpdateSchema)) body: LeadNoteUpdate,
    @ReqId() requestId: string | undefined,
  ): Promise<void> {
    await this.leads.updateNote(tenant.tenantId, auth.userId, id, noteId, body.body, requestId);
  }

  @Get(':id/notes/:noteId/history')
  @TenantScoped()
  @ApiZodResponse(200, leadNoteHistorySchema)
  noteHistory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
    @Param('noteId', UuidParam) noteId: string,
  ): Promise<LeadNoteHistory> {
    return this.leads.noteHistory(tenant.tenantId, id, noteId);
  }

  @Post()
  @TenantScoped('MEMBER')
  @ApiZodBody(leadCreateSchema)
  @ApiZodResponse(201, leadSchema)
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(leadCreateSchema)) body: LeadCreate,
    @ReqId() requestId: string | undefined,
  ): Promise<Lead> {
    return this.leads.create(tenant.tenantId, auth.userId, body, requestId);
  }

  @Patch(':id')
  @TenantScoped('MEMBER')
  @ApiZodBody(leadUpdateSchema)
  @ApiZodResponse(200, leadSchema)
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @Body(new ZodPipe(leadUpdateSchema)) body: LeadUpdate,
    @ReqId() requestId: string | undefined,
  ): Promise<Lead> {
    return this.leads.update(tenant.tenantId, auth.userId, id, body, requestId);
  }

  @Delete(':id')
  @TenantScoped('MEMBER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @ReqId() requestId: string | undefined,
  ): Promise<void> {
    await this.leads.remove(tenant.tenantId, auth.userId, id, requestId);
  }
}
