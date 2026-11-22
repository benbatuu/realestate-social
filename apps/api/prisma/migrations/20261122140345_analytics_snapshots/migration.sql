-- CreateEnum
CREATE TYPE "AnalyticsStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "days" INTEGER NOT NULL,
    "status" "AnalyticsStatus" NOT NULL DEFAULT 'RUNNING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "payloadJson" JSONB,
    "error" TEXT,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_tenantId_days_status_requestedAt_idx" ON "AnalyticsSnapshot"("tenantId", "days", "status", "requestedAt");

-- AddForeignKey
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
