# Milestone 1 — Multi-tenant SaaS temeli

> Tarih: 21 Kasım 2026 · Blueprint: §10.1, §11.1, §13.1, §15.3 (#1, #13), §16 M1
> Durum: **Tamamlandı (21 Kasım 2026)** — sonuç en altta.

## Kapsam

**Var:** kayıt, giriş/çıkış, oturum, `me`; workspace (tenant) oluşturma ve listeleme; üyelik ve roller;
davet oluşturma ve kabul; üye listesi; plan kataloğu + abonelik tablosu + entitlement okuyucu;
audit log; web'de giriş/kayıt/onboarding/ekip ekranları ve temel navigasyon.

**Yok (bilinen eksik):** rol değiştirme, üye çıkarma, şifre sıfırlama, gerçek e-posta gönderimi,
kredi hesapları (kredi milestone'u), ödeme.

## Kararlar (varsayım — itiraz edilebilir)

1. **Self-servis kayıt.** Blueprint §11.1'de `register` yok; ilk kullanıcının girebilmesi için
   `POST /auth/register` eklendi. Davet edilen kişi de aynı yoldan hesap açar.
2. **Oturum:** sunucu tarafı oturum. Rastgele 32 bayt token httpOnly + `SameSite=Lax` cookie'de,
   veritabanında yalnızca SHA-256 hash'i. Süre 30 gün (config). Şifreler argon2id
   (`@node-rs/argon2`).
3. **Aynı origin:** Next.js `/api/v1/*` isteklerini API'ye rewrite eder. Tarayıcı tek origin
   görür, cookie paylaşımı ve CORS sorunu olmaz. CSRF: mutasyonlar yalnızca JSON kabul eder ve
   `Origin` başlığı `APP_URL` ile eşleşmelidir.
4. **Tenant çözümleme:** tenant'a bağlı tüm route'lar tenant'ı **`X-Tenant-Id` başlığından** veya
   (blueprint'in `/tenants/:tenantId/...` route'larında) path'ten alır. `TenantGuard` her istekte
   üyeliği veritabanından doğrular; üye olmayan **404** alır. Sonraki modüller
   (`/properties` vb.) bu guard'ı kullanır.
5. **Default-deny:** global auth guard; yalnızca `@Public()` işaretli route'lar (health, login,
   register, davet kabul/önizleme) oturumsuz çalışır.
6. **Roller:** `OWNER > ADMIN > MANAGER > MEMBER > VIEWER`. Davet: ADMIN ve üstü. OWNER rolü
   davetle verilemez.
7. **Plansız tenant:** blueprint ücretsiz deneme tanımlamıyor. Yeni tenant'a hangi planın
   atanacağı `SIGNUP_PLAN_CODE` config'i ile belirlenir; boşsa abonelik açılmaz ve tenant
   "plansız" limitlerle (1 koltuk) çalışır. `.env.example` dev için `starter` kullanır.
   Testler planı açıkça atar. Plan fiyatları §4.4'teki **hipotez** değerleridir.
8. **Davetler:** token yalnızca hash olarak saklanır, tek kullanımlık, 7 gün geçerli; kabul eden
   hesabın e-postası davet e-postasıyla aynı olmalı. Koltuk limiti davet anında ve kabul
   işleminin transaction'ı içinde tekrar kontrol edilir. E-posta servisi yok: davet linki
   oluşturan kişiye gösterilir (**mock teslimat**).
9. **Audit log:** değişiklikle aynı transaction'da, yalnızca ID'lerle (token/e-posta yok).
10. **Testler ayrı veritabanında:** `app_test` (aynı Postgres container'ı), BullMQ'da ortam
    önekli kuyruklar; çalışan `pnpm dev` testleri etkilemez.
11. **Giriş hata mesajı** bilinmeyen e-posta ve yanlış şifrede aynı. Login'e e-posta+IP bazlı
    throttle (in-memory; çoklu instance'ta Redis'e taşınacak).

## Dilimler

1. Test izolasyonu + Prisma modelleri (User, Session, Tenant, Membership, Invitation, Plan,
   Subscription, AuditLog) + plan seed.
2. register / login / logout / me + web giriş ve kayıt ekranları.
3. Tenant oluşturma/listeleme + uygulama kabuğu (navigasyon).
4. Davet / kabul / üye listesi + ekip ekranı.
5. E2E (#1) ve izolasyon testleri (#13), dokümantasyon.

## Kabul kriterleri

- §15.3 #1 ve #13 otomatik testlerle geçiyor (#13 her tenant route'u için).
- Eşzamanlı iki kabul son koltuğu iki kez dolduramıyor.
- Token'lar loglarda görünmüyor (test).
- lint, typecheck, test, build yeşil; OpenAPI'de yeni route'lar var; README güncel.

## Sonuç

Temiz bir kopyada (yalnızca git'e girecek dosyalar) doğrulandı: `pnpm install --frozen-lockfile`,
`services:up`, `db:deploy`, `db:seed`, `lint`, `format:check`, `typecheck`, `test`
(shared 2 + api 35), `build`, `test:e2e` (3) yeşil. Sonradan eklenen testlerle son durum:
api 38, E2E 4; lint/typecheck/build tekrar yeşil.

- §15.3 #1: API entegrasyon testi + Playwright E2E (kayıt → workspace → davet → ikinci tarayıcıda
  kayıt ve katılım).
- §15.3 #13: her tenant route'u için API testi (`test/isolation.int.test.ts`) + E2E (başka
  tenant'ın workspace sayfası 404).
- Eşzamanlı iki kabul son koltuğu iki kez dolduramıyor; aynı token paralel iki kez kabul
  edilemiyor; audit kayıtlarında e-posta ve token yok; istek loglarında gövde/header/query yok.

Uygulama sırasında E2E'nin yakaladığı iki hata düzeltildi: boş alandan ayrılınca çıkan doğrulama
mesajı sayfayı kaydırıp tıklamayı boşa düşürüyordu (formlar artık ilk gönderimde doğruluyor);
Ekip sayfası istemci modülünden bir fonksiyon çağırıyordu.

Ek doğrulamalar:

- OpenAPI dokümanında tüm M1 route'ları ve Zod'dan üretilen istek gövdeleri var (test).
- Next rewrite'ı istemci IP'sini iletiyor; login throttle istemci başına çalışıyor, proxy adresine
  göre değil (test + canlı deneme). Canlıda `TRUST_PROXY` ayarı gerekli (ADR 0007).
- E2E kendi derleme klasörlerini kullanıyor; `pnpm dev` açıkken de geçiyor.
- API kapalıyken giriş/onboarding/davet sayfaları hata ekranı gösteriyor.
- Açık yönlendirme yok: `next=//evil.example` yok sayılıyor (E2E).

Bilinen eksikler README'de ("Known gaps").
