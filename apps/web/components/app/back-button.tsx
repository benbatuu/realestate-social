'use client';

import { ArrowLeftIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/** Goes to the previous page; falls back to the home page when there is no history. */
export function BackButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
    >
      <ArrowLeftIcon aria-hidden />
      Geri dön
    </Button>
  );
}
