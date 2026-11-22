-- CreateEnum
CREATE TYPE "CrmProvider" AS ENUM ('CSV', 'LEADPILOT', 'GENERIC_REST');

-- CreateEnum
CREATE TYPE "CrmConnectionStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "SyncRunKind" AS ENUM ('FILE_IMPORT', 'API_SYNC');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('UPLOADED', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ImportFileFormat" AS ENUM ('CSV', 'XLSX');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SOLD', 'RENTED');

-- CreateEnum
CREATE TYPE "AssetSourceType" AS ENUM ('UPLOAD', 'CRM', 'IMPORT');

-- CreateTable
CREATE TABLE "crm_connections" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "provider" "CrmProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CrmConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "systemKey" TEXT,
    "encryptedCredentials" TEXT,
    "capabilitiesJson" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "crmConnectionId" UUID NOT NULL,
    "kind" "SyncRunKind" NOT NULL,
    "status" "SyncRunStatus" NOT NULL,
    "fileName" TEXT,
    "fileFormat" "ImportFileFormat",
    "fileStorageKey" TEXT,
    "fileSize" INTEGER,
    "mappingJson" JSONB,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsUnchanged" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "createdByUserId" UUID,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_run_row_errors" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "syncRunId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "field" TEXT,
    "message" TEXT NOT NULL,

    CONSTRAINT "sync_run_row_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "crmConnectionId" UUID,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "listingType" "ListingType" NOT NULL,
    "propertyType" TEXT,
    "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "priceMinor" BIGINT,
    "priceCurrency" TEXT,
    "grossAreaM2" DECIMAL(10,2),
    "netAreaM2" DECIMAL(10,2),
    "roomLayout" TEXT,
    "bedroomCount" INTEGER,
    "bathroomCount" INTEGER,
    "floor" TEXT,
    "totalFloors" INTEGER,
    "buildingAge" INTEGER,
    "heatingType" TEXT,
    "furnished" BOOLEAN,
    "inComplex" BOOLEAN,
    "country" TEXT NOT NULL DEFAULT 'TR',
    "city" TEXT,
    "district" TEXT,
    "neighborhood" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "listedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncRunId" UUID,
    "dataCoverageScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_assets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "sourceUrl" TEXT,
    "storageKey" TEXT NOT NULL,
    "previewStorageKey" TEXT,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "sourceType" "AssetSourceType" NOT NULL,
    "uploadedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_connections_tenantId_idx" ON "crm_connections"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_connections_tenantId_systemKey_key" ON "crm_connections"("tenantId", "systemKey");

-- CreateIndex
CREATE INDEX "sync_runs_tenantId_createdAt_idx" ON "sync_runs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "sync_runs_status_expiresAt_idx" ON "sync_runs"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "sync_run_row_errors_syncRunId_rowNumber_idx" ON "sync_run_row_errors"("syncRunId", "rowNumber");

-- CreateIndex
CREATE INDEX "properties_tenantId_updatedAt_idx" ON "properties"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "properties_tenantId_dataCoverageScore_idx" ON "properties"("tenantId", "dataCoverageScore");

-- CreateIndex
CREATE UNIQUE INDEX "properties_tenantId_crmConnectionId_externalId_key" ON "properties"("tenantId", "crmConnectionId", "externalId");

-- CreateIndex
CREATE INDEX "property_assets_tenantId_propertyId_sortOrder_idx" ON "property_assets"("tenantId", "propertyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "property_assets_propertyId_checksum_key" ON "property_assets"("propertyId", "checksum");

-- AddForeignKey
ALTER TABLE "crm_connections" ADD CONSTRAINT "crm_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_crmConnectionId_fkey" FOREIGN KEY ("crmConnectionId") REFERENCES "crm_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_run_row_errors" ADD CONSTRAINT "sync_run_row_errors_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_crmConnectionId_fkey" FOREIGN KEY ("crmConnectionId") REFERENCES "crm_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_assets" ADD CONSTRAINT "property_assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_assets" ADD CONSTRAINT "property_assets_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
