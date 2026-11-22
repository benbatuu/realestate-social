/**
 * Turkish wording for every audit action, used by the dashboard and the audit page.
 * Unknown actions fall back to a neutral label, never the raw code.
 */
const ACTION_LABEL: Record<string, string> = {
  'auth.registered': 'Hesap açtı',
  'auth.logged_in': 'Giriş yaptı',
  'auth.logged_out': 'Çıkış yaptı',
  'auth.password_changed': 'Şifresini değiştirdi',
  'tenant.created': 'Workspace oluşturdu',
  'tenant.updated': 'Şirket bilgilerini değiştirdi',
  'subscription.started': 'Paketi başlattı',
  'invitation.created': 'Davet gönderdi',
  'invitation.accepted': 'Daveti kabul etti',
  'invitation.revoked': 'Daveti iptal etti',
  'membership.created': 'Üyeyi ekledi',
  'membership.role_changed': 'Üyenin rolünü değiştirdi',
  'membership.removed': 'Üyeyi çıkardı',
  'import.uploaded': 'Dosya yükledi',
  'import.queued': 'İçe aktarmayı başlattı',
  'import.completed': 'İçe aktarmayı tamamladı',
  'import.failed': 'İçe aktarma başarısız oldu',
  'property.updated': 'Mülk bilgilerini düzenledi',
  'property.photo_added': 'Mülke fotoğraf ekledi',
  'property.photo_deleted': 'Mülkten fotoğraf sildi',
  'property.photos_reordered': 'Fotoğraf sırasını değiştirdi',
  'property.exported': 'Portföyü dışa aktardı',
  'video.generation_started': 'Video üretti',
  'credits.adjusted': 'Krediyi düzeltti',
  'account.deletion_requested': 'Hesap silme talebi oluşturdu',
  'account.deletion_cancelled': 'Hesap silme talebini iptal etti',
  'account.deleted': 'Hesabı sildi',
  'lead.created': 'Lead ekledi',
  'lead.updated': 'Lead bilgilerini düzenledi',
  'lead.deleted': 'Lead sildi',
  'lead.note_added': 'Lead için not ekledi',
  'lead.note_deleted': 'Lead notunu sildi',
  'lead.note_updated': 'Lead notunu düzenledi',
};

/** Sentence for lead actions, placed after the lead's name: "Demo · Ayşe K. isimli Lead için not ekledi." */
const LEAD_PREDICATE: Record<string, string> = {
  'lead.created': 'isimli Lead oluşturdu',
  'lead.updated': "isimli Lead'i düzenledi",
  'lead.deleted': "isimli Lead'i sildi",
  'lead.note_added': 'isimli Lead için not ekledi',
  'lead.note_deleted': 'isimli Lead için notu sildi',
  'lead.note_updated': 'isimli Lead için notu düzenledi',
};

export function leadPredicate(action: string): string | null {
  return LEAD_PREDICATE[action] ?? null;
}

export function auditLabel(action: string): string {
  return ACTION_LABEL[action] ?? 'Diğer bir işlem yaptı';
}

const FIELD_LABEL: Record<string, string> = {
  title: 'başlık',
  description: 'açıklama',
  listingType: 'ilan türü',
  propertyType: 'emlak tipi',
  status: 'durum',
  priceMinor: 'fiyat',
  priceCurrency: 'para birimi',
  grossAreaM2: 'brüt alan',
  netAreaM2: 'net alan',
  roomLayout: 'oda sayısı',
  floor: 'kat',
  totalFloors: 'kat sayısı',
  bathroomCount: 'banyo',
  buildingAge: 'bina yaşı',
  heatingType: 'ısıtma',
  furnished: 'eşyalı',
  inComplex: 'site içi',
  city: 'il',
  district: 'ilçe',
  neighborhood: 'mahalle',
  propertyId: 'mülk',
  source: 'kaynak',
  label: 'kısa ad',
  note: 'not',
  nextActionAt: 'sonraki adım',
};

const BILLING_LABEL: Record<string, string> = {
  INITIAL_CREDIT: 'ilk üretim (1 kredi)',
  PAID_REGENERATION: 'yeniden üretim (1 kredi)',
  FREE_REGENERATION: 'ücretsiz yeniden üretim',
};

const REASON_LABEL: Record<string, string> = {
  DO_NOT_NEED: 'Artık ihtiyacım yok',
  OTHER: 'Diğer',
};

/**
 * A short, human reading of the metadata. Internal ids are never shown.
 * Returns an empty string when there is nothing worth showing.
 */
export function auditDetail(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined || value === '') continue;
    switch (key) {
      case 'fields':
        parts.push(
          `değişen alanlar: ${String(value)
            .split(',')
            .map((f) => FIELD_LABEL[f] ?? f)
            .join(', ')}`,
        );
        break;
      case 'billingType':
        parts.push(BILLING_LABEL[String(value)] ?? 'kredi');
        break;
      case 'creditsLeft':
        parts.push(`kalan kredi ${String(value)}`);
        break;
      case 'freeLeft':
        parts.push(`ücretsiz hak ${String(value)}`);
        break;
      case 'status':
        parts.push(`durum: ${String(value)}`);
        break;
      case 'source':
        parts.push(`kaynak: ${String(value)}`);
        break;
      case 'reason':
        parts.push(`sebep: ${REASON_LABEL[String(value)] ?? String(value)}`);
        break;
      case 'graceDays':
        parts.push(`${String(value)} gün bekleme süresi`);
        break;
      // Ids and internal codes are not shown to people.
      case 'propertyId':
      case 'noteId':
      case 'requestId':
        break;
      default:
        break;
    }
  }
  return parts.join(' · ');
}

/** Filter names shown on the audit page. */
export const AUDIT_CATEGORY_LABELS: Record<string, string> = {
  all: 'Tüm işlemler',
  leads: 'Leadler',
  properties: 'Mülkler',
  videos: 'Videolar',
  imports: 'Dosya aktarımları',
  team: 'Ekip ve şirket',
  billing: 'Paket ve krediler',
  account: 'Giriş ve hesap',
};

