-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "maxPhotosPerProperty" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "sync_runs" ADD COLUMN     "photosSkipped" INTEGER NOT NULL DEFAULT 0;
