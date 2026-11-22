import type { VideoGenerationEvent, VideoLibraryQuery } from '@app/shared';
import { videoLibraryQuerySchema } from '@app/shared';
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { ZodPipe } from '../common/http/zod';
import { VideoLibraryService } from './library.service';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { concatMap, from, interval, map, Observable, startWith, takeWhile } from 'rxjs';
import {
  type AuthContext,
  CurrentAuth,
  CurrentTenant,
  type TenantContext,
} from '../common/http/request-context';
import { UuidParam } from '../common/http/uuid-param';
import { TenantScoped } from '../tenants/tenant.guard';
import { VideoService } from './video.service';

const IDEM = (required: boolean) =>
  ApiHeader({
    name: 'Idempotency-Key',
    required,
    description: 'Unique per request; retries with the same key return the same result',
  });

@ApiTags('videos')
@Controller()
export class VideoController {
  constructor(
    private readonly videos: VideoService,
    private readonly library_: VideoLibraryService,
  ) {}

  @Post('properties/:id/video-projects')
  @TenantScoped('MEMBER')
  @HttpCode(HttpStatus.CREATED)
  @IDEM(true)
  createProject(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    return this.videos.createProject(tenant.tenantId, auth.userId, id, key);
  }

  @Get('video-projects/:id')
  @TenantScoped()
  project(@CurrentTenant() tenant: TenantContext, @Param('id', UuidParam) id: string) {
    return this.videos.project(tenant.tenantId, id);
  }

  @Post('video-projects/:id/generations')
  @TenantScoped('MEMBER')
  @HttpCode(HttpStatus.ACCEPTED)
  @IDEM(true)
  regenerate(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    return this.videos.createRegeneration(tenant.tenantId, auth.userId, id, key);
  }

  @Get('video-generations/:id')
  @TenantScoped()
  generation(@CurrentTenant() tenant: TenantContext, @Param('id', UuidParam) id: string) {
    return this.videos.generation(tenant.tenantId, id);
  }

  @Get('videos')
  @TenantScoped()
  library(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodPipe(videoLibraryQuerySchema)) query: VideoLibraryQuery,
  ) {
    return this.library_.list(tenant.tenantId, query);
  }

  @Get('properties/:id/video-generations/latest')
  @TenantScoped()
  latestForProperty(@CurrentTenant() tenant: TenantContext, @Param('id', UuidParam) id: string) {
    return this.videos.latestForProperty(tenant.tenantId, id);
  }

  @Get('video-generations/:id/outputs')
  @TenantScoped()
  outputs(@CurrentTenant() tenant: TenantContext, @Param('id', UuidParam) id: string) {
    return this.videos.outputs(tenant.tenantId, id);
  }

  /**
   * Progress stream (SSE) for one generation. Sends the stored stage and progress every second
   * and closes after a terminal stage. Under the tenant path because EventSource cannot send
   * custom headers.
   */
  @Sse('tenants/:tenantId/video-generations/:id/events')
  @TenantScoped()
  events(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', UuidParam) id: string,
  ): Observable<MessageEvent> {
    return interval(1_000).pipe(
      startWith(0),
      concatMap(() => from(this.videos.event(tenant.tenantId, id))),
      takeWhile((e: VideoGenerationEvent) => !e.terminal, true),
      map((e) => ({ data: e }) as MessageEvent),
    );
  }
}
