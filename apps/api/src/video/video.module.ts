import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { QUEUES } from '../queues/queues';
import { TenantsModule } from '../tenants/tenants.module';
import { ProviderRegistry } from './providers/registry';
import { PipelineRunner } from './pipeline.runner';
import { RenderService } from '../render/render.service';
import { VideoController } from './video.controller';
import { VideoLibraryService } from './library.service';
import { VideoService } from './video.service';
import { SpendGuard } from './spend-guard.service';

@Module({
  imports: [TenantsModule, CreditsModule, BullModule.registerQueue({ name: QUEUES.video })],
  controllers: [VideoController],
  providers: [
    VideoService,
    VideoLibraryService,
    PipelineRunner,
    ProviderRegistry,
    RenderService,
    SpendGuard,
  ],
})
export class VideoModule {}
