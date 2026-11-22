import type { Metadata } from 'next';
import { EllipsisIcon } from 'lucide-react';
import type { MembershipRole } from '@app/shared';
import { InviteDialog } from '@/components/team/invite-dialog';
import { TeamFilters } from '@/components/team/team-filters';
import { TeamRowActions } from '@/components/team/team-row-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { getEntitlements, getMembers, getPendingInvitations } from '@/lib/api/server';
import { formatDate, initials } from '@/lib/format';
import { canManageMembers, ROLE_LABELS } from '@/lib/roles';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Ekip' };

type Row =
  | {
      kind: 'member';
      key: string;
      membershipId: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      role: MembershipRole;
      active: boolean;
      date: string;
      self: boolean;
    }
  | {
      kind: 'invite';
      key: string;
      invitationId: string;
      email: string;
      role: MembershipRole;
      expired: boolean;
      date: string;
    };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PAGE_SIZES = ['10', '25', '50', '100', '1000'];

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = (one(sp['q']) ?? '').trim().slice(0, 100);
  const roleParam = one(sp['role']) ?? '';
  const statusParam = one(sp['status']) ?? '';
  const page = Math.max(1, Number(one(sp['page']) ?? 1) || 1);
  const pageSizeParam = one(sp['pageSize']) ?? '25';
  const pageSize = PAGE_SIZES.includes(pageSizeParam) ? pageSizeParam : '25';
  const { me, tenant } = await requireWorkspace(slug);
  const isAdmin = canManageMembers(tenant.role);
  const [members, entitlements, invitations] = await Promise.all([
    getMembers(tenant.id),
    getEntitlements(tenant.id),
    isAdmin ? getPendingInvitations(tenant.id) : Promise.resolve([]),
  ]);
  const seatsFull =
    entitlements.usedSeats + entitlements.pendingInvitations >= entitlements.maxSeats;
  const now = Date.now();

  const all: Row[] = [
    ...members.map<Row>((m) => ({
      kind: 'member',
      key: `m-${m.membershipId}`,
      membershipId: m.membershipId,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      active: m.status === 'ACTIVE',
      date: m.joinedAt,
      self: m.user.id === me.user.id,
    })),
    ...invitations.map<Row>((inv) => ({
      kind: 'invite',
      key: `i-${inv.id}`,
      invitationId: inv.id,
      email: inv.email,
      role: inv.role,
      expired: new Date(inv.expiresAt).getTime() < now,
      date: inv.expiresAt,
    })),
  ];

  const needle = q.toLocaleLowerCase('tr-TR');
  const filtered = all.filter((r) => {
    const name = r.kind === 'member' ? r.name : '';
    if (needle && !`${name} ${r.email}`.toLocaleLowerCase('tr-TR').includes(needle)) return false;
    if (roleParam && r.role !== roleParam) return false;
    if (statusParam === 'active') return r.kind === 'member' && r.active;
    if (statusParam === 'inactive') return r.kind === 'member' ? !r.active : r.expired;
    if (statusParam === 'pending') return r.kind === 'invite' && !r.expired;
    return true;
  });
  const size = Number(pageSize);
  const rows = pageSize === '1000' ? filtered : filtered.slice((page - 1) * size, page * size);
  const pageHref = (n: number, sz: string) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (roleParam) p.set('role', roleParam);
    if (statusParam) p.set('status', statusParam);
    if (sz !== '25') p.set('pageSize', sz);
    if (n > 1) p.set('page', String(n));
    const s = p.toString();
    return s ? `/w/${tenant.slug}/team?${s}` : `/w/${tenant.slug}/team`;
  };

  const columns: DataColumn<Row>[] = [
    {
      id: 'person',
      header: 'Kişi',
      cell: (r) =>
        r.kind === 'member' ? (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt="" />}
              <AvatarFallback>{initials(r.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">
                {r.name}
                {r.self && <span className="font-normal text-muted-foreground"> (siz)</span>}
              </span>
              <span className="truncate text-xs text-muted-foreground">{r.email}</span>
            </div>
          </div>
        ) : (
          <span className="truncate font-medium">{r.email}</span>
        ),
    },
    {
      id: 'role',
      header: 'Rol',
      cell: (r) => <Badge variant="outline">{ROLE_LABELS[r.role]}</Badge>,
    },
    {
      id: 'status',
      header: 'Durum',
      cell: (r) =>
        r.kind === 'member' ? (
          r.active ? (
            <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Aktif</Badge>
          ) : (
            <Badge variant="outline">Pasif</Badge>
          )
        ) : r.expired ? (
          <Badge variant="outline">Pasif</Badge>
        ) : (
          <Badge variant="secondary">Bekliyor</Badge>
        ),
    },
    {
      id: 'date',
      header: 'Tarih',
      hideBelow: 'md',
      cell: (r) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {r.kind === 'member'
            ? `Katıldı ${formatDate(r.date)}`
            : `Son geçerlilik ${formatDate(r.date)}`}
        </span>
      ),
    },
  ];

  if (isAdmin) {
    columns.push({
      id: 'actions',
      header: 'Aksiyon',
      align: 'right',
      width: '1%',
      cell: (r) =>
        r.kind === 'member' && r.self ? (
          <span
            className="inline-flex size-8 items-center justify-center text-muted-foreground/40"
            title="Kendi üyeliğiniz için işlem yok"
          >
            <EllipsisIcon className="size-4" aria-hidden />
          </span>
        ) : r.kind === 'member' ? (
          <TeamRowActions
            kind="member"
            tenantId={tenant.id}
            membershipId={r.membershipId}
            name={r.name}
            role={r.role}
            active={r.active}
          />
        ) : (
          <TeamRowActions
            kind="invite"
            tenantId={tenant.id}
            invitationId={r.invitationId}
            email={r.email}
          />
        ),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">Ekip</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} üye · {tenant.name}
          </p>
        </div>
        {isAdmin && <InviteDialog tenantId={tenant.id} seatsFull={seatsFull} />}
      </header>

      <DataTable
        label="Ekip"
        rows={rows}
        rowKey={(r) => r.key}
        columns={columns}
        toolbar={<TeamFilters q={q} role={roleParam} status={statusParam} />}
        pagination={{
          page,
          pageSize,
          total: filtered.length,
          pageSizes: PAGE_SIZES,
          defaultPageSize: '25',
          unit: 'kişi',
          pageHref,
        }}
        empty={
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Henüz üye yok.
          </p>
        }
      />
    </div>
  );
}
