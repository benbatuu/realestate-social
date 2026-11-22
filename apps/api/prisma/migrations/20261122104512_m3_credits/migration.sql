-- CreateEnum
CREATE TYPE "CreditLedgerType" AS ENUM ('GRANT', 'RESERVE', 'RELEASE', 'CAPTURE', 'EXPIRE', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "FreeRegenerationLedgerType" AS ENUM ('GRANT', 'RESERVE', 'RELEASE', 'CONSUME', 'EXPIRE');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('INITIAL_CREDIT', 'FREE_REGENERATION', 'PAID_REGENERATION');

-- CreateEnum
CREATE TYPE "VideoGenerationStatus" AS ENUM ('RESERVED', 'CAPTURED', 'RELEASED');

-- CreateTable
CREATE TABLE "credit_accounts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "available" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" "CreditLedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "free_regeneration_accounts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "granted" INTEGER NOT NULL,
    "available" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "free_regeneration_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "free_regeneration_ledger" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "type" "FreeRegenerationLedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "referenceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "free_regeneration_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_projects" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "createdByUserId" UUID,
    "title" TEXT NOT NULL,
    "freeRegenerationUsed" BOOLEAN NOT NULL DEFAULT false,
    "generationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_generations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "videoProjectId" UUID NOT NULL,
    "generationNumber" INTEGER NOT NULL,
    "status" "VideoGenerationStatus" NOT NULL,
    "billingType" "BillingType" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "video_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_accounts_tenantId_key" ON "credit_accounts"("tenantId");

-- CreateIndex
CREATE INDEX "credit_ledger_tenantId_createdAt_idx" ON "credit_ledger"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_tenantId_idempotencyKey_key" ON "credit_ledger"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "free_regeneration_accounts_tenantId_periodStart_key" ON "free_regeneration_accounts"("tenantId", "periodStart");

-- CreateIndex
CREATE INDEX "free_regeneration_ledger_accountId_idx" ON "free_regeneration_ledger"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "free_regeneration_ledger_tenantId_idempotencyKey_key" ON "free_regeneration_ledger"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "video_projects_tenantId_createdAt_idx" ON "video_projects"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "video_generations_videoProjectId_generationNumber_key" ON "video_generations"("videoProjectId", "generationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "video_generations_tenantId_idempotencyKey_key" ON "video_generations"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
