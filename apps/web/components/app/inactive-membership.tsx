import Link from 'next/link';
import { PauseCircleIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

/** Shown instead of a workspace when the member's access has been paused by its admin. */
export function InactiveMembership({ workspaceName }: { workspaceName: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <PauseCircleIcon className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-xl font-semibold">Üyeliğiniz pasif</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{workspaceName}</span> workspace’inde
          erişiminiz şu an pasif. Erişimi yeniden açmak için workspace sahibi veya yöneticisine
          başvurun; onlar Ekip sayfasından üyeliğinizi aktif yapabilir.
        </p>
      </div>
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>
        Workspace’lerime dön
      </Link>
    </main>
  );
}
