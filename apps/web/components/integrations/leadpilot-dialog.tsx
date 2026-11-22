'use client';

import type { IntegrationConnectResult } from '@app/shared';
import { CheckCircle2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { FormError } from '@/components/auth/form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';

/** Connects a LeadPilot workspace: address, connection id and signing secret from LeadPilot. */
export function LeadPilotDialog({
  tenantId,
  onClose,
  onDone,
}: {
  tenantId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('LeadPilot');
  const [baseUrl, setBaseUrl] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [signingSecret, setSigningSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    name.trim().length >= 2 &&
    baseUrl.trim().length >= 8 &&
    connectionId.trim().length > 0 &&
    signingSecret.trim().length >= 32;

  async function save() {
    setError(null);
    setSaving(true);
    const res = await apiPost<IntegrationConnectResult>(
      '/integrations/connections',
      {
        provider: 'LEADPILOT',
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        connectionId: connectionId.trim(),
        signingSecret: signingSecret.trim(),
      },
      { tenantId },
    );
    setSaving(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    if (res.data.test.ok) toast.success('LeadPilot bağlandı. Mülkler senkronize ediliyor.');
    else toast.warning(`Bağlantı kaydedildi ama doğrulanamadı: ${res.data.test.message}`);
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl"
      >
        <div className="flex flex-col gap-1">
          <h2 id="lp-title" className="text-base font-semibold">
            LeadPilot’a bağlan
          </h2>
          <p className="text-sm text-muted-foreground">
            LeadPilot’ta bu bağlantı için bir portföy akışı oluşturun; oradan gelen adresi, bağlantı
            kimliğini ve imza anahtarını buraya girin. İmza anahtarı yalnızca bir kez gösterilir ve
            şifrelenerek saklanır.
          </p>
        </div>
        <FormError message={error} />
        <div className="flex flex-col gap-4">
          <Field label="Bağlantı adı" htmlFor="lp-name">
            <Input
              id="lp-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="LeadPilot adresi" htmlFor="lp-url" hint="Örnek: https://crm.sirketiniz.com">
            <Input
              id="lp-url"
              value={baseUrl}
              placeholder="https://"
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </Field>
          <Field label="Bağlantı kimliği" htmlFor="lp-id">
            <Input
              id="lp-id"
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
            />
          </Field>
          <Field label="İmza anahtarı" htmlFor="lp-secret">
            <Input
              id="lp-secret"
              type="password"
              autoComplete="off"
              value={signingSecret}
              onChange={(e) => setSigningSecret(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={() => void save()} disabled={saving || !valid}>
            <CheckCircle2Icon aria-hidden />
            {saving ? 'Bağlanıyor…' : 'Bağlan'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
