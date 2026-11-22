# Milestone 5 — Render hattı (9:16 ve 16:9 MP4)

> Blueprint: §3.1, §3.5, §8.7, §12.3, §16 M5
> Durum: **Uygulanıyor**. Testler bu aşamada çalıştırılmıyor; uçtan uca test en sonda yapılacak.

## Kapsam

**Var:** sürümlü manifest şeması (v1), fotoğraflardan her iki formatta MP4 (1080×1920 ve 1920×1080,
H.264 + AAC), çıktı kaydı (`VideoOutput`), yapısal anahtarlarla depolama, indirme bağlantıları,
render hatasında kredi iadesi, sha256 ve boyut kaydı.

**Yok:** gerçek AI klip (M6), gerçek seslendirme ve müzik dosyaları (M6), kalite kontrolünün
gerçek görsel analizi (M8 öncesi), Remotion şablonları.

## Kararlar (sapma — bilinçli)

1. **Renderer olarak FFmpeg.** Blueprint Remotion + FFmpeg diyor. Remotion Chromium ister ve
   ticari lisans kontrolü (§8.9, §17) launch öncesi yapılacak. M5 dilimi için FFmpeg filtre
   grafiği kullanılıyor; renderer bir arayüz arkasında, Remotion adaptörü lisans kontrolünden sonra
   eklenecek.
2. **Hareket.** Her fotoğraf yavaş zoom (Ken Burns) ile gösterilir; kırpma kapak alanını doldurur.
3. **Ses.** Sessiz AAC parçası (seslendirme M6). Çıktı yine de AAC taşır (§3.1).
4. **Tek render işi.** RENDERING aşaması iki formatı sırayla üretir. Blueprint format başına iş
   diyor; ilk dilimde sıra karmaşası olmasın diye sırayla.
5. **Determinizm.** Aynı manifest + aynı kaynak → aynı girdi argümanları; çıktı sha256 kaydedilir.
6. **Manifest sürümü.** `schemaVersion: 1` zorunlu; render öncesi Zod ile doğrulanır.
7. **Yer tutucu yok.** `isMock` çıktıların klip kaynağı mock olabilir, ama dosyalar gerçek MP4'tür.
   Klip kaynağı manifestte `clipSource` ile etiketlenir.

## Dilimler

1. Şema (VideoOutput) ve manifest v1 (paylaşılan).
2. FFmpeg argüman üreticisi (saf fonksiyon) + çalıştırıcı.
3. RENDERING aşaması: indir → render → yükle → kayıt.
4. Çıktı uç noktası (imzalı indirme bağlantısı).
5. Test ve uçtan uca doğrulama (en sonda).
