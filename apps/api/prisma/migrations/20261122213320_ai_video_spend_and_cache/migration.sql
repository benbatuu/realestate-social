-- AlterTable
ALTER TABLE "provider_usages" ADD COLUMN     "actualCostMicroUsd" INTEGER;

-- AlterTable
ALTER TABLE "video_scenes" ADD COLUMN     "cacheKey" TEXT;

-- CreateIndex
CREATE INDEX "provider_usages_isMock_createdAt_idx" ON "provider_usages"("isMock", "createdAt");

-- CreateIndex
CREATE INDEX "video_scenes_tenantId_cacheKey_idx" ON "video_scenes"("tenantId", "cacheKey");
