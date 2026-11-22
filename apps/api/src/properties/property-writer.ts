import type { Prisma } from '../generated/prisma/client';
import type { PropertyRowData } from '../imports/parsing/rows';
import { computeCoverage } from './coverage';

export type RowAction = 'create' | 'update' | 'unchanged';

/** Columns an import may write; keys of PropertyRowData except externalId. */
const WRITABLE = [
  'title',
  'listingType',
  'description',
  'propertyType',
  'status',
  'priceMinor',
  'priceCurrency',
  'grossAreaM2',
  'netAreaM2',
  'roomLayout',
  'bedroomCount',
  'bathroomCount',
  'floor',
  'totalFloors',
  'buildingAge',
  'heatingType',
  'furnished',
  'inComplex',
  'city',
  'district',
  'neighborhood',
  'listedAt',
] as const satisfies readonly (keyof PropertyRowData)[];

type ExistingProperty = Prisma.PropertyGetPayload<object>;

function comparable(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.getTime();
  // Prisma.Decimal and numbers compare by numeric value.
  if (typeof v === 'object' && 'toNumber' in v && typeof v.toNumber === 'function') {
    return (v as { toNumber(): number }).toNumber();
  }
  return v;
}

/**
 * Fields whose value differs from the stored property. Only mapped fields (defined in `data`)
 * are considered, so a file without a price column never clears prices.
 */
export function changedFields(
  existing: ExistingProperty,
  data: PropertyRowData,
): Partial<Record<(typeof WRITABLE)[number], unknown>> {
  const changes: Partial<Record<(typeof WRITABLE)[number], unknown>> = {};
  const manual = new Set(existing.manualFields);
  for (const key of WRITABLE) {
    const next = data[key];
    if (next === undefined || manual.has(key)) continue;
    if (comparable(existing[key]) !== comparable(next)) changes[key] = next;
  }
  return changes;
}

export function planRow(existing: ExistingProperty | undefined, data: PropertyRowData): RowAction {
  if (!existing) return 'create';
  return Object.keys(changedFields(existing, data)).length > 0 ? 'update' : 'unchanged';
}

async function refreshCoverage(
  tx: Prisma.TransactionClient,
  property: ExistingProperty,
): Promise<void> {
  const photoCount = await tx.propertyAsset.count({ where: { propertyId: property.id } });
  const { score } = computeCoverage({ ...property, photoCount });
  if (score !== property.dataCoverageScore) {
    await tx.property.update({ where: { id: property.id }, data: { dataCoverageScore: score } });
  }
}

/** Recomputes and stores a property's coverage score (after photo changes). */
export async function recomputeCoverage(
  tx: Prisma.TransactionClient,
  propertyId: string,
): Promise<void> {
  const property = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
  await refreshCoverage(tx, property);
}

/**
 * Creates or updates one property from an import row. Idempotent: replaying a row that was
 * already applied reports `unchanged`.
 */
export async function applyRow(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string; crmConnectionId: string; syncRunId: string; now: Date },
  data: PropertyRowData,
): Promise<RowAction> {
  const where = {
    tenantId_crmConnectionId_externalId: {
      tenantId: ctx.tenantId,
      crmConnectionId: ctx.crmConnectionId,
      externalId: data.externalId,
    },
  };
  const existing = await tx.property.findUnique({ where });
  const sync = { lastSyncedAt: ctx.now, lastSyncRunId: ctx.syncRunId };

  if (!existing) {
    const { externalId, ...fields } = data;
    const created = await tx.property.create({
      data: {
        ...fields,
        externalId,
        tenantId: ctx.tenantId,
        crmConnectionId: ctx.crmConnectionId,
        ...sync,
      } as Prisma.PropertyUncheckedCreateInput,
    });
    await refreshCoverage(tx, created);
    return 'create';
  }

  const changes = changedFields(existing, data);
  if (Object.keys(changes).length === 0) {
    await tx.property.update({ where: { id: existing.id }, data: sync });
    return 'unchanged';
  }
  const updated = await tx.property.update({
    where: { id: existing.id },
    data: { ...changes, ...sync } as Prisma.PropertyUncheckedUpdateInput,
  });
  await refreshCoverage(tx, updated);
  return 'update';
}
