import type { MembershipRole } from '@app/shared';

const RANK: Record<MembershipRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  MANAGER: 30,
  MEMBER: 20,
  VIEWER: 10,
};

/** Turkish role names for notices. */
export const ROLE_NAME_TR: Record<MembershipRole, string> = {
  OWNER: 'Sahip',
  ADMIN: 'Yönetici',
  MANAGER: 'Müdür',
  MEMBER: 'Danışman',
  VIEWER: 'Görüntüleyici',
};

export function hasAtLeast(role: MembershipRole, required: MembershipRole): boolean {
  return RANK[role] >= RANK[required];
}
