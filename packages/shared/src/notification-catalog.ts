import { z } from 'zod';

/**
 * Every notice kind, its group, and which roles get it by default. Each member can change
 * their own choice; roles only set the starting point.
 */
export const NOTIFICATION_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] as const;
const TEAM_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

export const NOTIFICATION_CATALOG = [
  {
    kind: 'video.completed',
    label: 'Video hazır',
    group: 'personal',
    defaultRoles: NOTIFICATION_ROLES,
  },
  {
    kind: 'video.failed',
    label: 'Video üretilemedi',
    group: 'personal',
    defaultRoles: NOTIFICATION_ROLES,
  },
  {
    kind: 'import.completed',
    label: 'İçe aktarma bitti',
    group: 'personal',
    defaultRoles: NOTIFICATION_ROLES,
  },
  {
    kind: 'import.failed',
    label: 'İçe aktarma başarısız',
    group: 'personal',
    defaultRoles: NOTIFICATION_ROLES,
  },
  {
    kind: 'lead.assigned',
    label: 'Lead bana atandı',
    group: 'personal',
    defaultRoles: NOTIFICATION_ROLES,
  },
  {
    kind: 'lead.followup_overdue',
    label: 'Sonraki adımı gecikmiş lead',
    group: 'personal',
    defaultRoles: NOTIFICATION_ROLES,
  },
  {
    kind: 'team.member_joined',
    label: 'Yeni üye katıldı',
    group: 'team',
    defaultRoles: TEAM_ROLES,
  },
  {
    kind: 'team.member_changed',
    label: 'Üye çıkarıldı veya rolü değişti',
    group: 'team',
    defaultRoles: TEAM_ROLES,
  },
  {
    kind: 'crm.sync_failed',
    label: 'CRM senkronu başarısız',
    group: 'team',
    defaultRoles: TEAM_ROLES,
  },
  { kind: 'credits.low', label: 'Kredi %20 altına düştü', group: 'team', defaultRoles: TEAM_ROLES },
  {
    kind: 'subscription.changed',
    label: 'Paket değişti veya düşürme planlandı',
    group: 'team',
    defaultRoles: TEAM_ROLES,
  },
] as const;

export const NOTIFICATION_KIND_NAMES = NOTIFICATION_CATALOG.map((k) => k.kind);

export const notificationPreferenceSchema = z.object({
  kind: z.string(),
  label: z.string(),
  group: z.enum(['personal', 'team']),
  enabled: z.boolean(),
});
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export const updateNotificationPreferenceSchema = z.object({ enabled: z.boolean() });
