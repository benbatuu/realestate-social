'use client';

import {
  type CreateInvitationRequest,
  createInvitationRequestSchema,
  type CreateInvitationResponse,
} from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { ROLE_LABELS } from '@/lib/roles';

const INVITABLE = ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] as const;

export function InviteForm({ tenantId, seatsFull }: { tenantId: string; seatsFull: boolean }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useForm<CreateInvitationRequest>({
    resolver: zodResolver(createInvitationRequestSchema),
    defaultValues: { email: '', role: 'MEMBER' },
    // Validate on submit, then live: blur validation shifted the layout under the pointer.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: CreateInvitationRequest) {
    setFormError(null);
    const result = await apiPost<CreateInvitationResponse>(
      `/tenants/${tenantId}/invitations`,
      values,
    );
    if (!result.ok) {
      setFormError(errorMessage(result.error));
      return;
    }
    setCreated({ email: result.data.invitation.email, url: result.data.acceptUrl });
    setCopied(false);
    form.reset({ email: '', role: values.role });
    router.refresh();
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      toast.error('Kopyalanamadı. Linki seçip elle kopyalayın.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-start"
      >
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="invite-email">E-posta</FieldLabel>
          <Input
            id="invite-email"
            type="email"
            placeholder="danisman@ofis.com"
            aria-invalid={!!errors.email}
            {...form.register('email')}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="invite-role">Rol</FieldLabel>
          <select
            id="invite-role"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            {...form.register('role')}
          >
            {INVITABLE.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" disabled={isSubmitting || seatsFull} className="sm:mt-[1.375rem]">
          {isSubmitting ? 'Oluşturuluyor…' : 'Davet oluştur'}
        </Button>
      </form>
      {seatsFull && (
        <p className="text-sm text-muted-foreground">
          Paketinizdeki koltuklar dolu. Yeni kişi eklemek için paketinizi yükseltin.
        </p>
      )}
      <FormError message={formError} />
      {created && (
        <div
          className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4"
          data-testid="invite-link"
        >
          <p className="text-sm font-medium">{created.email} için davet linki hazır</p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={created.url}
              aria-label="Davet linki"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button type="button" variant="outline" onClick={copy}>
              {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
              {copied ? 'Kopyalandı' : 'Kopyala'}
            </Button>
          </div>
          <FieldDescription>
            E-posta gönderimi henüz yok: linki kişiyle kendiniz paylaşın. Link 7 gün geçerli ve tek
            kullanımlık; bu ekranı kapattıktan sonra tekrar gösterilmez.
          </FieldDescription>
        </div>
      )}
    </div>
  );
}
