'use client';

import type { MembershipRole } from '@app/shared';
import { EllipsisIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NativeSelect } from '@/components/ui/native-select';
import { apiDelete, apiPatch } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { ROLE_LABELS } from '@/lib/roles';

const ASSIGNABLE: Exclude<MembershipRole, 'OWNER'>[] = ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];

type Props =
  | {
      kind: 'member';
      tenantId: string;
      membershipId: string;
      name: string;
      role: MembershipRole;
      active: boolean;
    }
  | { kind: 'invite'; tenantId: string; invitationId: string; email: string };

/**
 * The "..." menu of one team row. Members: activate or deactivate, edit role, remove.
 * Invitations: delete (cancels the invite). Owners and yourself get no menu.
 */
export function TeamRowActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  if (props.kind === 'member' && props.role === 'OWNER') return null;

  const label = props.kind === 'member' ? props.name : props.email;

  async function run(req: () => Promise<{ ok: boolean; error?: unknown }>, success: string) {
    setBusy(true);
    const res = await req();
    setBusy(false);
    setAskDelete(false);
    if (!res.ok) return toast.error(errorMessage(res.error as never));
    toast.success(success);
    router.refresh();
  }

  async function toggleActive() {
    if (props.kind !== 'member') return;
    const next = props.active ? 'DISABLED' : 'ACTIVE';
    await run(
      () =>
        apiPatch(
          `/tenants/${props.tenantId}/members/${props.membershipId}/status`,
          { status: next },
          { tenantId: props.tenantId },
        ),
      props.active ? `${label} pasif yapıldı.` : `${label} aktif yapıldı.`,
    );
  }

  async function remove() {
    if (props.kind === 'member') {
      await run(
        () =>
          apiDelete(`/tenants/${props.tenantId}/members/${props.membershipId}`, {
            tenantId: props.tenantId,
          }),
        `${label} çıkarıldı.`,
      );
    } else {
      await run(
        () =>
          apiDelete(`/tenants/${props.tenantId}/invitations/${props.invitationId}`, {
            tenantId: props.tenantId,
          }),
        'Davet silindi.',
      );
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
          aria-label={`${label} işlemleri`}
          disabled={busy}
        >
          <EllipsisIcon className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {props.kind === 'member' && (
            <>
              <DropdownMenuItem onClick={() => void toggleActive()}>
                {props.active ? 'Pasif yap' : 'Aktif yap'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditing(true)}>Düzenle</DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => setAskDelete(true)}>
            Sil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && props.kind === 'member' && (
        <EditRoleDialog
          tenantId={props.tenantId}
          membershipId={props.membershipId}
          name={props.name}
          role={props.role}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={askDelete}
        title={props.kind === 'member' ? `${label} çıkarılsın mı?` : `${label} daveti silinsin mi?`}
        description={
          props.kind === 'member'
            ? 'Erişimi hemen kapanır. Daha sonra yeniden davet edilebilir.'
            : 'Davet iptal edilir, bağlantı artık çalışmaz.'
        }
        confirmLabel="Sil"
        destructive
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setAskDelete(false)}
      />
    </>
  );
}

function EditRoleDialog({
  tenantId,
  membershipId,
  name,
  role,
  onClose,
  onSaved,
}: {
  tenantId: string;
  membershipId: string;
  name: string;
  role: MembershipRole;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [next, setNext] = useState<Exclude<MembershipRole, 'OWNER'>>(
    role === 'OWNER' ? 'MEMBER' : role,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function save() {
    setBusy(true);
    const res = await apiPatch(
      `/tenants/${tenantId}/members/${membershipId}`,
      { role: next },
      { tenantId },
    );
    setBusy(false);
    if (!res.ok) return toast.error(errorMessage(res.error));
    toast.success(`${name} rolü güncellendi.`);
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-role-title"
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 id="edit-role-title" className="text-base font-semibold">
            {name} için rol
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Kapat"
            disabled={busy}
          >
            <XIcon aria-hidden />
          </Button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <NativeSelect
            aria-label="Rol"
            value={next}
            onChange={(e) => setNext(e.target.value as Exclude<MembershipRole, 'OWNER'>)}
            className="w-full"
          >
            {ASSIGNABLE.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={() => void save()} disabled={busy || next === role}>
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
