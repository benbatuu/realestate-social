-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "pendingPlanId" UUID,
ADD COLUMN     "planChangeAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pendingPlanId_fkey" FOREIGN KEY ("pendingPlanId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
