import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Sayfa bulunamadı</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Aradığınız sayfa ya da workspace mevcut değil veya erişiminiz yok.
      </p>
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>
        Ana sayfaya dön
      </Link>
    </main>
  );
}
