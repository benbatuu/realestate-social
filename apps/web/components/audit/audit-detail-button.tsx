'use client';

import type { AuditLogResponse } from '@app/shared';
import { XIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { auditDetail, auditLabel, leadPredicate } from '@/lib/audit-labels';
import { formatDateTime } from '@/lib/format';

type Item = AuditLogResponse['items'][number];

/** "Detay" button for one audit row; opens a popup with the plain-language details. */
export function AuditDetailButton({ item, slug }: { item: Item; slug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Detay
      </Button>
      {open && <AuditDetailDialog item={item} slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}

function AuditDetailDialog({
  item,
  slug,
  onClose,
}: {
  item: Item;
  slug: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const details = auditDetail(item.metadata).split(' · ').filter(Boolean);
  const predicate = leadPredicate(item.action);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 id="audit-detail-title" className="text-base font-semibold">
            İşlem detayı
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Kapat">
            <XIcon aria-hidden />
          </Button>
        </div>
        <dl className="flex flex-col gap-4 overflow-y-auto p-5 text-sm">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">Ne oldu</dt>
            <dd className="font-medium">
              {item.actorName ?? 'Sistem'}{' '}
              {predicate && item.subject ? `${item.subject} ${predicate}` : auditLabel(item.action)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">Ne zaman</dt>
            <dd>{formatDateTime(item.createdAt)}</dd>
          </div>
          {item.subject && !predicate && (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Kayıt</dt>
              <dd>{item.subject}</dd>
            </div>
          )}
          {item.subjectId && (
            <div>
              <Link
                href={`/w/${slug}/leads/${item.subjectId}`}
                className="text-sm font-medium text-amber-600 underline underline-offset-4"
                onClick={onClose}
              >
                Lead sayfasını aç
              </Link>
            </div>
          )}
          {details.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <dt className="text-muted-foreground">Ayrıntılar</dt>
              <dd>
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
