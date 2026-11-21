'use client';

import type { ApiErrorBody, InvitationPreview, TenantSummary, User } from '@app/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { ROLE_LABELS } from '@/lib/roles';
import { FormError } from './form-error';

/** Survives the detour through login/register; cleared once the invitation is accepted. */
const STORAGE_KEY = 'pendingInvitationToken';

type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; error: ApiErrorBody }
  | { kind: 'ready'; token: string; preview: InvitationPreview };

function readToken(): string | null {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (fromHash) {
    sessionStorage.setItem(STORAGE_KEY, fromHash);
    // Drop the token from the address bar so it is not copied or bookmarked by accident.
    window.history.replaceState(null, '', window.location.pathname);
    return fromHash;
  }
  return sessionStorage.getItem(STORAGE_KEY);
}

export function InviteAccept({ user }: { user: User | null }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setState({ kind: 'missing' });
      return;
    }
    void apiPost<InvitationPreview>('/invitations/preview', { token }).then((res) =>
      setState(
        res.ok ? { kind: 'ready', token, preview: res.data } : { kind: 'error', error: res.error },
      ),
    );
  }, []);

  async function accept(token: string) {
    setAccepting(true);
    setAcceptError(null);
    const res = await apiPost<TenantSummary>('/invitations/accept', { token });
    if (!res.ok) {
      setAccepting(false);
      setAcceptError(errorMessage(res.error));
      return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
    router.replace(`/w/${res.data.slug}`);
    router.refresh();
  }

  if (state.kind === 'loading') {
    return (
      <Card aria-busy="true">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
      </Card>
    );
  }

  if (state.kind !== 'ready' || state.preview.state !== 'valid') {
    const message =
      state.kind === 'ready'
        ? state.preview.state === 'used'
          ? 'Bu davet daha önce kullanılmış.'
          : 'Bu davetin süresi dolmuş. Workspace yöneticisinden yeni bir davet isteyin.'
        : state.kind === 'missing'
          ? 'Davet linki eksik. Size gönderilen linkin tamamını açın.'
          : errorMessage(state.error);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Davet açılamadı</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/" className={buttonVariants({ variant: 'outline' })}>
            Ana sayfaya git
          </Link>
        </CardFooter>
      </Card>
    );
  }

  const { preview, token } = state;
  const emailMatches = user?.email === preview.email;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{preview.tenantName}</CardTitle>
        <CardDescription>
          <span className="font-medium text-foreground">{preview.email}</span> adresi{' '}
          <span className="font-medium text-foreground">{ROLE_LABELS[preview.role]}</span> rolüyle
          bu workspace&apos;e davet edildi.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FormError message={acceptError} />
        {!user && (
          <p className="text-sm text-muted-foreground">
            Katılmak için bu e-posta adresiyle hesap oluşturun ya da giriş yapın.
          </p>
        )}
        {user && !emailMatches && (
          <p className="text-sm text-muted-foreground">
            Şu an <span className="font-medium text-foreground">{user.email}</span> olarak giriş
            yaptınız. Daveti kabul etmek için davet edilen adresle giriş yapın.
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        {!user && (
          <>
            <Link
              href="/register?next=/invite"
              className={buttonVariants({ className: 'w-full sm:w-auto' })}
            >
              Hesap oluştur
            </Link>
            <Link
              href="/login?next=/invite"
              className={buttonVariants({ variant: 'outline', className: 'w-full sm:w-auto' })}
            >
              Giriş yap
            </Link>
          </>
        )}
        {user && emailMatches && (
          <Button onClick={() => accept(token)} disabled={accepting} className="w-full sm:w-auto">
            {accepting ? 'Katılınıyor…' : `${preview.tenantName} workspace'ine katıl`}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
