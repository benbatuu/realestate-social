import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { ImportWizard } from '@/components/properties/import-wizard';
import { canEditPortfolio } from '@/lib/roles';
import { requireWorkspace } from '../../workspace';

export const metadata: Metadata = { title: 'Portföy içe aktar' };

export default async function ImportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireWorkspace(slug);
  if (!canEditPortfolio(tenant.role)) notFound();
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/w/${tenant.slug}/properties`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        Portföy
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Portföy içe aktar</h1>
      <ImportWizard tenantId={tenant.id} slug={tenant.slug} />
    </div>
  );
}
