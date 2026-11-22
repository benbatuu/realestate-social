import type { Prisma } from '../generated/prisma/client';

export const FILE_IMPORT_SYSTEM_KEY = 'file-import';

/** The tenant's built-in "CSV / Excel" source. Created on first use; safe under concurrency. */
export async function ensureFileImportSource(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<{ id: string; name: string }> {
  return tx.crmConnection.upsert({
    where: { tenantId_systemKey: { tenantId, systemKey: FILE_IMPORT_SYSTEM_KEY } },
    create: { tenantId, provider: 'CSV', name: 'CSV / Excel', systemKey: FILE_IMPORT_SYSTEM_KEY },
    update: {},
    select: { id: true, name: true },
  });
}
