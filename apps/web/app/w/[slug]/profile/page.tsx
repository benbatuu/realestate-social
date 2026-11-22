import type { Metadata } from 'next';
import { AvatarUploader } from '@/components/account/avatar-uploader';
import { DataActions } from '@/components/account/data-actions';
import { PasswordForm } from '@/components/account/password-form';
import { ProfileForm } from '@/components/account/profile-form';
import { SectionCard } from '@/components/app/section-card';
import { getOpenDeletion } from '@/lib/api/server';
import { requireWorkspace } from '../workspace';

export const metadata: Metadata = { title: 'Profil' };

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { me } = await requireWorkspace(slug);
  const openDeletion = await getOpenDeletion();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
        <p className="text-sm text-muted-foreground">Ekipte görünen bilgileriniz.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="Profil fotoğrafı"
          description="Ekip listesinde ve bildirimlerde görünür."
        >
          <AvatarUploader name={me.user.name} avatarUrl={me.user.avatarUrl} />
        </SectionCard>

        <SectionCard
          title="Kişisel bilgiler"
          description="E-posta adresi giriş bilginizdir ve burada değiştirilemez."
          className="lg:col-span-2"
        >
          <ProfileForm
            name={me.user.name}
            email={me.user.email}
            phone={me.user.phone}
            jobTitle={me.user.jobTitle}
          />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="Şifre"
          description="Şifreyi değiştirince diğer cihazlardaki oturumlar kapanır."
        >
          <PasswordForm />
        </SectionCard>

        <SectionCard
          title="Verileriniz"
          description="KVKK kapsamındaki haklarınız."
          className="lg:col-span-2"
        >
          <DataActions openDeletion={openDeletion} />
        </SectionCard>
      </div>
    </div>
  );
}
