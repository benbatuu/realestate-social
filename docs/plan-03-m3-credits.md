# Milestone 3 — Kredi ve ücretsiz yeniden üretim

> Blueprint: §4, §10.2, §10.4, §15.3 (#4, #6, #8–#12), §16 M3
> Durum: **Kod yazıldı, testler yazılmadı ve çalıştırılmadı** (kullanıcı isteği: testler şimdilik geç).

## Uygulama durumu

- Tamam: şema + migration `m3_credits`; `CreditsService` (dönem yükleme, rezerve, kesinleştir,
  iade, düzeltme, bakiye, defter); API `GET /credits`, `GET /credits/ledger` (MANAGER),
  `POST /credits/adjustments` (OWNER); dashboard kredi kartı.
- Tip kontrolü: api ve web yeşil.
- Kalan: §15.3 testleri (#4, #6, #8–#12, iade, idempotency, dönem sıfırlama, uzlaşma),
  defter sayfası, `VideoProject`/`VideoGeneration` için HTTP endpoint (M4 ile birlikte).
- Yönetici düzeltmesi yalnız OWNER; platform yöneticisi yok.
- Top-up (satın alma) yok: dönem sıfırlama top-up eklenince ayrılacak.

## Kapsam

**Var:** kredi hesabı ve append-only defter; ücretsiz yeniden üretim hesabı ve defteri; rezervasyon /
kesinleştirme / iade akışı; dönem başı hak yükleme ve dönem sonu sıfırlama; yönetici düzeltmesi
(gerekçeli, denetimli); bakiye ve defter okuma API'si; workspace kartında kalan kredi ve hak.

**Yok:** ödeme sağlayıcısı, top-up satın alma (faturalama milestone'u), gerçek video üretimi (M4).
Üretim M4'te bu servisi çağıracak; M3 yalnızca rezerve/kesinleştir/iade eden servisi ve testleri verir.

## Kararlar (varsayım — itiraz edilebilir)

1. **Kaynak plan.** Aylık kredi ve ücretsiz hak `Plan` kataloğundan gelir (`monthlyCredits`,
   `freeRegenerationAllowance`). Aktif abonelik yoksa 0 kredi; plansız workspace video üretemez.
2. **Dönem.** Hak yükleme `Subscription.currentPeriodStart` ile anahtarlanır. İdempotent: aynı
   dönem için ikinci yükleme yapılmaz (`idempotencyKey = grant:<periodStart>`). Yükleme
   tembel (lazy) yapılır: her rezervasyon öncesi dönem kontrol edilir. Ayrı zamanlayıcı yok.
3. **Sıfırlama, devir yok.** Dönem bitince kalan aylık kredi ve ücretsiz hak `EXPIRE` ile silinir
   (§4.7, "ilk sürümde rollover yok"). Top-up eklenince bu kural ayrılacak (faturalama milestone'u).
4. **Defter.** `CreditLedger.amount` yalnızca _kullanılabilir_ bakiyedeki değişimi tutar:
   GRANT +n, RESERVE −1, RELEASE/REFUND +1, CAPTURE 0 (rezervden tüketime), ADMIN ±n, EXPIRE −n.
   Uzlaşma: `Σ amount = available`; `reserved = açık rezervasyon sayısı`.
5. **Rezervasyon sırası.** Önce ücretsiz hak (koşul: havuz > 0 ve proje `freeRegenerationUsed = false`),
   yoksa 1 kredi. Proje hakkı koşullu `UPDATE … WHERE freeRegenerationUsed = false` ile talep edilir;
   iki paralel istekten yalnız biri kazanır (§15.3 #11). Kredi bakiyesi `WHERE available >= 1`
   ile atomik düşülür; sıfırda `INSUFFICIENT_CREDITS` (§15.3 #12).
6. **Kesinleştirme / iade.** Üretim başarılıysa `capture` (ücretsiz hak tüketilir, kredi rezervden
   çıkar). Sistem kaynaklı hata ise `release` (kredi ya da hak geri gelir, proje bayrağı sıfırlanır).
   Kullanıcının beğenmemesi iade sebebi değildir (§4.5).
7. **Idempotency.** Rezervasyon istemci anahtarı alır; `(tenantId, idempotencyKey)` benzersiz
   olduğundan tekrar gelen istek aynı üretimi döndürür, ikinci kez düşmez (§4.5).
8. **Yönetici düzeltmesi.** Yalnızca workspace OWNER'ı, zorunlu gerekçe ile. Bakiye negatife
   düşemez. Platform yöneticisi rolü henüz yok: bu bir boşluk, README'ye yazılacak.
9. **Video kaydı.** M3 minimal `VideoProject` (proje, `freeRegenerationUsed`, `generationCount`) ve
   `VideoGeneration` (durum, faturalama türü) tablolarını oluşturur; §10.4'ün alt kümesi. M4
   pipeline alanlarını ekler.

## Dilimler

1. Şema ve migration: CreditAccount, CreditLedger, FreeRegenerationAccount, FreeRegenerationLedger,
   VideoProject, VideoGeneration.
2. CreditsService: dönem yükleme, rezerve, kesinleştir, iade, sıfırlama, düzeltme (aynı transaction
   içinde defter + bakiye + denetim).
3. API: bakiye, defter (sayfalı), düzeltme (OWNER). Hata kodu `INSUFFICIENT_CREDITS`.
4. Testler: §15.3 #4, #6, #8–#12, iade ve idempotency, dönem sıfırlama, uzlaşma (Σ amount = bakiye).
5. Web: workspace genel bakışında kalan kredi/hak kartı; defter sayfası.

## Kabul kriterleri

- §4.3 tablosu birebir testte (10 kredi, 3 ücretsiz; üç proje senaryosu).
- Aynı projede ikinci yeniden üretim 1 kredi harcar; ücretsiz havuz bitince başka projenin ilk
  yeniden üretimi de 1 kredi harcar.
- İki paralel rezervasyon tek ücretsiz hakkı iki kez tüketmez; bakiye 0 iken üretim engellenir.
- İade sonrası bakiye ve hak öncekine döner; uzlaşma her adımda tutar.
- Dönem değişince kalan hak sıfırlanır, yeni dönem bir kez yüklenir.
- Her bakiye değişimi denetim kaydı taşır (kimlik ve sebep, gizli veri yok).

## Açık riskler

- Ücretsiz hak ve kredi sayılarının blueprint'teki hipotez paketler olduğu (§4.4) M3'te değişmez.
- Dönem sıfırlamanın gerçek fatura döngüsü ile hizalanması faturalama milestone'una kalır.
