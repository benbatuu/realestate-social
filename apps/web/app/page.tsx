import { PRODUCT_DISPLAY_NAME, type DependencyName, type DependencyStatus } from '@app/shared';
import { connection } from 'next/server';
import { fetchHealth } from '@/lib/api';

const LABELS: Record<DependencyName, string> = {
  database: 'Veritabanı',
  redis: 'Kuyruk (Redis)',
  storage: 'Dosya deposu',
};

function StatusRow({ name, dep }: { name: DependencyName; dep: DependencyStatus }) {
  const ok = dep.status === 'ok';
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <span className="flex items-center gap-3">
        <span
          aria-hidden
          className={`size-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}
        />
        {LABELS[name]}
      </span>
      <span className="text-sm text-neutral-500 tabular-nums">
        {ok ? `${dep.latencyMs} ms` : (dep.error ?? 'Hata')}
      </span>
    </li>
  );
}

export default async function HomePage() {
  await connection();
  const result = await fetchHealth();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-neutral-500">{PRODUCT_DISPLAY_NAME}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Sistem durumu</h1>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white px-5 dark:border-neutral-800 dark:bg-neutral-900">
        {result.reachable ? (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {(Object.keys(LABELS) as DependencyName[]).map((name) => (
              <StatusRow key={name} name={name} dep={result.health.dependencies[name]} />
            ))}
          </ul>
        ) : (
          <div className="py-5 text-sm">
            <p className="font-medium text-red-600 dark:text-red-400">API&apos;ye ulaşılamıyor.</p>
            <p className="mt-1 text-neutral-500">
              <code>pnpm dev</code> çalışıyor mu? ({result.reason})
            </p>
          </div>
        )}
      </section>

      {result.reachable && (
        <p className="text-sm text-neutral-500">
          {result.health.status === 'ok'
            ? 'Tüm servisler çalışıyor.'
            : 'Bazı servisler yanıt vermiyor.'}{' '}
          Son kontrol: {new Date(result.health.checkedAt).toLocaleTimeString('tr-TR')}
        </p>
      )}
    </main>
  );
}
