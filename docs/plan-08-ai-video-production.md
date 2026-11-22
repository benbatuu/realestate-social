# Plan 08 — Profesyonel AI video üretimi

> Durum: **Faz 1 kodu yazıldı (2026-11-23).** OpenRouter video ve LLM adaptörleri, harcama sigortası, klip önbelleği,
> yedek model ve fotoğraf hareketine düşme. Ücretli çağrı yapılmadı. M4, M5 ve M6 üzerine kurulur.
> Hedef: emlak ilanından, mekânı bozmayan, markalı, yayına hazır video. Video başına sahne sınırı yok;
> harcama sınırı yalnızca hesap genelinde (bütçe sigortası).

## Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Video modeli (ana) | Seedance 2.5 | Kasım 2026 image-to-video sıralamasında lider; mekân ve nesne sadakati en iyi |
| Video modeli (yedek) | Veo 3.1 Fast | Kling 3.0 OpenRouter'da yok (2026-11-23 listesi). Veo 3.1 Fast ilk kareden başlar, 1080p, sessiz 0,10 $/sn |
| Açılış sahnesi (deneme) | Veo 3.1 | En sinematik kamera hareketi; karşılaştırma testinde kazanırsa yalnızca dış cephe |
| Erişim | OpenRouter (tek anahtar: video + Claude) | Seedance 2.5, Kling, Veo ve Claude aynı anahtar ve faturada |
| Senaryo ve görsel analiz | Claude (OpenRouter üzerinden) | Fotoğraf okuma, sahne planı, kalite kontrolü |
| Seslendirme | ElevenLabs, Türkçe | OpenRouter'da yok; ücretsiz kota test için yeterli |
| Müzik | Lisanslı katalog (`PROVIDER_MUSIC=catalog`) | Ticari kullanım lisansı şart |
| CRM verisi | Tek yönlü kalır | Bkz. sohbet kararı: CRM ana kaynak |

Model kimlikleri ve fiyatlar 2026-11-23'te `GET /api/v1/videos/models` ile alındı. Seedance token ile
fiyatlanır: saniye başına genişlik × yükseklik × 24 / 1024 token. Bu formül listede yazan 480p fiyatını
(0,1028 $/sn) birebir veriyor, 1080p için ~0,57 $/sn eder.

| Model (sessiz, 16:9) | 1080p $/sn | 1 klip | 6 sahneli video |
|---|---|---|---|
| Seedance 2.5 | ~0,57 | 5 sn ≈ 2,84 $ | ≈ 17 $ |
| Seedance 2.5 (720p) | ~0,23 | 5 sn ≈ 1,16 $ | ≈ 7 $ |
| Veo 3.1 | 0,20 | 6 sn = 1,20 $ | ≈ 7,2 $ |
| Veo 3.1 Fast | 0,10 | 6 sn = 0,60 $ | ≈ 3,6 $ |
| Wan 3.0 | 0,20 | 5 sn = 1,00 $ | ≈ 6 $ |

Veo yalnızca 4, 6 ve 8 sn kabul eder; 6 sn istenir, renderer 5 sn'ye kırpar.

## Üretim hattı

1. **Fotoğraf analizi (Claude, görsel):** oda tipi, kalite puanı, öne çıkan özellik. Bulanık/karanlık
   fotoğraflar elenir. Sıra: dış cephe → salon → mutfak → yatak odaları → banyo → manzara → kapanış.
2. **Sahne planı:** oda tipine göre kamera dili (salon: yavaş ileri kayış; dış cephe: hafif yörünge;
   manzara: yatay pan). Prompt sabit kurallar içerir: mimari sabit, yalnızca kamera hareket eder,
   nesne ekleme/çıkarma yok, pencere manzarası değişmez.
3. **Senaryo (Claude):** yalnızca `propertySnapshotJson` içindeki gerçekler; sayılar doğrulanır (M6).
4. **AI klipler:** her sahne 5 sn, ana model. Klip, fotoğraf + model + prompt özetine göre önbelleğe alınır.
5. **Kalite kontrolü:** klipten 3 kare alınır, Claude orijinal fotoğrafla karşılaştırır (bozulma,
   uydurma nesne, değişen manzara). Geçmezse bir kez yedek modelle üretilir; yine geçmezse sahne
   fotoğraf hareketine (Ken Burns) düşer. Yanıltıcı ilan riskine karşı bu adım kapatılamaz.
6. **Seslendirme:** ElevenLabs, Türkçe, sahne sürelerine hizalı.
7. **Kurgu (ffmpeg, M5):** marka şablonu, fiyat / m² / oda sayısı yazıları, müziğin vuruşuna
   oturan kesmeler, Türkçe altyazı, danışman kapanış kartı.
8. **Çıktılar:** 9:16 (Reels/TikTok), 16:9 (portal), 1:1 (gönderi).

## Bütçe sigortaları (ücretli ilk çağrıdan önce şart)

- `AI_PAID_CALLS_ENABLED=false` ana şalter. Kapalıyken gerçek sağlayıcı seçili olsa da para harcanmaz.
- Günlük ve aylık harcama tavanı (`AI_DAILY_BUDGET_USD`, `AI_MONTHLY_BUDGET_USD`). Tavan dolunca yeni
  AI sahneleri fotoğraf hareketine düşer; video yine tamamlanır, yönetici bildirim alır.
- Klip önbelleği: aynı girdi ikinci kez ücretlendirilmez.
- Ücretli video çağrılarında otomatik yeniden deneme yok (yalnızca bir kez yedek modele geçiş).
- Her çağrının maliyeti `VideoScene.costMicroUsd` ve `ProviderUsage` içine yazılır; aylık toplam
  yönetim ekranında görünür.

## Fazlar

| Faz | İş | Para |
|---|---|---|
| 1 | Bütçe sigortaları, klip önbelleği, OpenRouter video + LLM adaptörü, kalite kontrol adımı, sahne planı ve kamera dili. Tümü mock ile test. | 0 $ |
| 2 | Model listesini al, kimlikleri düzelt. Claude ile gerçek fotoğraf analizi ve senaryo. | ~1 $ |
| 3 | Karşılaştırma testi: 1 ilan, 5 fotoğraf × 3 model (Seedance 2.5, Veo 3.1, Veo 3.1 Fast; hepsi 1080p) = 15 klip. Yan yana izleyip model seçimi. | ~23 $ |
| 4 | ElevenLabs Türkçe ses seçimi, kurgu şablonu, 3 en-boy oranı. | 0 $ (ücretsiz kota) |
| 5 | Uçtan uca 3 gerçek video, kalite kontrol eşiğinin ayarı. | ~10 $ |
| 6 | Kredi fiyatlandırması: gerçek maliyet ölçümüne göre paket kredilerini güncelle. | — |

## Faz 1'de yapılanlar

- `PROVIDER_I2V=openrouter`, `PROVIDER_LLM=openrouter`; tek `OPENROUTER_API_KEY`.
- `AI_PAID_CALLS_ENABLED` yalnızca tam `true` değeriyle açılır. Kapalıyken senaryo ve ses mock, AI sahneler fotoğraf hareketine düşer.
- Günlük ve aylık tavan: çağrıdan önce tahmini maliyetle rezervasyon (veritabanı kilidiyle), sonra sağlayıcının faturaladığı tutar (`actualCostMicroUsd`).
- Fiyatı bilinmeyen modelle çağrı yapılmaz.
- Gönderim çağrısı hiç yeniden denenmez; ElevenLabs çağrısı da. Bitmiş klibin indirilmesi yeniden denenir, üretimi denenmez.
- Sahne başarısızsa bir kez yedek modelle, o da olmazsa fotoğraf hareketiyle tamamlanır; video düşmez.
- Klip önbelleği: çalışma alanı + fotoğraf özeti + model + prompt + süre + çözünürlük. Çalışma alanları arasında paylaşılmaz.
- Tek klip 16:9 üretilir; dikey ve kare çıktılar ondan kırpılır.

## Açık konular

- **Fotoğrafın sağlayıcıya ulaşması (Faz 3'ü engeller):** sağlayıcı yerel depodaki URL'ye erişemez.
  OpenRouter dokümanı veri URL'sinden (base64) söz etmiyor. Seçenekler: herkese açık bir depo adresi
  (`OBJECT_STORAGE_PUBLIC_ENDPOINT`, örneğin bir tünel) veya veri URL'sinin desteklendiğinin teyidi.
- **Kalite kontrolü ve oda tipine göre kamera dili:** Faz 2'ye kaldı (fotoğraf analiziyle birlikte).
- **Ses:** Seedance/Kling/Veo yerel ses üretebilir; biz kapalı kullanırız (ElevenLabs + müzik), fiyat da düşer.
- **Müzik lisansı:** katalog dosyası ve ticari kullanım belgesi gerekli.

## Tahmini maliyet

30 sn video, 6 AI sahne: Seedance 2.5 1080p ile ≈ 17 $, Veo 3.1 Fast ile ≈ 3,6 $ (yukarıdaki tablo).
Senaryo, kalite kontrolü ve ses ≈ 0,1 $. Hangi modelin seçileceği Faz 3 testine bağlı.
