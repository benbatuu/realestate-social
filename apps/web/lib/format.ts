import type { Currency, ListingType, PropertyStatus } from '@app/shared';

/** Up to two initials for avatars ("Ayşe Yılmaz" → "AY"). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR'))
    .join('');
}

export function formatPrice(minor: number | null, currency: Currency | null): string | null {
  if (minor === null || currency === null) return null;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export function formatArea(m2: number | null): string | null {
  return m2 === null ? null : `${new Intl.NumberFormat('tr-TR').format(m2)} m²`;
}

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeZone: 'Europe/Istanbul',
});
const dateTimeFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  SALE: 'Satılık',
  RENT: 'Kiralık',
};

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Pasif',
  SOLD: 'Satıldı',
  RENTED: 'Kiralandı',
};

export function locationLine(p: {
  neighborhood: string | null;
  district: string | null;
  city: string | null;
}) {
  return [p.neighborhood, p.district, p.city].filter(Boolean).join(', ') || null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`;
}
