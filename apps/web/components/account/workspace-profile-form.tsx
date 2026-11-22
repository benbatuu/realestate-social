'use client';

import type { TenantDetail } from '@app/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiPatch } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';

type Values = {
  name: string;
  legalName: string;
  taxOffice: string;
  taxNumber: string;
  phone: string;
  website: string;
  addressLine: string;
  city: string;
  district: string;
};

/** Company details. Empty text is sent as null (cleared). Tax number is checked by the server. */
export function WorkspaceProfileForm({ tenant }: { tenant: TenantDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const initial: Values = {
    name: tenant.name,
    legalName: tenant.legalName ?? '',
    taxOffice: tenant.taxOffice ?? '',
    taxNumber: tenant.taxNumber ?? '',
    phone: tenant.phone ?? '',
    website: tenant.website ?? '',
    addressLine: tenant.addressLine ?? '',
    city: tenant.city ?? '',
    district: tenant.district ?? '',
  };
  const form = useForm<Values>({ defaultValues: initial });
  const { isSubmitting, isDirty } = form.formState;

  async function onSubmit(values: Values) {
    setError(null);
    const body = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [
        k,
        k === 'name' ? v.trim() : v.trim() === '' ? null : v.trim(),
      ]),
    );
    const res = await apiPatch(`/tenants/${tenant.id}`, body, { tenantId: tenant.id });
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    toast.success('Şirket bilgileri kaydedildi.');
    form.reset(values);
    router.refresh();
  }

  const text = (id: keyof Values, label: string, placeholder?: string) => (
    <Field>
      <FieldLabel htmlFor={`ws-${id}`}>{label}</FieldLabel>
      <Input id={`ws-${id}`} placeholder={placeholder} {...form.register(id)} />
    </Field>
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormError message={error} />
      <div className="grid gap-4 md:grid-cols-2">
        {text('name', 'Workspace adı')}
        {text('legalName', 'Ticari unvan', 'Örn. Kadıköy Gayrimenkul Ltd. Şti.')}
        {text('taxOffice', 'Vergi dairesi')}
        {text('taxNumber', 'Vergi numarası', '10 veya 11 rakam')}
        {text('phone', 'Şirket telefonu')}
        {text('website', 'Web sitesi', 'https://')}
        {text('city', 'İl')}
        {text('district', 'İlçe')}
      </div>
      <Field>
        <FieldLabel htmlFor="ws-addressLine">Adres</FieldLabel>
        <Input id="ws-addressLine" {...form.register('addressLine')} />
      </Field>
      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  );
}
