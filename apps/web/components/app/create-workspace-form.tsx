'use client';

import {
  type CreateTenantRequest,
  createTenantRequestSchema,
  type TenantSummary,
} from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CreateTenantRequest>({
    resolver: zodResolver(createTenantRequestSchema),
    defaultValues: { name: '' },
    mode: 'onSubmit',
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: CreateTenantRequest) {
    setFormError(null);
    const result = await apiPost<TenantSummary>('/tenants', values);
    if (!result.ok) {
      setFormError(errorMessage(result.error));
      return;
    }
    router.replace(`/w/${result.data.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormError message={formError} />
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="name">Ofis veya ekip adı</FieldLabel>
        <Input
          id="name"
          autoFocus
          placeholder="Örn. Kadıköy Gayrimenkul"
          aria-invalid={!!errors.name}
          {...form.register('name')}
        />
        <FieldError errors={[errors.name]} />
      </Field>

      <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Birkaç soru (isteğe bağlı)</legend>
        <Field>
          <FieldLabel htmlFor="sector">Sektörünüz</FieldLabel>
          <select id="sector" className={selectClass} {...form.register('sector')}>
            <option value="">Seçin</option>
            <option value="REAL_ESTATE_OFFICE">Emlak ofisi</option>
            <option value="INDEPENDENT_AGENT">Bağımsız danışman</option>
            <option value="DEVELOPER">Müteahhit / geliştirici</option>
            <option value="OTHER">Diğer</option>
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="teamSizeBand">Ekibinizde kaç kişi var?</FieldLabel>
          <select id="teamSizeBand" className={selectClass} {...form.register('teamSizeBand')}>
            <option value="">Seçin</option>
            <option value="1">Sadece ben</option>
            <option value="2-5">2–5 kişi</option>
            <option value="6-20">6–20 kişi</option>
            <option value="21+">21 ve üzeri</option>
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="expectedVideosPerMonth">
            Ayda kaç video üretmeyi düşünüyorsunuz?
          </FieldLabel>
          <Input
            id="expectedVideosPerMonth"
            type="number"
            min={0}
            max={10000}
            inputMode="numeric"
            {...form.register('expectedVideosPerMonth', {
              setValueAs: (v) => (v === '' ? undefined : Number(v)),
            })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="referralSource">Bizi nereden duydunuz?</FieldLabel>
          <select id="referralSource" className={selectClass} {...form.register('referralSource')}>
            <option value="">Seçin</option>
            <option value="SEARCH">Arama motoru</option>
            <option value="SOCIAL">Sosyal medya</option>
            <option value="REFERRAL">Tavsiye</option>
            <option value="EVENT">Etkinlik / fuar</option>
            <option value="OTHER">Diğer</option>
          </select>
          <FieldDescription>Bu bilgi ürünü geliştirmek için kullanılır.</FieldDescription>
        </Field>
      </fieldset>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Oluşturuluyor…' : 'Workspace oluştur'}
      </Button>
    </form>
  );
}
