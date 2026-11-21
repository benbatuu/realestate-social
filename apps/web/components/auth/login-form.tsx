'use client';

import { type LoginRequest, loginRequestSchema, type MeResponse } from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { FormError } from './form-error';

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
    // Validate on submit, then live: blur validation shifted the layout under the pointer.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: LoginRequest) {
    setFormError(null);
    const result = await apiPost<MeResponse>('/auth/login', values);
    if (!result.ok) {
      setFormError(errorMessage(result.error));
      return;
    }
    router.replace(next ?? '/');
    router.refresh();
  }

  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : '/register';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormError message={formError} />
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">E-posta</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={!!errors.email}
            {...form.register('email')}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Şifre</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...form.register('password')}
          />
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Hesabınız yok mu?{' '}
        <Link
          href={registerHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Hesap oluşturun
        </Link>
      </p>
    </form>
  );
}
