import { Skeleton } from '@/components/ui/skeleton';

export default function WorkspaceLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Yükleniyor">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
