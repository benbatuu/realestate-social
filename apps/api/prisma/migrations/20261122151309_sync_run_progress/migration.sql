-- AlterTable
ALTER TABLE "sync_runs" ADD COLUMN     "photosAdded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stage" TEXT;
