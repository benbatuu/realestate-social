-- CreateEnum
CREATE TYPE "VideoStage" AS ENUM ('QUEUED', 'VALIDATING', 'ANALYZING_PHOTOS', 'PLANNING_SCENES', 'GENERATING_SCRIPT', 'GENERATING_AI_SCENES', 'GENERATING_VOICE', 'SELECTING_MUSIC', 'COMPOSING_VIDEO', 'RENDERING', 'QUALITY_CHECK', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "video_generations" ADD COLUMN     "durationSeconds" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "failureCode" TEXT,
ADD COLUMN     "failureMessage" TEXT,
ADD COLUMN     "isMock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "manifestJson" JSONB,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "propertySnapshotJson" JSONB,
ADD COLUMN     "scriptJson" JSONB,
ADD COLUMN     "stage" "VideoStage" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "video_scenes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "videoGenerationId" UUID NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "sceneType" TEXT NOT NULL,
    "sourceAssetId" UUID,
    "provider" TEXT,
    "model" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "externalJobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "costMicroUsd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_usages" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "videoGenerationId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "externalRequestId" TEXT,
    "units" INTEGER NOT NULL,
    "unitType" TEXT NOT NULL,
    "estimatedCostMicroUsd" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_scenes_videoGenerationId_sceneNumber_key" ON "video_scenes"("videoGenerationId", "sceneNumber");

-- CreateIndex
CREATE INDEX "provider_usages_videoGenerationId_idx" ON "provider_usages"("videoGenerationId");

-- AddForeignKey
ALTER TABLE "video_scenes" ADD CONSTRAINT "video_scenes_videoGenerationId_fkey" FOREIGN KEY ("videoGenerationId") REFERENCES "video_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_usages" ADD CONSTRAINT "provider_usages_videoGenerationId_fkey" FOREIGN KEY ("videoGenerationId") REFERENCES "video_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
