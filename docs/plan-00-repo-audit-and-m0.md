# Repo denetimi ve Milestone 0 planı

> Tarih: 21 Kasım 2026 · Kaynak: `product-architecture-blueprint.md` §0 "İlk Claude görevi"
> Durum: **M0 tamamlandı (21 Kasım 2026).** Plandan sapmalar aşağıdaki "M0 sonucu" bölümünde.

## 1. Mevcut durum (§0 raporu)

| Başlık                  | Bulgu                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Klasör yapısı           | Yalnızca `product-architecture-blueprint.md`. Uygulama kodu yok, git repo yok. → Greenfield.                           |
| Runtime                 | Node **v23.5.0** (tek sayılı, LTS değil). Bun 1.4.4 da kurulu.                                                         |
| Package manager         | pnpm 10.33.0, npm 11.1.0, yarn 1.22.22 kurulu. Lockfile yok.                                                           |
| DB / migration          | Yok. Homebrew'de `psql` 16.15 ve `redis-server` 8.2.2 ikilileri var; servislerin çalışıp çalışmadığı kontrol edilmedi. |
| Docker                  | Docker 29.3.0 daemon çalışıyor, Compose v5.1.0 mevcut.                                                                 |
| FFmpeg                  | 8.0.1 kurulu (render worker için).                                                                                     |
| Test / lint / typecheck | Hiçbiri yok.                                                                                                           |
| Eksik modüller          | Tamamı (aşağıdaki milestone tablosuna bakın).                                                                          |

`npm view` ile bugün görülen güncel sürümler (M0'da **kesin sabitlenecek**, bellekten değil):
next 16.4.6 · react 19.3.1 · @nestjs/core 12.6.0 · @nestjs/bullmq 12.0.2 · bullmq 6.7.8 · remotion / @remotion/renderer 4.0.545 · typescript 7.0.2 · zod 4.6.7 · tailwindcss 4.3.5 · vitest 5.1.1.
**Dikkat:** `prisma` için `latest` etiketi `8.0.0-rc.34` döndürdü; M0'da son **stable** sürüm (`npm view prisma versions`) seçilip sabitlenecek, RC kullanılmayacak.

## 2. Verilen kararlar (itiraz edilebilir)

1. **Sıralama: §18 izlenir, §16 değil.** §16 CRM adapter'ı M3'e (kredilerden önce) koyuyor; §18 ise kredi domain'ini 7. adıma, CRM adapter'ı en sona (17) koyuyor. LeadPilot API kapsamı doğrulanmadığı ve CSV import veri yolunu zaten karşıladığı için §18 sırası seçildi. LeadPilot, API erişimi doğrulandığında paralel bir iş olarak öne çekilebilir.
2. **Repo düzeni: pnpm workspace, minimum paket.**
   ```text
   apps/web        Next.js App Router (UI)
   apps/api        NestJS — API + worker aynı kod tabanı, ayrı entrypoint (§8.3)
                   src/main.ts (HTTP) · src/worker.ts (BullMQ worker'ları)
   packages/shared Paylaşılan TS tipleri + Zod şemaları (API sözleşmesi, manifest şeması)
   ```
   Remotion composition'ları ilk sürümde `apps/api/src/rendering/compositions` altında kalır; ayrı paket gerekirse M5'te ayrılır. Daha fazla paket ayrımı yapılmaz (§18.2).
3. **Node sürümü:** en güncel **LTS** sürüm `.nvmrc` + `engines` ile sabitlenir (v23 kullanılmaz). Kesin sürüm M0'da `nodejs.org` LTS listesinden alınır.
4. **Validation:** API'de tek yaklaşım — **Zod** (shared paketteki şemalar hem web hem api tarafından kullanılır; class-validator eklenmez, §8.2).
5. **Test:** Vitest (unit/integration), Playwright (E2E, M1'den itibaren). Integration testleri docker compose servislerine karşı koşar.
6. **Lokal servisler:** Homebrew servisleri yerine `docker compose` — Postgres 16, Redis, SeaweedFS (S3 uyumlu; MinIO imajları çekilemedi, ADR 0006). Böylece CI ile aynı ortam.
7. **Marka adı:** Paket kapsamı nötr: `@app/web`, `@app/api`, `@app/shared`. UI'da marka metni tek bir config sabitinden okunur.

## 3. Milestone 0 — dosya bazlı plan

**Amaç:** Çalışan iskelet, tek komutla ayağa kalkan lokal ortam, yeşil lint/typecheck/test pipeline'ı. İş mantığı yok.

```text
.
├── .nvmrc                         LTS Node sürümü
├── .gitignore                     node_modules, .env*, dist, .next, coverage, storage dump
├── .editorconfig
├── .env.example                   §18'deki değişkenler — yalnız placeholder
├── package.json                   root scriptler: dev, build, lint, typecheck, test, db:*
├── pnpm-workspace.yaml
├── tsconfig.base.json             strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├── eslint.config.mjs              flat config; no-explicit-any = error
├── .prettierrc
├── docker-compose.yml             postgres, redis, storage (SeaweedFS S3)
├── README.md                      kurulum, komutlar, mimari özet, mock vs gerçek provider ayrımı
├── docs/adr/
│   ├── 0001-modular-monolith-and-workers.md
│   ├── 0002-repo-layout-pnpm-workspace.md
│   ├── 0003-zod-single-validation-layer.md
│   ├── 0004-credit-ledger-reservation-model.md   (M4 öncesi taslak)
│   └── 0005-provider-adapter-boundary.md
├── packages/shared/
│   ├── package.json · tsconfig.json
│   └── src/index.ts               boş export + örnek Zod şeması (health response)
├── apps/api/
│   ├── package.json · tsconfig.json · nest-cli.json
│   ├── prisma/schema.prisma       yalnızca datasource/generator (+ boş ilk migration)
│   ├── src/main.ts                HTTP bootstrap, /api/v1 prefix, OpenAPI
│   ├── src/worker.ts              BullMQ worker bootstrap (örnek no-op queue)
│   ├── src/app.module.ts
│   ├── src/config/                env şeması (Zod ile doğrulanır; eksik env'de fail-fast)
│   ├── src/common/logging/        yapılandırılmış logger + correlation ID + secret/PII redaction
│   ├── src/health/                GET /api/v1/health → DB + Redis + storage ping
│   └── test/health.int.test.ts
└── apps/web/
    ├── package.json · tsconfig.json · next.config.ts
    ├── app/layout.tsx · app/page.tsx   health durumunu gösteren tek sayfa
    └── (Tailwind + shadcn/ui init)
```

**M0 kabul kriterleri**

- `docker compose up -d` → Postgres, Redis, storage sağlıklı.
- `pnpm install && pnpm db:migrate && pnpm dev` → web :3000, api :4000, worker çalışıyor.
- `GET /api/v1/health` üç bağımlılık için `ok` döndürüyor; web sayfası bunu gösteriyor.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` yeşil.
- `.env` git'e girmiyor; logger secret alanlarını maskeliyor (unit test ile).
- README'de tüm komutlar ve bilinen eksikler yazılı.

## 4. Sonraki milestone'lar (özet — detay planı her birinin başında yazılır)

Sıra §18'e göre. "Mock/Gerçek" sütunu kural 12 gereği provider durumunu gösterir.

| #     | Kapsam                                                                                                                                                                      | Çıkış kriteri                                                                       | Açtığı §15.3 testleri                 | Provider              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------- | --------------------- |
| M1    | Auth, Tenant, Membership/roller, Plan entitlement modeli, AuditLog, temel navigasyon                                                                                        | Tenant oluştur + davet; tenant izolasyonu testli                                    | 1, 13                                 | —                     |
| M2    | Canonical Property/PropertyAsset, CSV/XLSX import (eşleme, preview, duplicate, hata raporu), foto storage, liste/detay, data coverage                                       | CSV → liste/detay + coverage görünür; tekrar import duplicate üretmez               | 2, 3                                  | SeaweedFS (lokal)     |
| M3    | Kredi + ücretsiz yeniden üretim: ledger'lar, reserve/capture/refund, dönem reset, admin düzeltme. Ödeme sağlayıcısı yok, sadece arayüz                                      | §4.3 tablosu birebir testte; paralel istek çift tüketmez; bakiye ledger ile uzlaşır | (domain düzeyinde) 4, 6, 8, 9, 11, 12 | —                     |
| M4    | VideoProject/VideoGeneration domain, state machine, BullMQ flow, **mock** I2V/TTS/LLM/müzik adapter'ları, SSE progress                                                      | Mock pipeline uçtan uca, gerçek worker progress'i, hata → iade                      | 4, 5, 10, 12 (mock)                   | Mock                  |
| M5    | Remotion + FFmpeg render worker, 9:16 + 16:9, manifest şeması + versiyonlama                                                                                                | Mock kliplerle iki MP4, deterministik render                                        | 5                                     | Mock + gerçek render  |
| M6    | Gerçek provider'lar: tek I2V (fal/Kling v3 Pro aday), LLM structured output + fact validation, TTS (ElevenLabs aday), lisanslı müzik kataloğu, ProviderUsage maliyet ölçümü | Gerçek property'den 1–2 AI sahneli video, gerçek maliyet kayıtlı                    | 5 (gerçek)                            | **Gerçek**            |
| M7    | Tam regeneration + non-reuse testleri, retry/idempotency sertleştirme, video UI (üret/izle/indir/yeniden üret), admin maliyet sayfası                                       | Regeneration önceki yaratıcı asset'leri kullanmıyor (testli)                        | 6, 7, 8, 9, 11 (uçtan uca)            | Gerçek                |
| M8    | Analitik: lead–property ilişkisi, metrik agregasyonu, coverage/confidence, açıklamalı öneri skoru                                                                           | Açıklamalı öneri listesi; eksik veride hüküm yok                                    | —                                     | —                     |
| M9    | CRM adapter framework + LeadPilot (yalnızca doğrulanmış endpoint'ler)                                                                                                       | Gerçek sync veya belgelenmiş "API kapsamı yetersiz" kararı                          | —                                     | Gerçek (doğrulanırsa) |
| Sonra | Ödeme sağlayıcısı, pilot + fiyat doğrulaması (§16 M8), sosyal yayın (§16 M9)                                                                                                |                                                                                     |                                       |                       |

## 5. Açık kararlar (şimdi gerekmiyor, önerilen varsayılanla)

| Karar                               | Ne zaman gerekli | Önerilen varsayılan                                                                                    |
| ----------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| Auth yöntemi (§10.1 açık bırakıyor) | M1 başı          | E-posta + şifre (argon2) + davet linki, session cookie; harici IdP sonra                               |
| Ödeme sağlayıcısı (belgede adı yok) | M3 sonrası       | Arayüz arkasında; TL tahsilat için iyzico/PayTR vs. Stripe karşılaştırması ayrıca yapılır              |
| Object storage sağlayıcısı          | Deploy öncesi    | Lokal SeaweedFS; prod için R2 veya S3 (KVKK veri lokasyonu değerlendirmesiyle)                         |
| Remotion ticari lisansı             | M5 öncesi        | Şirket büyüklüğüne göre lisans gerekip gerekmediği kontrol edilir; render kodu adapter arkasında kalır |
| I2V model seçimi                    | M6 öncesi        | Kling v3 Pro + en az bir alternatif ile gerçek foto benchmark (§5.4)                                   |
| Müzik kataloğu                      | M6 öncesi        | Ticari kullanım/yeniden dağıtım lisansı belgelenmiş kütüphane                                          |

## 6. M0'a başlamak için gereken onay

- Yukarıdaki repo düzeni (pnpm workspace, 3 paket) ve §18 sıralaması.
- Bu klasörde `git init` yapılması.

## 7. M0 sonucu ve plandan sapmalar

Doğrulananlar (21 Kasım 2026, Node 24.22.3), yalnızca git'e girecek dosyalardan oluşan temiz bir kopyada:

- `pnpm install --frozen-lockfile` → `pnpm services:up` (Postgres, Redis, storage sağlıklı; bucket hazır).
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (shared 2, api 7 test; api'nin 3'ü gerçek servislere karşı entegrasyon), `pnpm build` yeşil.
- Çalışma kopyasında `pnpm dev` → web :3100, API :4100, worker; `GET /api/v1/health` 200, web "Tüm servisler çalışıyor" gösteriyor; API kapalıyken web hata durumunu gösteriyor. `pnpm db:migrate` çalışıyor (uygulanacak migration yok).

Sapmalar:

- **Node 24 LTS**, planda yazan "en güncel LTS" (26) değil: Node 24 ekosistemde (Prisma, SWC, ileride Remotion/FFmpeg araçları) daha uzun süredir test ediliyor. `engines` `>=24.11 <25`; 26'ya geçiş ayrı bir karar. Makinedeki Node 23'ü Prisma 7 desteklemiyor. Node 24 nvm ile kuruldu; nvm varsayılanı (26) değişmedi. `engine-strict` nedeniyle `pnpm` komutlarından önce `nvm use` gerekir.
- **TypeScript 6.0.x**, 7 değil: `typescript-eslint` henüz TS 7'yi desteklemiyor.
- **Prisma 7.10.1** (son stable); `latest` etiketi RC gösteriyordu.
- **SeaweedFS**, MinIO yerine (ADR 0006).
- **Portlar 3100/4100** (3000/4000 başka uygulamalarca kullanılıyordu); Docker portları 55432/56379/58333.
- **shadcn/ui** henüz kurulmadı; ilk gerçek ekranlarla M1'de eklenecek.
- İlk migration yok: model olmadığından Prisma "already in sync" diyor. İlk migration M1'de.
- `nest start --watch` (API ve worker) aynı `dist` klasörünü `deleteOutDir` ile paylaşıyor; açılışta nadiren yarış olabilir. Sorun görülürse dev için `deleteOutDir` kapatılacak.
- CI yok (uzak repo yok). README'deki komutlar CI'ın çalıştıracağı komutlardır.
