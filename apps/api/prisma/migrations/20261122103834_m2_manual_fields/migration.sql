-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "manualFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
