'use client';

import {
  DELETION_GRACE_DAYS,
  DELETION_REASONS,
  type AccountDeletion,
  type DeletionRequest,
} from '@app/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

const REASON_LABEL: Record<(typeof DELETION_REASONS)[number], string> = {
  NOT_USING: 'Artık kullanmıyorum',
  TOO_EXPENSIVE: 'Fiyat bana uygun değil',
  MISSING_FEATURE: 'İhtiyacım olan özellik yok',
  SWITCHING_TOOL: 'Başka bir araca geçiyorum',
  PRIVACY_CONCERN: 'Veri gizliliği endişem var',
  OTHER: 'Diğer',
};

/**
 * Two steps, in our own dialog: why you leave, then what happens next. Nothing is deleted
 * during the grace period; the person can cancel at any time.
 */
export function DeletionWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<'reason' | 'confirm'>('reason');
  const [reason, setReason] = useState<DeletionRequest['reason'] | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const scheduled = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 3600 * 1000).toISOString();

  async function submit() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    const body: DeletionRequest = {
      reason,
      ...(detail.trim() ? { reasonDetail: detail.trim() } : {}),
    };
    const res = await apiPost<AccountDeletion>('/auth/data-requests', body);
    setBusy(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    toast.success('Hesap silme talebiniz alındı.');
    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deletion-title"
        className="flex max-h-full w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-xl border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'reason' ? (
          <>
            <div className="flex flex-col gap-1">
              <h2 id="deletion-title" className="text-base font-semibold">
                Hesabınızı neden kapatmak istiyorsunuz?
              </h2>
              <p className="text-sm text-muted-foreground">
                Bu bilgi ürünü geliştirmemize yardımcı olur. Seçim zorunlu.
              </p>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Sebep</legend>
              {DELETION_REASONS.map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm hover:bg-accent"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  {REASON_LABEL[r]}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="deletion-detail" className="text-sm font-medium">
                Eklemek istediğiniz bir şey var mı?{' '}
                <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
              </label>
              <textarea
                id="deletion-detail"
                rows={3}
                maxLength={500}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Vazgeç
              </Button>
              <Button onClick={() => setStep('confirm')} disabled={!reason}>
                Devam
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h2 id="deletion-title" className="text-base font-semibold">
                Hesabınız {DELETION_GRACE_DAYS} gün sonra silinecek
              </h2>
              <p className="text-sm text-muted-foreground">Silme tarihi: {formatDate(scheduled)}</p>
            </div>
            <ul className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
              <li>
                Bu süre içinde giriş yapabilir, kredilerinizi ve ücretsiz üretim haklarınızı
                kullanmaya devam edebilirsiniz.
              </li>
              <li>Ekranın üstündeki bildirimden talebi istediğiniz zaman iptal edebilirsiniz.</li>
              <li>Süre dolduğunda hesabınız kapanır, kişisel bilgileriniz anonimleştirilir.</li>
              <li>Ortak workspace’lerde sahip iseniz önce sahipliği devretmeniz gerekir.</li>
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('reason')} disabled={busy}>
                Geri
              </Button>
              <Button variant="destructive" onClick={submit} disabled={busy}>
                {busy ? 'Gönderiliyor…' : 'Talebi onayla'}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
