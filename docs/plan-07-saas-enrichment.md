# SaaS zenginleştirme (kayıt, şirket profili, uyum, dışa aktarma)

## Eklenenler

**Kayıt ve onboarding**

- Kayıtta kullanım koşulları ve KVKK aydınlatma onayı zorunlu. Pazarlama onayı isteğe bağlı. Her onay sürümü ve zamanıyla kaydedilir (`ConsentRecord`).
- Workspace oluştururken: sektör, ekip büyüklüğü, nasıl duydunuz, aylık tahmini video sayısı.

**Şirket profili (workspace, yalnız yönetici)**

- Ticari unvan, vergi dairesi, vergi numarası, telefon, web sitesi, adres (il, ilçe, açık adres), saat dilimi.

**Kişisel profil**

- Ad, unvan, telefon. E-posta sabit kalır.

**Uyum (KVKK)**

- Verilerimi indir: kullanıcının kendi verisi JSON olarak.
- Hesap silme talebi: talep kaydedilir, silme işlemi ekip tarafından yapılır (kayıt tutulur).
- Denetim kaydı görünümü (yönetici): kim, ne zaman, ne yaptı. E-posta ve token yok.

**Operasyon**

- Mülk listesini CSV olarak dışa aktarma.
- Dashboard: mülk sayısı, bu ayki video, bekleyen içe aktarma, kalan kredi, son hareketler.

## Sınırlar

- Davet e-postası, e-posta doğrulama, şifre sıfırlama, ödeme: dış servis gerekiyor, bu turda yok.
- Hesap silme gerçek silme değil, talep. Yasal saklama süreleri hukuk onayıyla netleşecek.
