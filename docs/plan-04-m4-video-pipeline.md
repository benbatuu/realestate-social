# Milestone 4 — Video pipeline dikey dilimi (mock sağlayıcılarla)

> Blueprint: §2.3, §3, §8.8, §12, §15.3 (#4, #5, #10, #12 mock), §16 M4
> Durum: **Uygulanıyor**

## Kapsam

**Var:** video projesi ve üretim başlatma (ilk üretim + yeniden üretim), durum makinesi (§2.3),
stage başına küçük BullMQ işleri ve DB'de durum, sağlayıcı arayüzleri + **mock** uygulamalar
(görüntü→video, LLM, TTS, müzik), sahne planı (süre politikasına göre), doğrulanmış mülk verisinden
senaryo (§3.6 kuralı), manifest, kredi kesinleştirme / iade, SSE ile ilerleme, sağlayıcı kullanım kaydı.

**Yok:** gerçek sağlayıcı çağrısı (M6), gerçek render (Remotion/FFmpeg, M5), web arayüzü (M7).
Çıktı dosyaları bu aşamada üretilmez; `isMock = true` ile işaretlenir ve asla gerçek video gibi sunulmaz.

## Kararlar

1. **Stage işleri.** Her aşama ayrı BullMQ işi (`jobId = <generationId>:<stage>`, idempotent).
   İş bitince bir sonrakini kuyruğa atar. Doğru kaynak DB'deki `stage`; iş yeniden denenirse
   tamamlanmış aşamalar atlanır.
2. **Dış çağrı idempotency.** Sahne başına `externalJobId` saklanır; var olan iş tekrar
   gönderilmez (§12.4).
3. **Hata sınıflandırması.** `ProviderError` (retryable bayrağı) ve iç hatalar. Retry edilebilir
   hata BullMQ ile geri çekilmeli; kalıcı hata ya da son deneme → `FAILED`, kredi iadesi.
4. **Hatalar kullanıcıya güvenli metinle.** `failureCode` (§12.4 listesi) + kısa Türkçe mesaj.
5. **Doğrulama önce.** Fotoğrafsız mülk ve kredisiz tenant üretim başlamadan reddedilir (§15.3 #12).
6. **Senaryo doğruluğu.** LLM (mock) yalnızca mülk snapshot'ından çalışır; üretilen metindeki her
   sayı snapshot'ta bulunmalı, yoksa `LLM_SCHEMA_INVALID` (§3.6, kural 7).
7. **Non-reuse.** Her üretim yeni sahne, yeni sağlayıcı işi ve yeni manifest üretir (§3.7).
   Testte iki üretimin dış iş kimlikleri kesişmez.
8. **Politika konfigürasyonu.** Süre ve sahne sayısı `video_generation_policy` (kod sabiti değil,
   `policy.ts` içinde tek kaynak; M8'de DB'ye taşınır).
9. **İlerleme.** SSE, DB'deki gerçek `stage` ve `progress` değerlerini yayar; sahte yüzde yok.
10. **Maliyet.** Mock sağlayıcı da `ProviderUsage` yazar (tahmini maliyet, mikro USD, `isMock`).

## Dilimler

1. Şema: VideoGeneration alanları, VideoScene, ProviderUsage; migration.
2. Politika + sağlayıcı arayüzleri + mock uygulamalar (hata enjeksiyonu ile).
3. Pipeline servisi ve stage işleyicisi (worker).
4. API: proje oluştur, yeniden üret, üretimi getir, SSE ilerleme.
5. Testler: uçtan uca mock, iade, yeniden üretim (non-reuse), kredi sıfırken engel.
