import { PRODUCT_DISPLAY_NAME } from '@app/shared';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-12">
      <p className="text-sm font-medium tracking-tight text-muted-foreground">
        {PRODUCT_DISPLAY_NAME}
      </p>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
