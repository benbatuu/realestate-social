import { z } from 'zod';

export const listingTypeSchema = z.enum(['SALE', 'RENT']);
export const propertyStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SOLD', 'RENTED']);
export const currencySchema = z.enum(['TRY', 'USD', 'EUR', 'GBP']);
export type ListingType = z.infer<typeof listingTypeSchema>;
export type PropertyStatus = z.infer<typeof propertyStatusSchema>;
export type Currency = z.infer<typeof currencySchema>;

/**
 * Canonical property fields an import can fill (blueprint §10.3). `synonyms` drive automatic
 * column matching; they are compared after lower-casing and stripping accents and punctuation.
 */
export const IMPORT_FIELDS = [
  {
    key: 'externalId',
    label: 'İlan / portföy no',
    required: true,
    synonyms: [
      'ilan no',
      'ilan numarası',
      'ilan numarasi',
      'portföy no',
      'portfoy no',
      'portföy kodu',
      'ilan kodu',
      'referans no',
      'referans',
      'ref no',
      'kod',
      'id',
      'listing id',
    ],
  },
  {
    key: 'title',
    label: 'Başlık',
    required: true,
    synonyms: ['başlık', 'ilan başlığı', 'baslik', 'title', 'ilan adı'],
  },
  {
    key: 'listingType',
    label: 'İlan türü (satılık/kiralık)',
    required: true,
    synonyms: [
      'ilan türü',
      'ilan tipi',
      'işlem türü',
      'işlem tipi',
      'satılık kiralık',
      'satış kira',
      'listing type',
      'durum tipi',
    ],
  },
  {
    key: 'description',
    label: 'Açıklama',
    required: false,
    synonyms: ['açıklama', 'aciklama', 'ilan açıklaması', 'description', 'detay'],
  },
  {
    key: 'propertyType',
    label: 'Emlak tipi',
    required: false,
    synonyms: [
      'emlak tipi',
      'emlak türü',
      'mülk tipi',
      'konut tipi',
      'kategori',
      'property type',
      'tip',
    ],
  },
  {
    key: 'price',
    label: 'Fiyat',
    required: false,
    synonyms: ['fiyat', 'fiyatı', 'satış fiyatı', 'kira bedeli', 'price', 'tutar'],
  },
  {
    key: 'currency',
    label: 'Para birimi',
    required: false,
    synonyms: ['para birimi', 'döviz', 'doviz', 'currency', 'kur'],
  },
  {
    key: 'grossAreaM2',
    label: 'Brüt m²',
    required: false,
    synonyms: ['brüt m2', 'brüt m²', 'brüt metrekare', 'brüt alan', 'm2 brüt', 'gross area'],
  },
  {
    key: 'netAreaM2',
    label: 'Net m²',
    required: false,
    synonyms: ['net m2', 'net m²', 'net metrekare', 'net alan', 'm2 net', 'net area'],
  },
  {
    key: 'rooms',
    label: 'Oda sayısı (ör. 3+1)',
    required: false,
    synonyms: ['oda sayısı', 'oda sayisi', 'oda', 'oda salon', 'rooms'],
  },
  {
    key: 'bathroomCount',
    label: 'Banyo sayısı',
    required: false,
    synonyms: ['banyo sayısı', 'banyo sayisi', 'banyo', 'bathrooms'],
  },
  {
    key: 'floor',
    label: 'Bulunduğu kat',
    required: false,
    synonyms: ['bulunduğu kat', 'bulundugu kat', 'kat', 'floor'],
  },
  {
    key: 'totalFloors',
    label: 'Kat sayısı',
    required: false,
    synonyms: ['kat sayısı', 'kat sayisi', 'bina kat sayısı', 'toplam kat'],
  },
  {
    key: 'buildingAge',
    label: 'Bina yaşı',
    required: false,
    synonyms: ['bina yaşı', 'bina yasi', 'yaş', 'building age'],
  },
  {
    key: 'heatingType',
    label: 'Isıtma',
    required: false,
    synonyms: ['ısıtma', 'isitma', 'ısınma', 'heating'],
  },
  {
    key: 'furnished',
    label: 'Eşyalı',
    required: false,
    synonyms: ['eşyalı', 'esyali', 'eşya', 'furnished'],
  },
  {
    key: 'inComplex',
    label: 'Site içerisinde',
    required: false,
    synonyms: ['site içerisinde', 'site içi', 'site icerisinde', 'site'],
  },
  { key: 'city', label: 'İl', required: false, synonyms: ['il', 'şehir', 'sehir', 'city'] },
  { key: 'district', label: 'İlçe', required: false, synonyms: ['ilçe', 'ilce', 'district'] },
  {
    key: 'neighborhood',
    label: 'Mahalle',
    required: false,
    synonyms: ['mahalle', 'semt', 'neighborhood'],
  },
  {
    key: 'listedAt',
    label: 'İlan tarihi',
    required: false,
    synonyms: ['ilan tarihi', 'eklenme tarihi', 'yayın tarihi', 'listing date'],
  },
  {
    key: 'status',
    label: 'İlan durumu',
    required: false,
    synonyms: ['ilan durumu', 'durum', 'status', 'yayın durumu'],
  },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]['key'];
export const importFieldKeySchema = z.enum(
  IMPORT_FIELDS.map((f) => f.key) as [ImportFieldKey, ...ImportFieldKey[]],
);

export const numberFormatSchema = z.enum(['tr', 'en']);
export type NumberFormat = z.infer<typeof numberFormatSchema>;

/** Which file column feeds each canonical field, plus parsing options chosen by the user. */
export const importMappingSchema = z.object({
  columns: z.partialRecord(importFieldKeySchema, z.string().min(1).max(200)),
  /** tr: 4.500.000,50 · en: 4,500,000.50. Values that do not fit the format are row errors. */
  numberFormat: numberFormatSchema,
  /** Used only when a price has no currency in its cell and no currency column is mapped. */
  defaultCurrency: currencySchema.nullable(),
});
export type ImportMapping = z.infer<typeof importMappingSchema>;

export const importStatusSchema = z.enum([
  'UPLOADED',
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'EXPIRED',
]);
export type ImportStatus = z.infer<typeof importStatusSchema>;

export const importColumnSchema = z.object({
  name: z.string(),
  /** First non-empty value, shown to help mapping. Returned once, never stored. */
  example: z.string().nullable(),
});

export const importRowErrorSchema = z.object({
  rowNumber: z.number().int(),
  field: importFieldKeySchema.nullable(),
  message: z.string(),
});
export type ImportRowError = z.infer<typeof importRowErrorSchema>;

export const importSummarySchema = z.object({
  id: z.uuid(),
  fileName: z.string(),
  format: z.enum(['CSV', 'XLSX']),
  status: importStatusSchema,
  totalRows: z.number().int(),
  created: z.number().int(),
  updated: z.number().int(),
  unchanged: z.number().int(),
  failed: z.number().int(),
  processedRows: z.number().int(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  createdBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});
export type ImportSummary = z.infer<typeof importSummarySchema>;

export const importUploadResponseSchema = z.object({
  import: importSummarySchema,
  columns: z.array(importColumnSchema),
  suggestedMapping: importMappingSchema,
  /** How the file was read, shown so the user can spot a wrong guess. */
  detected: z.object({
    encoding: z.string().nullable(),
    delimiter: z.string().nullable(),
  }),
});
export type ImportUploadResponse = z.infer<typeof importUploadResponseSchema>;

export const importMappingRequestSchema = z.object({ mapping: importMappingSchema });

export const importPreviewSchema = z.object({
  totalRows: z.number().int(),
  valid: z.number().int(),
  create: z.number().int(),
  update: z.number().int(),
  unchanged: z.number().int(),
  failed: z.number().int(),
  /** First errors only; the full list is available after commit as a report. */
  errors: z.array(importRowErrorSchema),
  sample: z.array(
    z.object({
      rowNumber: z.number().int(),
      externalId: z.string(),
      title: z.string(),
      listingType: listingTypeSchema,
      price: z.string().nullable(),
      location: z.string().nullable(),
      action: z.enum(['create', 'update', 'unchanged']),
    }),
  ),
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;

export const coverageItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  weight: z.number(),
  earned: z.number(),
  hint: z.string().nullable(),
});

/** Field-and-photo completeness (not the source/lead coverage of §6.2, which comes later). */
export const coverageSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.enum(['low', 'medium', 'high']),
  items: z.array(coverageItemSchema),
});
export type Coverage = z.infer<typeof coverageSchema>;

export const propertyListItemSchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  title: z.string(),
  listingType: listingTypeSchema,
  propertyType: z.string().nullable(),
  status: propertyStatusSchema,
  /** Minor units (kuruş/cent). Safe as a JS number for any realistic price. */
  priceMinor: z.number().int().nullable(),
  priceCurrency: currencySchema.nullable(),
  roomLayout: z.string().nullable(),
  grossAreaM2: z.number().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  neighborhood: z.string().nullable(),
  coverageScore: z.number().int(),
  photoCount: z.number().int(),
  coverThumbnailUrl: z.url().nullable(),
  updatedAt: z.iso.datetime(),
});
export type PropertyListItem = z.infer<typeof propertyListItemSchema>;

export const propertySortSchema = z.enum([
  'updated',
  'coverage_asc',
  'coverage_desc',
  'price_desc',
  'price_asc',
]);

export const propertyListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  listingType: listingTypeSchema.optional(),
  sort: propertySortSchema.default('updated'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(25),
});
export type PropertyListQuery = z.infer<typeof propertyListQuerySchema>;

export const propertyListResponseSchema = z.object({
  items: z.array(propertyListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type PropertyListResponse = z.infer<typeof propertyListResponseSchema>;

export const propertyAssetSchema = z.object({
  id: z.uuid(),
  width: z.number().int(),
  height: z.number().int(),
  fileSize: z.number().int(),
  mimeType: z.string(),
  sortOrder: z.number().int(),
  /** Short-lived signed URLs (minutes). Refetch the property to renew. */
  url: z.url(),
  thumbnailUrl: z.url(),
  createdAt: z.iso.datetime(),
});
export type PropertyAsset = z.infer<typeof propertyAssetSchema>;

export const propertyDetailSchema = propertyListItemSchema.extend({
  description: z.string().nullable(),
  netAreaM2: z.number().nullable(),
  bedroomCount: z.number().int().nullable(),
  bathroomCount: z.number().int().nullable(),
  floor: z.string().nullable(),
  totalFloors: z.number().int().nullable(),
  buildingAge: z.number().int().nullable(),
  heatingType: z.string().nullable(),
  furnished: z.boolean().nullable(),
  inComplex: z.boolean().nullable(),
  listedAt: z.iso.datetime().nullable(),
  coverage: coverageSchema,
  assets: z.array(propertyAssetSchema),
  source: z.object({
    name: z.string().nullable(),
    lastSyncedAt: z.iso.datetime().nullable(),
    lastImportId: z.uuid().nullable(),
  }),
  createdAt: z.iso.datetime(),
});
export type PropertyDetail = z.infer<typeof propertyDetailSchema>;

export const assetUploadResultSchema = z.object({
  fileName: z.string(),
  outcome: z.enum(['created', 'duplicate', 'rejected']),
  /** Turkish, user-facing reason for duplicate/rejected. */
  reason: z.string().nullable(),
  assetId: z.uuid().nullable(),
});
export const assetUploadResponseSchema = z.object({ results: z.array(assetUploadResultSchema) });
export type AssetUploadResponse = z.infer<typeof assetUploadResponseSchema>;

/** Fields a user may edit by hand. Same meaning as in an import row; null clears. */
export const propertyUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(10_000).nullable(),
    listingType: listingTypeSchema,
    propertyType: z.string().trim().max(60).nullable(),
    status: propertyStatusSchema,
    priceMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    priceCurrency: currencySchema.nullable(),
    grossAreaM2: z.number().positive().max(1_000_000).nullable(),
    netAreaM2: z.number().positive().max(1_000_000).nullable(),
    roomLayout: z.string().trim().max(10).nullable(),
    bedroomCount: z.number().int().min(0).max(50).nullable(),
    bathroomCount: z.number().int().min(0).max(50).nullable(),
    floor: z.string().trim().max(30).nullable(),
    totalFloors: z.number().int().min(0).max(200).nullable(),
    buildingAge: z.number().int().min(0).max(300).nullable(),
    heatingType: z.string().trim().max(60).nullable(),
    furnished: z.boolean().nullable(),
    inComplex: z.boolean().nullable(),
    city: z.string().trim().max(60).nullable(),
    district: z.string().trim().max(60).nullable(),
    neighborhood: z.string().trim().max(100).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'En az bir alan değiştirilmeli.')
  .refine(
    (v) => v.priceMinor === undefined || v.priceMinor === null || v.priceCurrency !== undefined,
    {
      message: 'Fiyat girildiğinde para birimi de seçilmeli.',
      path: ['priceCurrency'],
    },
  );
export type PropertyUpdate = z.infer<typeof propertyUpdateSchema>;

export const photoOrderRequestSchema = z.object({
  /** Every photo of the property, in the new order. */
  assetIds: z.array(z.uuid()).min(1).max(200),
});
export type PhotoOrderRequest = z.infer<typeof photoOrderRequestSchema>;
