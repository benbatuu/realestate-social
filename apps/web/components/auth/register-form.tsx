'use client';

import { type MeResponse, type RegisterRequest, registerRequestSchema } from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { FormError } from './form-error';

export function RegisterForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      acceptTerms: true,
      marketingConsent: false,
    },
    mode: 'onSubmit',
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: RegisterRequest) {
    setFormError(null);
    const result = await apiPost<MeResponse>('/auth/register', values);
    if (!result.ok) {
      setFormError(errorMessage(result.error));
      return;
    }
    router.replace(next ?? '/onboarding');
    router.refresh();
  }

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormError message={formError} />
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Ad soyad</FieldLabel>
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            aria-invalid={!!errors.name}
            {...form.register('name')}
          />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">E-posta</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
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
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...form.register('password')}
          />
          <FieldDescription>En az 10 karakter.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>

      <div className="flex flex-col gap-3 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            aria-invalid={!!errors.acceptTerms}
            {...form.register('acceptTerms')}
          />
          <span>
            <Link href="/terms" className="underline underline-offset-4">
              Kullanım koşulları
            </Link>
            ’nı ve{' '}
            <Link href="/privacy" className="underline underline-offset-4">
              aydınlatma metnini
            </Link>{' '}
            okudum, kabul ediyorum.
          </span>
        </label>
        <FieldError errors={[errors.acceptTerms]} />
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" {...form.register('marketingConsent')} />
          <span className="text-muted-foreground">
            Ürün haberleri ve kampanyalar için e-posta almak istiyorum. (İsteğe bağlı)
          </span>
        </label>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Hesap oluşturuluyor…' : 'Hesap oluştur'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Zaten hesabınız var mı?{' '}
        <Link
          href={loginHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Giriş yapın
        </Link>
      </p>
    </form>
  );
}
