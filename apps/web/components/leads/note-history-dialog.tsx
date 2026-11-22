'use client';

import type { LeadNoteHistory } from '@app/shared';
import { XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Every text a note has had: the current one first, then each earlier version. */
export function NoteHistoryDialog({
  tenantId,
  leadId,
  noteId,
  onClose,
}: {
  tenantId: string;
  leadId: string;
  noteId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<LeadNoteHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    void apiGet<LeadNoteHistory>(`/leads/${leadId}/notes/${noteId}/history`, { tenantId }).then(
      (res) => {
        if (res.ok) setData(res.data);
        else setError(errorMessage(res.error));
      },
    );
  }, [leadId, noteId, tenantId]);

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
        aria-labelledby="note-history-title"
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 id="note-history-title" className="text-base font-semibold">
            Not geçmişi
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Kapat">
            <XIcon aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <FormError message={error} />
          {!data && !error && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
          {data && (
            <>
              <Version
                badge="Şu an"
                body={data.current.body}
                who={data.current.authorName}
                when={data.current.writtenAt}
                current
              />
              {data.revisions.map((r) => (
                <Version
                  key={`${r.writtenAt}-${r.replacedAt}`}
                  badge="Önceki"
                  body={r.body}
                  who={r.authorName}
                  when={r.writtenAt}
                  replacedBy={r.replacedByName}
                  replacedAt={r.replacedAt}
                />
              ))}
              {data.revisions.length === 0 && (
                <p className="text-sm text-muted-foreground">Bu not henüz düzenlenmemiş.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Version({
  badge,
  body,
  who,
  when,
  current = false,
  replacedBy,
  replacedAt,
}: {
  badge: string;
  body: string;
  who: string | null;
  when: string;
  current?: boolean;
  replacedBy?: string | null;
  replacedAt?: string;
}) {
  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-4',
        current && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-medium',
            current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {badge}
        </span>
        <span className="text-muted-foreground">
          {who ?? 'Bilinmeyen'} yazdı · {formatDateTime(when)}
        </span>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-line">{body}</p>
      {replacedAt && (
        <p className="text-xs text-muted-foreground">
          {replacedBy ?? 'Bilinmeyen'} tarafından {formatDateTime(replacedAt)} tarihinde
          değiştirildi
        </p>
      )}
    </article>
  );
}
