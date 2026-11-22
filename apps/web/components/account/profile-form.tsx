'use client';

import { type UpdateProfileRequest, updateProfileRequestSchema } from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiPatch } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';

export function ProfileForm({
  name,
  email,
  phone,
  jobTitle,
}: {
  name: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<UpdateProfileRequest>({
    resolver: zodResolver(updateProfileRequestSchema),
    defaultValues: { name, phone, jobTitle },
    mode: 'onSubmit',
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  async function onSubmit(values: UpdateProfileRequest) {
    setError(null);
    const body = {
      name: values.name,
      phone: values.phone || null,
      jobTitle: values.jobTitle || null,
    };
    const res = await apiPatch('/auth/me', body);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    toast.success('Profil güncellendi.');
    form.reset(body);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="profile-name">Ad soyad</FieldLabel>
          <Input id="profile-name" aria-invalid={!!errors.name} {...form.register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-title">Unvan</FieldLabel>
          <Input
            id="profile-title"
            placeholder="Örn. Gayrimenkul danışmanı"
            {...form.register('jobTitle')}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-phone">Telefon</FieldLabel>
          <Input
            id="profile-phone"
            type="tel"
            autoComplete="tel"
            placeholder="05xx xxx xx xx"
            {...form.register('phone')}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-email">E-posta</FieldLabel>
          <Input id="profile-email" value={email} readOnly disabled />
        </Field>
      </div>
      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  );
}
