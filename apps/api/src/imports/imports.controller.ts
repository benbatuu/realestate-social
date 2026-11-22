import {
  importMappingRequestSchema,
  importPreviewSchema,
  type ImportPreview,
  importRowErrorSchema,
  type ImportRowError,
  importSummarySchema,
  type ImportSummary,
  importUploadResponseSchema,
  type ImportUploadResponse,
} from '@app/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import {
  type AuthContext,
  CurrentAuth,
  CurrentTenant,
  ReqId,
  type TenantContext,
} from '../common/http/request-context';
import { UuidParam } from '../common/http/uuid-param';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/http/zod';
import { TenantScoped } from '../tenants/tenant.guard';
import { errorReportCsv } from './error-report';
import { ImportsService } from './imports.service';

type MappingBody = z.infer<typeof importMappingRequestSchema>;

/** Hard ceiling for the multipart parser; the configured limit is enforced in the service. */
const MULTIPART_MAX_BYTES = 50 * 1024 * 1024;

@ApiTags('imports')
@Controller('imports')
@TenantScoped('MEMBER')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MULTIPART_MAX_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiZodResponse(201, importUploadResponseSchema)
  upload(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @UploadedFile() file: Express.Multer.File | undefined,
    @ReqId() requestId: string | undefined,
  ): Promise<ImportUploadResponse> {
    return this.imports.upload(tenant.tenantId, auth.userId, file, requestId);
  }

  @Get()
  @ApiZodResponse(200, z.array(importSummarySchema))
  list(@CurrentTenant() tenant: TenantContext): Promise<ImportSummary[]> {
    return this.imports.list(tenant.tenantId);
  }

  @Get(':id')
  @ApiZodResponse(200, importSummarySchema)
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
  ): Promise<ImportSummary> {
    return this.imports.get(tenant.tenantId, id);
  }

  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(importMappingRequestSchema)
  @ApiZodResponse(200, importPreviewSchema)
  preview(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
    @Body(new ZodPipe(importMappingRequestSchema)) body: MappingBody,
  ): Promise<ImportPreview> {
    return this.imports.preview(tenant.tenantId, id, body.mapping);
  }

  @Post(':id/commit')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiZodBody(importMappingRequestSchema)
  @ApiZodResponse(202, importSummarySchema)
  commit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @Body(new ZodPipe(importMappingRequestSchema)) body: MappingBody,
    @ReqId() requestId: string | undefined,
  ): Promise<ImportSummary> {
    return this.imports.commit(tenant.tenantId, auth.userId, id, body.mapping, requestId);
  }

  @Get(':id/errors')
  @ApiZodResponse(200, z.array(importRowErrorSchema))
  errors(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
  ): Promise<ImportRowError[]> {
    return this.imports.errors(tenant.tenantId, id);
  }

  @Get(':id/errors.csv')
  @ApiProduces('text/csv')
  async errorsCsv(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const errors = await this.imports.errors(tenant.tenantId, id);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="ice-aktarma-hatalari-${id.slice(0, 8)}.csv"`,
      )
      .setHeader('Cache-Control', 'no-store')
      .send(errorReportCsv(errors));
  }
}
