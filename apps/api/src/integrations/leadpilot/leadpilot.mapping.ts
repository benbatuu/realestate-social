import type { FeedProperty } from './leadpilot.client';

/** Our property fields for one LeadPilot feed item. Pure: same input, same output. */
export interface MappedProperty {
  title: string;
  description: string | null;
  listingType: 'SALE' | 'RENT';
  propertyType: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  priceMinor: bigint | null;
  priceCurrency: 'TRY' | 'USD' | 'EUR' | 'GBP' | null;
  grossAreaM2: string | null;
  netAreaM2: string | null;
  bedroomCount: number | null;
  bathroomCount: number | null;
  floor: string | null;
  totalFloors: number | null;
  buildingAge: number | null;
  furnished: boolean | null;
  city: string | null;
  district: string | null;
  neighborhood: string | null;
}

const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'] as const;

export function mapFeedProperty(item: FeedProperty): MappedProperty {
  const priceNumber = item.price === null ? null : Number(item.price);
  const currency = (CURRENCIES as readonly string[]).includes(item.currency)
    ? (item.currency as MappedProperty['priceCurrency'])
    : null;
  return {
    title: item.title,
    description: item.description,
    listingType: item.transactionType === 'RENT' ? 'RENT' : 'SALE',
    propertyType: item.propertyType || null,
    status: item.active && !item.draft ? 'ACTIVE' : 'INACTIVE',
    priceMinor:
      priceNumber !== null && Number.isFinite(priceNumber) && priceNumber > 0
        ? BigInt(Math.round(priceNumber * 100))
        : null,
    priceCurrency: priceNumber !== null ? currency : null,
    grossAreaM2: item.grossAreaM2,
    netAreaM2: item.netAreaM2,
    bedroomCount: item.bedrooms,
    bathroomCount: item.bathrooms,
    floor: item.floorNumber === null ? null : String(item.floorNumber),
    totalFloors: item.totalFloors,
    buildingAge: item.buildingAge,
    furnished: item.furnished,
    city: item.city,
    district: item.district || null,
    neighborhood: item.neighborhood,
  };
}

/** Field names a user can edit by hand. These keep the user's value on later syncs. */
export const SYNCED_FIELDS = [
  'title',
  'description',
  'listingType',
  'propertyType',
  'status',
  'priceMinor',
  'priceCurrency',
  'grossAreaM2',
  'netAreaM2',
  'bedroomCount',
  'bathroomCount',
  'floor',
  'totalFloors',
  'buildingAge',
  'furnished',
  'city',
  'district',
  'neighborhood',
] as const;

/** Drops every synced field the user has edited by hand. */
export function withoutManualFields(
  mapped: MappedProperty,
  manual: string[],
): Partial<MappedProperty> {
  const out: Record<string, unknown> = { ...mapped };
  for (const key of SYNCED_FIELDS) {
    if (manual.includes(key)) delete out[key];
  }
  return out as Partial<MappedProperty>;
}
