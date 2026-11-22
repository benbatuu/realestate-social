import type { LeadSource, LeadStatus } from '@app/shared';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Yeni',
  CONTACTED: 'Ulaşıldı',
  QUALIFIED: 'Uygun',
  WON: 'Kazanıldı',
  LOST: 'Kaybedildi',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  MANUAL: 'Elle eklendi',
  WEB_FORM: 'Web formu',
  PHONE: 'Telefon',
  CRM: 'CRM',
  OTHER: 'Diğer',
};

/** Tone of a status badge: open work is neutral, wins green, losses muted red. */
export const LEAD_STATUS_TONE: Record<LeadStatus, string> = {
  NEW: 'bg-sky-100 text-sky-900',
  CONTACTED: 'bg-violet-100 text-violet-900',
  QUALIFIED: 'bg-amber-100 text-amber-900',
  WON: 'bg-emerald-100 text-emerald-900',
  LOST: 'bg-muted text-muted-foreground',
};
