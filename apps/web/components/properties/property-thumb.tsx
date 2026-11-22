import { ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Signed storage URLs change every request, so Next's optimiser is bypassed. */
export function PropertyThumb({
  url,
  alt,
  className,
}: {
  url: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-md bg-muted', className)}>
      {url ? (
        <Image src={url} alt={alt} fill unoptimized sizes="96px" className="object-cover" />
      ) : (
        <div
          className="flex size-full items-center justify-center text-muted-foreground"
          aria-hidden
        >
          <ImageIcon className="size-4" />
        </div>
      )}
    </div>
  );
}
