-- CreateTable
CREATE TABLE "video_outputs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "videoGenerationId" UUID NOT NULL,
    "format" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "rendererVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_outputs_videoGenerationId_format_key" ON "video_outputs"("videoGenerationId", "format");

-- AddForeignKey
ALTER TABLE "video_outputs" ADD CONSTRAINT "video_outputs_videoGenerationId_fkey" FOREIGN KEY ("videoGenerationId") REFERENCES "video_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
