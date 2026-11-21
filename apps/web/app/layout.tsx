import { PRODUCT_DISPLAY_NAME } from '@app/shared';
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import './globals.css';

// latin-ext covers Turkish characters (ş, ğ, ı, İ).
const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: PRODUCT_DISPLAY_NAME, template: `%s · ${PRODUCT_DISPLAY_NAME}` },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className={cn('font-sans', geist.variable)}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
