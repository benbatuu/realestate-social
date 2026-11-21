import type { MembershipRole } from '@app/shared';

const RANK: Record<MembershipRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  MANAGER: 30,
  MEMBER: 20,
  VIEWER: 10,
};

export function hasAtLeast(role: MembershipRole, required: MembershipRole): boolean {
  return RANK[role] >= RANK[required];
}
