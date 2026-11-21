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

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CreateTenantRequest>({
    resolver: zodResolver(createTenantRequestSchema),
    defaultValues: { name: '' },
    // Validate on submit, then live: blur validation shifted the layout under the pointer.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
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
        <FieldDescription>Daha sonra değiştirebilirsiniz.</FieldDescription>
        <FieldError errors={[errors.name]} />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Oluşturuluyor…' : 'Workspace oluştur'}
      </Button>
    </form>
  );
}
