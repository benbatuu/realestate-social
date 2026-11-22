'use client';

import { type ChangePasswordRequest, changePasswordRequestSchema } from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';

export function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordRequestSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
    mode: 'onSubmit',
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ChangePasswordRequest) {
    setError(null);
    const res = await apiPost<void>('/auth/password', values);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    toast.success('Şifre değiştirildi.');
    form.reset({ currentPassword: '', newPassword: '' });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormError message={error} />
      <Field data-invalid={!!errors.currentPassword}>
        <FieldLabel htmlFor="pw-current">Mevcut şifre</FieldLabel>
        <Input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.currentPassword}
          {...form.register('currentPassword')}
        />
        <FieldError errors={[errors.currentPassword]} />
      </Field>
      <Field data-invalid={!!errors.newPassword}>
        <FieldLabel htmlFor="pw-new">Yeni şifre</FieldLabel>
        <Input
          id="pw-new"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.newPassword}
          {...form.register('newPassword')}
        />
        <FieldError errors={[errors.newPassword]} />
      </Field>
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Değiştiriliyor…' : 'Şifreyi değiştir'}
        </Button>
      </div>
    </form>
  );
}
