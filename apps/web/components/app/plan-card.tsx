import type { Entitlements } from '@app/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PlanCard({ entitlements }: { entitlements: Entitlements }) {
  const { planName, maxSeats, usedSeats, pendingInvitations } = entitlements;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Paket
          {planName ? (
            <Badge variant="secondary">{planName}</Badge>
          ) : (
            <Badge variant="outline">Paket yok</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {planName
            ? 'Kullanıcı koltukları paketinizden gelir.'
            : 'Aktif bir paketiniz olmadığı için yalnızca siz kullanabilirsiniz.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Kullanılan koltuk</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {usedSeats} / {maxSeats}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bekleyen davet</dt>
            <dd className="text-lg font-semibold tabular-nums">{pendingInvitations}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
