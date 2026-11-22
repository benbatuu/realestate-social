'use client';

import type { NotificationPreference } from '@app/shared';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { apiGet, apiPut } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

/** Per-member switches for each notification kind. Personal to the signed-in member. */
export function NotificationPreferences({
  tenantId,
  showTeam,
}: {
  tenantId: string;
  /** Team notices (members joined, CRM failures, credits, plan) are for managers and above. */
  showTeam: boolean;
}) {
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [prefError, setPrefError] = useState<string | null>(null);

  const loadPrefs = useCallback(async () => {
    const res = await apiGet<NotificationPreference[]>('/notifications/preferences', { tenantId });
    if (!res.ok) {
      setPrefError(errorMessage(res.error));
      return;
    }
    setPrefError(null);
    setPrefs(res.data);
  }, [tenantId]);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  async function togglePref(p: NotificationPreference) {
    const next = !p.enabled;
    setPrefs((prev) => prev.map((x) => (x.kind === p.kind ? { ...x, enabled: next } : x)));
    const res = await apiPut(
      `/notifications/preferences/${p.kind}`,
      { enabled: next },
      { tenantId },
    );
    if (!res.ok) {
      toast.error(errorMessage(res.error));
      void loadPrefs();
      return;
    }
    toast.success(`${p.label}: ${next ? 'açık' : 'kapalı'}`);
  }

  return (
    <div className={showTeam ? 'grid items-start gap-4 md:grid-cols-2' : 'flex flex-col gap-4'}>
      <FormError message={prefError} />
      {(showTeam ? (['personal', 'team'] as const) : (['personal'] as const)).map((group) => {
        const rows = prefs.filter((p) => p.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group} className="flex flex-col divide-y rounded-lg border px-4">
            <p className="pt-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group === 'personal' ? 'Kişisel' : 'Ekip'}
            </p>
            {rows.map((p) => (
              <div key={p.kind} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm">{p.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={p.enabled}
                  aria-label={p.label}
                  onClick={() => void togglePref(p)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                    p.enabled ? 'bg-primary' : 'bg-muted-foreground/30',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block size-4 rounded-full bg-background shadow transition-transform',
                      p.enabled ? 'translate-x-4' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
