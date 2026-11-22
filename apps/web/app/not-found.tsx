import { HomeIcon, SearchXIcon } from 'lucide-react';
import Link from 'next/link';
import { BackButton } from '@/components/app/back-button';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-muted/30">
      <header className="flex items-center gap-2 px-6 py-5">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
          P
        </span>
        <span className="text-sm font-semibold">Portfolio Studio</span>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border bg-card px-8 py-12 text-center shadow-sm">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <SearchXIcon className="size-6 text-muted-foreground" aria-hidden />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium tracking-widest text-muted-foreground">404</p>
            <h1 className="text-2xl font-semibold tracking-tight">Sayfa bulunamadı</h1>
            <p className="text-sm text-muted-foreground">
              Aradığınız sayfa ya da çalışma alanı yok, adresi değişmiş veya bu sayfaya erişiminiz
              yok.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/" className={buttonVariants()}>
              <HomeIcon aria-hidden />
              Ana sayfaya dön
            </Link>
            <BackButton />
          </div>

          <p className="text-xs text-muted-foreground">
            Bir ekip bağlantısıyla geldiyseniz yöneticinizden güncel bağlantıyı isteyin.
          </p>
        </div>
      </div>
    </main>
  );
}
