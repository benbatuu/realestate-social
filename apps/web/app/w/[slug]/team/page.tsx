import type { Metadata } from 'next';
import { PlanCard } from '@/components/app/plan-card';
import { InviteForm } from '@/components/team/invite-form';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getEntitlements, getMembers, getPendingInvitations } from '@/lib/api/server';
import { initials } from '@/lib/format';
import { canManageMembers, ROLE_LABELS } from '@/lib/roles';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Ekip' };

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeZone: 'Europe/Istanbul',
});

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { me, tenant } = await requireWorkspace(slug);
  const isAdmin = canManageMembers(tenant.role);
  const [members, entitlements, invitations] = await Promise.all([
    getMembers(tenant.id),
    getEntitlements(tenant.id),
    isAdmin ? getPendingInvitations(tenant.id) : Promise.resolve([]),
  ]);
  const seatsFull =
    entitlements.usedSeats + entitlements.pendingInvitations >= entitlements.maxSeats;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ekip</h1>
        <p className="text-sm text-muted-foreground">
          {members.length} üye · {tenant.name}
        </p>
      </header>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kişi davet et</CardTitle>
            <CardDescription>
              Davet edilen kişi bu e-posta adresiyle hesap açıp katılır.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm tenantId={tenant.id} seatsFull={seatsFull} />
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-base font-semibold">
          Üyeler
        </h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kişi</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="hidden sm:table-cell">Katılım</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.membershipId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback>{initials(m.user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {m.user.name}
                          {m.user.id === me.user.id && (
                            <span className="font-normal text-muted-foreground"> (siz)</span>
                          )}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {m.user.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.role === 'OWNER' ? 'default' : 'secondary'}>
                      {ROLE_LABELS[m.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {dateFormat.format(new Date(m.joinedAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {isAdmin && (
        <section className="flex flex-col gap-3" aria-labelledby="invites-heading">
          <h2 id="invites-heading" className="text-base font-semibold">
            Bekleyen davetler
          </h2>
          {invitations.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Bekleyen davet yok.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="hidden sm:table-cell">Son geçerlilik</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ROLE_LABELS[inv.role]}</Badge>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {dateFormat.format(new Date(inv.expiresAt))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}

      <PlanCard entitlements={entitlements} />
    </div>
  );
}
