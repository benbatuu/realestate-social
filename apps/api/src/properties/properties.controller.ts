import type { Response } from 'express';
import {
  propertyUpdateSchema,
  type PropertyUpdate,
  assetUploadResponseSchema,
  type AssetUploadResponse,
  photoOrderRequestSchema,
  type PhotoOrderRequest,
  propertyDetailSchema,
  type PropertyDetail,
  propertyListQuerySchema,
  type PropertyListQuery,
  propertyListResponseSchema,
  type PropertyListResponse,
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
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  type AuthContext,
  CurrentAuth,
  CurrentTenant,
  ReqId,
  type TenantContext,
} from '../common/http/request-context';
import { AppError } from '../common/http/app-error';
import { UuidParam } from '../common/http/uuid-param';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/http/zod';
import { TenantScoped } from '../tenants/tenant.guard';
import { PropertiesService } from './properties.service';

const MAX_FILES_PER_REQUEST = 10;
/** Hard ceiling for the multipart parser; the configured per-photo limit is checked per file. */
const MULTIPART_FILE_MAX_BYTES = 50 * 1024 * 1024;

@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @TenantScoped()
  @ApiZodResponse(200, propertyListResponseSchema)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodPipe(propertyListQuerySchema)) query: PropertyListQuery,
  ): Promise<PropertyListResponse> {
    return this.properties.list(tenant.tenantId, query);
  }

  @Get('export.csv')
  @TenantScoped('MEMBER')
  async exportCsv(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @ReqId() requestId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="portfoy.csv"');
    res.setHeader('Cache-Control', 'no-store');
    return this.properties.exportCsv(tenant.tenantId, auth.userId, requestId);
  }

  @Get(':id')
  @TenantScoped()
  @ApiZodResponse(200, propertyDetailSchema)
  detail(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
  ): Promise<PropertyDetail> {
    return this.properties.detail(tenant.tenantId, id);
  }

  @Patch(':id')
  @TenantScoped('MEMBER')
  @ApiZodBody(propertyUpdateSchema)
  @ApiZodResponse(200, propertyDetailSchema)
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @Body(new ZodPipe(propertyUpdateSchema)) body: PropertyUpdate,
    @ReqId() requestId: string | undefined,
  ): Promise<PropertyDetail> {
    return this.properties.update(tenant.tenantId, auth.userId, id, body, requestId);
  }

  @Post(':id/folder-cover')
  @TenantScoped('MEMBER')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MULTIPART_FILE_MAX_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  uploadFolderCover(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PropertyDetail> {
    if (!file) throw new AppError(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', 'A file is required');
    return this.properties.setFolderCover(tenant.tenantId, id, file.buffer);
  }

  @Patch(':id/folder-cover/from-photo/:assetId')
  @TenantScoped('MEMBER')
  pickFolderCover(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
    @Param('assetId', UuidParam) assetId: string,
  ): Promise<PropertyDetail> {
    return this.properties.pickFolderCoverFromPhoto(tenant.tenantId, id, assetId);
  }

  @Delete(':id/folder-cover')
  @TenantScoped('MEMBER')
  resetFolderCover(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
  ): Promise<PropertyDetail> {
    return this.properties.resetFolderCover(tenant.tenantId, id);
  }

  @Post(':id/assets')
  @TenantScoped('MEMBER')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_REQUEST, {
      limits: { fileSize: MULTIPART_FILE_MAX_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } },
    },
  })
  @ApiZodResponse(201, assetUploadResponseSchema)
  addPhotos(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @ReqId() requestId: string | undefined,
  ): Promise<AssetUploadResponse> {
    return this.properties.addPhotos(tenant.tenantId, auth.userId, id, files ?? [], requestId);
  }

  @Delete(':id/assets/:assetId')
  @TenantScoped('MEMBER')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePhoto(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @Param('assetId', UuidParam) assetId: string,
    @ReqId() requestId: string | undefined,
  ): Promise<void> {
    return this.properties.deletePhoto(tenant.tenantId, auth.userId, id, assetId, requestId);
  }

  @Patch(':id/assets/order')
  @TenantScoped('MEMBER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiZodBody(photoOrderRequestSchema)
  async reorderPhotos(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @Body(new ZodPipe(photoOrderRequestSchema)) body: PhotoOrderRequest,
    @ReqId() requestId: string | undefined,
  ): Promise<void> {
    await this.properties.reorderPhotos(tenant.tenantId, auth.userId, id, body, requestId);
  }
}
