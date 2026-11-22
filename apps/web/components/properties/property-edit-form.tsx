'use client';

import {
  type Currency,
  type ListingType,
  type PropertyDetail,
  type PropertyStatus,
  type PropertyUpdate,
  propertyUpdateSchema,
} from '@app/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPatch } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import {
  formatArea,
  formatDate,
  formatPrice,
  LISTING_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const selectClass =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/** Form state as strings; converted to the API shape on save. */
interface Draft {
  title: string;
  description: string;
  listingType: ListingType;
  status: PropertyStatus;
  price: string;
  priceCurrency: Currency | '';
  grossAreaM2: string;
  netAreaM2: string;
  roomLayout: string;
  floor: string;
  buildingAge: string;
  heatingType: string;
  city: string;
  district: string;
  neighborhood: string;
  propertyType: string;
  bathroomCount: string;
  totalFloors: string;
  /** '' (unknown), 'true' or 'false'. */
  furnished: string;
  inComplex: string;
}

const triState = (v: boolean | null) => (v === null ? '' : v ? 'true' : 'false');

const toDraft = (p: PropertyDetail): Draft => ({
  title: p.title,
  description: p.description ?? '',
  listingType: p.listingType,
  status: p.status,
  price: p.priceMinor === null ? '' : String(p.priceMinor / 100),
  priceCurrency: p.priceCurrency ?? '',
  grossAreaM2: p.grossAreaM2 === null ? '' : String(p.grossAreaM2),
  netAreaM2: p.netAreaM2 === null ? '' : String(p.netAreaM2),
  roomLayout: p.roomLayout ?? '',
  floor: p.floor ?? '',
  buildingAge: p.buildingAge === null ? '' : String(p.buildingAge),
  heatingType: p.heatingType ?? '',
  city: p.city ?? '',
  district: p.district ?? '',
  neighborhood: p.neighborhood ?? '',
  propertyType: p.propertyType ?? '',
  bathroomCount: p.bathroomCount === null ? '' : String(p.bathroomCount),
  totalFloors: p.totalFloors === null ? '' : String(p.totalFloors),
  furnished: triState(p.furnished),
  inComplex: triState(p.inComplex),
});

const txt = (v: string) => (v.trim() === '' ? null : v.trim());
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/** Only fields that differ from the saved property are sent. */
function diff(original: PropertyDetail, draft: Draft): PropertyUpdate {
  const base = toDraft(original);
  const out: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => (out[key] = value);
  if (draft.title !== base.title) set('title', draft.title.trim());
  if (draft.description !== base.description) set('description', txt(draft.description));
  if (draft.listingType !== base.listingType) set('listingType', draft.listingType);
  if (draft.status !== base.status) set('status', draft.status);
  if (draft.price !== base.price || draft.priceCurrency !== base.priceCurrency) {
    const amount = num(draft.price);
    set('priceMinor', amount === null ? null : Math.round(amount * 100));
    set('priceCurrency', draft.priceCurrency || null);
  }
  if (draft.grossAreaM2 !== base.grossAreaM2) set('grossAreaM2', num(draft.grossAreaM2));
  if (draft.netAreaM2 !== base.netAreaM2) set('netAreaM2', num(draft.netAreaM2));
  if (draft.roomLayout !== base.roomLayout) set('roomLayout', txt(draft.roomLayout));
  if (draft.floor !== base.floor) set('floor', txt(draft.floor));
  if (draft.buildingAge !== base.buildingAge) {
    const n = num(draft.buildingAge);
    set('buildingAge', n === null ? null : Math.round(n));
  }
  if (draft.heatingType !== base.heatingType) set('heatingType', txt(draft.heatingType));
  if (draft.city !== base.city) set('city', txt(draft.city));
  if (draft.district !== base.district) set('district', txt(draft.district));
  if (draft.neighborhood !== base.neighborhood) set('neighborhood', txt(draft.neighborhood));
  if (draft.propertyType !== base.propertyType) set('propertyType', txt(draft.propertyType));
  if (draft.bathroomCount !== base.bathroomCount) {
    const n = num(draft.bathroomCount);
    set('bathroomCount', n === null ? null : Math.round(n));
  }
  if (draft.totalFloors !== base.totalFloors) {
    const n = num(draft.totalFloors);
    set('totalFloors', n === null ? null : Math.round(n));
  }
  const bool = (v: string) => (v === '' ? null : v === 'true');
  if (draft.furnished !== base.furnished) set('furnished', bool(draft.furnished));
  if (draft.inComplex !== base.inComplex) set('inComplex', bool(draft.inComplex));
  return out as PropertyUpdate;
}

const yesNo = (v: boolean | null) => (v === null ? null : v ? 'Evet' : 'Hayır');

const TRI_OPTIONS: [string, string][] = [
  ['', 'Belirtilmedi'],
  ['true', 'Evet'],
  ['false', 'Hayır'],
];

type TextKey = Exclude<
  keyof Draft,
  'listingType' | 'status' | 'price' | 'priceCurrency' | 'description'
>;

interface Row {
  label: string;
  /** Shown when not editing. */
  value: string | null;
  /** Draft field that makes this row editable. */
  field?: TextKey | 'listingType' | 'status' | 'price';
  options?: [string, string][];
  /** Price row: amount plus currency. */
  price?: boolean;
  numeric?: boolean;
}

interface Group {
  title: string;
  rows: Row[];
}

function groups(p: PropertyDetail): Group[] {
  return [
    {
      title: 'Genel',
      rows: [
        { label: 'Başlık', value: p.title, field: 'title' },
        {
          label: 'İlan türü',
          value: LISTING_TYPE_LABELS[p.listingType],
          field: 'listingType',
          options: Object.entries(LISTING_TYPE_LABELS),
        },
        {
          label: 'Durum',
          value: PROPERTY_STATUS_LABELS[p.status],
          field: 'status',
          options: Object.entries(PROPERTY_STATUS_LABELS),
        },
        {
          label: 'Fiyat',
          value: formatPrice(p.priceMinor, p.priceCurrency),
          field: 'price',
          price: true,
        },
        { label: 'Emlak tipi', value: p.propertyType, field: 'propertyType' },
        { label: 'Oda sayısı', value: p.roomLayout, field: 'roomLayout' },
        {
          label: 'Banyo',
          value: p.bathroomCount === null ? null : String(p.bathroomCount),
          field: 'bathroomCount',
          numeric: true,
        },
        {
          label: 'Eşyalı',
          value: yesNo(p.furnished),
          field: 'furnished',
          options: TRI_OPTIONS,
        },
      ],
    },
    {
      title: 'Alan ve kat',
      rows: [
        {
          label: 'Brüt alan',
          value: formatArea(p.grossAreaM2),
          field: 'grossAreaM2',
          numeric: true,
        },
        { label: 'Net alan', value: formatArea(p.netAreaM2), field: 'netAreaM2', numeric: true },
        { label: 'Bulunduğu kat', value: p.floor, field: 'floor' },
        {
          label: 'Kat sayısı',
          value: p.totalFloors === null ? null : String(p.totalFloors),
          field: 'totalFloors',
          numeric: true,
        },
      ],
    },
    {
      title: 'Bina',
      rows: [
        {
          label: 'Bina yaşı',
          value: p.buildingAge === null ? null : String(p.buildingAge),
          field: 'buildingAge',
          numeric: true,
        },
        { label: 'Isıtma', value: p.heatingType, field: 'heatingType' },
        {
          label: 'Site içerisinde',
          value: yesNo(p.inComplex),
          field: 'inComplex',
          options: TRI_OPTIONS,
        },
        {
          // Read-only: when the property was created by an import, that is the upload date;
          // when it was added by hand, the date it was added.
          label: p.source.lastImportId ? 'Yüklenme tarihi' : 'Eklenme tarihi',
          value: formatDate(p.createdAt),
        },
      ],
    },
    {
      title: 'Konum',
      rows: [
        { label: 'İl', value: p.city, field: 'city' },
        { label: 'İlçe', value: p.district, field: 'district' },
        { label: 'Mahalle', value: p.neighborhood, field: 'neighborhood' },
      ],
    },
  ];
}

/**
 * The "Bilgiler" card. Values read as text; "Bilgileri düzenle" turns the same rows into
 * inputs in place, so every value stays where it was.
 */
export function PropertyEditForm({
  tenantId,
  property,
  canEdit,
}: {
  tenantId: string;
  property: PropertyDetail;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(property));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    setError(null);
    const changes = diff(property, draft);
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }
    const parsed = propertyUpdateSchema.safeParse(changes);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Bilgileri kontrol edin.');
      return;
    }
    setSaving(true);
    const res = await apiPatch(`/properties/${property.id}`, parsed.data, { tenantId });
    setSaving(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    toast.success('Mülk güncellendi.');
    setEditing(false);
    router.refresh();
  }

  function renderEditor(row: Row) {
    if (!row.field) return null;
    if (row.price) {
      return (
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
          <Input
            aria-label="Fiyat"
            inputMode="decimal"
            placeholder="12500000"
            value={draft.price}
            onChange={(e) => set('price', e.target.value)}
          />
          <select
            aria-label="Para birimi"
            className={selectClass}
            value={draft.priceCurrency}
            onChange={(e) => set('priceCurrency', e.target.value as Currency | '')}
          >
            <option value="">—</option>
            <option value="TRY">TL</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      );
    }
    if (row.options) {
      const current = draft[row.field as keyof Draft] as string;
      return (
        <select
          aria-label={row.label}
          className={selectClass}
          value={current}
          onChange={(e) => set(row.field as keyof Draft, e.target.value as never)}
        >
          {row.options.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      );
    }
    return (
      <Input
        aria-label={row.label}
        inputMode={row.numeric ? 'decimal' : undefined}
        value={draft[row.field as TextKey]}
        onChange={(e) => set(row.field as TextKey, e.target.value)}
      />
    );
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">Bilgiler</h2>
      {canEdit &&
        (editing ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Vazgeç
            </Button>
            <Button type="submit" form="property-info-form" size="sm" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft(toDraft(property));
              setError(null);
              setEditing(true);
            }}
          >
            Bilgileri düzenle
          </Button>
        ))}
    </div>
  );

  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
      {header}
      <form
        id="property-info-form"
        noValidate
        className="grid items-start gap-6 lg:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (editing) void save();
        }}
      >
        <div className="lg:col-span-2">
          <FormError message={error} />
        </div>
        {groups(property).map((group) => (
          <div key={group.title} className="flex flex-col gap-1 rounded-lg border p-4">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.title}
            </h3>
            <dl className="flex flex-col text-sm">
              {group.rows.map((row) => {
                const editable = editing && row.field !== undefined;
                return (
                  <div
                    key={row.label}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-4 border-b py-2"
                  >
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd
                      className={cn(
                        'min-w-0 text-right',
                        !editable && (row.value ? 'font-medium' : 'text-muted-foreground'),
                      )}
                    >
                      {editable ? renderEditor(row) : (row.value ?? '—')}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}

        {editing && (
          <p className="text-xs text-muted-foreground">
            Elle değiştirdiğiniz alanları sonraki içe aktarmalar ezmez.
          </p>
        )}
      </form>
    </section>
  );
}
