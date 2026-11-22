import type { MembershipRole } from '@app/shared';

export const ROLE_LABELS: Record<MembershipRole, string> = {
  OWNER: 'Sahip',
  ADMIN: 'Yönetici',
  MANAGER: 'Müdür',
  MEMBER: 'Danışman',
  VIEWER: 'Görüntüleyici',
};

const RANK: Record<MembershipRole, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  MEMBER: 2,
  VIEWER: 1,
};

/** UI-only convenience; the API enforces roles on every request. */
export function canManageMembers(role: MembershipRole): boolean {
  return RANK[role] >= RANK.ADMIN;
}

export function canImport(role: MembershipRole): boolean {
  return RANK[role] >= RANK.MANAGER;
}

export function canEditPhotos(role: MembershipRole): boolean {
  return RANK[role] >= RANK.MEMBER;
}

/** Portfolio work: edit properties, import files, export. Advisors (MEMBER) and above. */
export function canEditPortfolio(role: MembershipRole): boolean {
  return RANK[role] >= RANK.MEMBER;
}
