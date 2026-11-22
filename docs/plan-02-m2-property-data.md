# Milestone 2 — Portföy veri temeli

> Tarih: 21 Kasım 2026 · Blueprint: §6.2, §7.4, §8.6, §10.3, §11.2–11.3, §13.1, §15.3 (#2, #3), §16 M2
> Durum: **Tamamlandı (22 Kasım 2026)** · Dal: `m2-property-data` (M1 dalının üstünde). Sonuç en altta.

## Kapsam

**Var:** canonical `Property` ve `PropertyAsset` modeli; CSV/XLSX portföy içe aktarma (yükleme →
alan eşleme → önizleme → onay), hatalı satır raporu, içe aktarma geçmişi, tekrar içe aktarmada
çift kayıt oluşmaması; portföy listesi ve detayı; veri kapsamı (data coverage); fotoğraf yükleme,
silme ve küçük önizlemeler.

**Yok:** lead içe aktarma ve lead metrikleri (analitik milestone'u), CRM API adapter'ı (ayrı
milestone), CSV'deki foto URL'lerinden otomatik indirme (aşağıda), mülk bilgisini elle düzenleme.

## Kararlar (varsayım — itiraz edilebilir)

1. **Akış üç adım:** `POST /imports` (dosya yüklenir, saklanır, başlıklar ve önerilen eşleme
   döner) → `POST /imports/:id/preview` (eşlemeyle tüm satırlar doğrulanır, yeni/güncellenecek/
   değişmeyecek/hatalı sayıları) → `POST /imports/:id/commit` (bir kez çalışır). Blueprint'teki
   `/imports/csv/preview|commit` yerine dosya saklanan iki aşamalı akış: önizleme ile onay aynı
   dosyayı görür.
2. **Kimlik:** her içe aktarma bir **kaynağa** (`CrmConnection`, provider `CSV`) bağlıdır; her
   workspace'te otomatik bir "CSV / Excel" kaynağı açılır. Tekrarlanan kayıt anahtarı
   `(tenantId, crmConnectionId, externalId)`. Bu yüzden **portföy/ilan no sütunu zorunlu**.
   Zorunlu alanlar: dış kimlik, başlık, ilan türü (satılık/kiralık). Diğerleri isteğe bağlı;
   eksikleri veri kapsamına yansır. CSV kaynağı CRM bağlantı limitine sayılmaz.
3. **Dosyada olmayan kayıtlar silinmez** (dosya kısmi olabilir). Kaynaktaki durum sütunu varsa
   işlenir.
4. **Türkçe biçimler:** `4.500.000 TL`, `3+1`, `120 m²`, `Evet/Hayır`, `Satılık/Kiralık`,
   `Bahçe katı`. Excel'in Türkçe CSV'si (Windows-1254, `;` ayraç) otomatik algılanır.
   Para `priceMinor` (kuruş, BigInt), oda düzeni metin (`3+1`) + sayısal oda sayısı.
5. **Fotoğraflar** API üzerinden yüklenir (dosya başına 20 MB, mülk başına 60 foto); biçim
   `sharp` ile doğrulanır (JPEG/PNG/WebP; HEIC şimdilik net bir mesajla reddedilir). Orijinal
   `raw/…`, 640 px WebP önizleme `normalized/…` altında; görüntüleme kısa ömürlü imzalı URL ile.
   Aynı fotoğraf aynı mülke iki kez eklenmez (SHA-256).
6. **CSV'deki foto URL'leri** şimdilik indirilmez: sunucudan rastgele URL indirmek SSRF riski
   taşır; izinli host listesi ve güvenli indirici ile CRM milestone'unda.
7. **Veri kapsamı:** ağırlıklı alan listesi + foto sayısı → 0–100 puan ve eksik alan listesi;
   açıklaması ekranda gösterilir (§6.3: skor açıklamasız gösterilmez).
8. **Roller:** içe aktarma MANAGER+, foto yükleme/silme MEMBER+, görüntüleme herkes.
9. **Tenant çözümleme:** yeni route'lar `X-Tenant-Id` başlığını kullanır (ADR 0007); izolasyon
   testine başlıkla eklenir.
10. **Limitler:** dosya 10 MB, en fazla 5.000 satır (config).

## Dilimler

1. Şema + migration; ayrıştırma, değer çevirme ve kapsam (birim testli).
2. İçe aktarma API'si + entegrasyon testleri (tekrar içe aktarma, hatalı satır, eşzamanlı onay).
3. Mülk listesi/detayı + fotoğraf API'si + testler.
4. Web: Portföy listesi, detay, içe aktarma sihirbazı, foto yükleme.
5. E2E #2, #3; dokümantasyon.

## Kabul kriterleri

- §15.3 #2: CSV içe aktarılır ve portföy listesinde görünür (API + E2E).
- §15.3 #3: mülk detayı açılır ve veri kapsamı gösterilir (API + E2E).
- Aynı dosya iki kez içe aktarılınca kayıt sayısı değişmez; değişen satırlar güncellenir.
- Hatalı satırlar raporlanır ve indirilebilir; geçerli satırlar etkilenmez.
- Başka tenant'ın mülk/foto/içe aktarma kayıtlarına erişim 404 (#13 tablosu genişler).
- lint, typecheck, test, build, E2E yeşil; OpenAPI ve README güncel.

## Sonuç

- Birim 61, entegrasyon 53 (toplam API 114), E2E 5 (portföy akışı dahil), lint/typecheck yeşil.
- §15.3 #2 (içe aktarma → listede görünür) ve #3 (detay + kapsam) hem API hem E2E ile doğrulandı.
- #13 izolasyon tablosu başlık tabanlı route'lar için genişletildi (yabancı başlık ve yabancı ID).
- 5.000 satır ~11 s. Sınama: `pnpm test:int` içinde.
- Gerçek tarayıcıda 16 MB fotoğraf yüklendi. Bu sırada Next rewrite'ın 10 MB gövde sınırı
  bulundu ve 25 MB'a çıkarıldı (ADR 0007).
- Bilinen eksikler README'de. CSV içindeki fotoğraf URL'leri indirilmiyor.
