-- AlterTable
ALTER TABLE "LeadNote" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedById" UUID;

-- CreateTable
CREATE TABLE "LeadNoteRevision" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "writtenById" UUID,
    "writtenAt" TIMESTAMP(3) NOT NULL,
    "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedById" UUID,

    CONSTRAINT "LeadNoteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadNoteRevision_tenantId_noteId_replacedAt_idx" ON "LeadNoteRevision"("tenantId", "noteId", "replacedAt");

-- AddForeignKey
ALTER TABLE "LeadNoteRevision" ADD CONSTRAINT "LeadNoteRevision_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "LeadNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNoteRevision" ADD CONSTRAINT "LeadNoteRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
