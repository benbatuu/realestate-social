-- AlterEnum
ALTER TYPE "DataRequestStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "data_requests" ADD COLUMN     "reason" TEXT,
ADD COLUMN     "reasonDetail" TEXT,
ADD COLUMN     "scheduledFor" TIMESTAMP(3);
