'use client';

import type { MeResponse } from '@app/shared';
import { ImageIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { apiDelete, apiUpload } from '@/lib/api/client';
import { errorMessage } from '@/lib/errors';
import { initials } from '@/lib/format';

const MAX_BYTES = 5 * 1024 * 1024;

/** Profile picture. Shown in the top bar and on this page. Server crops it to a square. */
export function AvatarUploader({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error('Dosya 5 MB’dan büyük olamaz.');
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    const res = await apiUpload<MeResponse>('/auth/me/avatar', form);
    setBusy(false);
    if (!res.ok) return toast.error(errorMessage(res.error));
    toast.success('Profil fotoğrafı güncellendi.');
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await apiDelete('/auth/me/avatar');
    setBusy(false);
    if (!res.ok) return toast.error(errorMessage(res.error));
    toast.success('Profil fotoğrafı kaldırıldı.');
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Avatar className="size-24">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={`${name} profil fotoğrafı`} />}
        <AvatarFallback className="text-xl">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <UploadIcon aria-hidden />
            {avatarUrl ? 'Değiştir' : 'Fotoğraf yükle'}
          </Button>
          {avatarUrl && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
              <Trash2Icon aria-hidden />
              Kaldır
            </Button>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon className="size-3.5" aria-hidden />
          JPEG, PNG veya WebP · en fazla 5 MB · kare kırpılır
        </p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          aria-label="Profil fotoğrafı seç"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
