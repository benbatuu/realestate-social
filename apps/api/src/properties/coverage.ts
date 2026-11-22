import type { Coverage } from '@app/shared';

/** Fields that coverage looks at. Mirrors the Property columns. */
export interface CoverageInput {
  title: string;
  description: string | null;
  listingType: string;
  propertyType: string | null;
  priceMinor: bigint | null;
  grossAreaM2: unknown;
  netAreaM2: unknown;
  roomLayout: string | null;
  city: string | null;
  district: string | null;
  neighborhood: string | null;
  buildingAge: number | null;
  floor: string | null;
  heatingType: string | null;
  furnished: boolean | null;
  photoCount: number;
}

export const RECOMMENDED_PHOTOS = 10;
const MIN_DESCRIPTION_CHARS = 80;

const present = (v: unknown) => v !== null && v !== undefined && v !== '';

/**
 * Field-and-photo completeness, 0–100, with the breakdown shown to users (§6.3: a score is never
 * shown without its explanation). Weights favour what a listing video needs most: photos,
 * price, size, layout and location.
 */
export function computeCoverage(p: CoverageInput): Coverage {
  const descLength = p.description?.trim().length ?? 0;
  const items: Coverage['items'] = [
    {
      key: 'photos',
      label: 'Fotoğraflar',
      weight: 20,
      earned: 20 * Math.min(1, p.photoCount / RECOMMENDED_PHOTOS),
      hint:
        p.photoCount >= RECOMMENDED_PHOTOS
          ? null
          : `${p.photoCount} fotoğraf var; en az ${RECOMMENDED_PHOTOS} öneriyoruz.`,
    },
    {
      key: 'price',
      label: 'Fiyat',
      weight: 15,
      earned: present(p.priceMinor) ? 15 : 0,
      hint: present(p.priceMinor) ? null : 'Fiyat yok.',
    },
    {
      key: 'area',
      label: 'Metrekare',
      weight: 10,
      earned: present(p.grossAreaM2) || present(p.netAreaM2) ? 10 : 0,
      hint: present(p.grossAreaM2) || present(p.netAreaM2) ? null : 'Brüt ya da net m² yok.',
    },
    {
      key: 'rooms',
      label: 'Oda sayısı',
      weight: 10,
      earned: present(p.roomLayout) ? 10 : 0,
      hint: present(p.roomLayout) ? null : 'Oda sayısı yok.',
    },
    {
      key: 'location',
      label: 'Konum',
      weight: 10,
      earned:
        (present(p.city) ? 4 : 0) +
        (present(p.district) ? 4 : 0) +
        (present(p.neighborhood) ? 2 : 0),
      hint:
        present(p.city) && present(p.district) && present(p.neighborhood)
          ? null
          : 'İl, ilçe ya da mahalle eksik.',
    },
    {
      key: 'description',
      label: 'Açıklama',
      weight: 10,
      earned: descLength >= MIN_DESCRIPTION_CHARS ? 10 : descLength > 0 ? 5 : 0,
      hint:
        descLength >= MIN_DESCRIPTION_CHARS
          ? null
          : descLength > 0
            ? 'Açıklama çok kısa.'
            : 'Açıklama yok.',
    },
    { key: 'basics', label: 'Başlık ve ilan türü', weight: 5, earned: 5, hint: null },
    {
      key: 'propertyType',
      label: 'Emlak tipi',
      weight: 5,
      earned: present(p.propertyType) ? 5 : 0,
      hint: present(p.propertyType) ? null : 'Emlak tipi yok.',
    },
    {
      key: 'buildingAge',
      label: 'Bina yaşı',
      weight: 5,
      earned: present(p.buildingAge) ? 5 : 0,
      hint: present(p.buildingAge) ? null : 'Bina yaşı yok.',
    },
    {
      key: 'floor',
      label: 'Kat',
      weight: 5,
      earned: present(p.floor) ? 5 : 0,
      hint: present(p.floor) ? null : 'Kat bilgisi yok.',
    },
    {
      key: 'heating',
      label: 'Isıtma',
      weight: 3,
      earned: present(p.heatingType) ? 3 : 0,
      hint: present(p.heatingType) ? null : 'Isıtma bilgisi yok.',
    },
    {
      key: 'furnished',
      label: 'Eşya durumu',
      weight: 2,
      earned: present(p.furnished) ? 2 : 0,
      hint: present(p.furnished) ? null : 'Eşyalı/eşyasız bilgisi yok.',
    },
  ];
  const score = Math.round(items.reduce((sum, i) => sum + i.earned, 0));
  const level = score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low';
  return {
    score,
    level,
    items: items.map((i) => ({ ...i, earned: Math.round(i.earned * 10) / 10 })),
  };
}
