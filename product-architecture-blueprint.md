# AI Content & Real Estate Marketing SaaS — Product, Business & Engineering Blueprint

> **Belge türü:** Product Requirements Document (PRD) + Technical Design Document (TDD) + Build Plan  
> **Sürüm:** 0.1  
> **Tarih:** 21 Kasım 2026  
> **Durum:** Ürün yönü ve temel iş kuralları belirlenmiş; fiyatlar, sağlayıcı seçimi ve CRM API kapsamı pilot verilerle doğrulanmalı.  
> **Marka adı:** Şimdilik belirsiz. Kodda ve arayüzde geçici bir marka adına bağımlılık yaratma.

---

## 0. Claude için çalışma talimatları

Bu dosya ürünün ana referans belgesidir. Kod geliştirmeye başlamadan önce repository'yi, mevcut kodu, package manager'ı ve çalışma ortamını incele.

### Zorunlu kurallar

1. Bu belgede **MUST / MUST NOT** olarak yazılan kurallar bağlayıcıdır. Sessizce değiştirme.
2. Mevcut repository varsa sıfırdan proje üretmek yerine önce yapıyı analiz et ve mevcut mimariye uyum sağla.
3. Tüm sistemi tek seferde üretmeye çalışma. Aşağıdaki milestone'ları dikey dilimler halinde tamamla.
4. Önce çalışan bir MVP üret. Gereksiz mikroservis, event bus, Kubernetes, multi-cloud veya erken optimizasyon ekleme.
5. AI sağlayıcılarını doğrudan iş mantığına gömme. Adapter/interface kullan; model, endpoint, fiyat ve limitler konfigüre edilebilir olsun.
6. Kredi, ücretsiz yeniden üretim ve provider maliyeti hareketleri audit edilebilir ve transaction-safe olmalı.
7. Kullanıcıya gösterilen gayrimenkul bilgileri CRM veya kullanıcı tarafından doğrulanmış kaynaklardan gelmeli. LLM fiyat, oda sayısı, metrekare, manzara, mesafe, konum veya bina özelliği uydurmamalı.
8. Sistem kaynaklı başarısızlık kullanıcıya kredi veya ücretsiz yeniden üretim hakkı kaybettirmemeli.
9. Tam yeniden üretim, önceki üretimin sesini, müziğini, sahnelerini, AI kliplerini, senaryosunu, geçişlerini veya animasyonlarını tekrar kullanmamalı.
10. Her dış servis entegrasyonu için timeout, retry, idempotency, logging, usage metering ve hata eşlemesi olmalı.
11. Geliştirmeye başlamadan önce ilgili resmi dokümantasyonun güncel sürümünü kontrol et. Model ve fiyat bilgileri hızla değişebilir.
12. Test edilmemiş özelliği tamamlandı diye işaretleme. Mock entegrasyon ile gerçek provider entegrasyonunu açıkça ayır.
13. API anahtarlarını, OAuth token'larını ve kişisel verileri loglama veya source control'e koyma.
14. Bir işi tamamladığında değişiklikleri, test komutlarını, sonuçları ve bilinen eksikleri özetle.

### İlk Claude görevi

İlk adımda kod yazma. Repository'yi incele ve şunları raporla:

- Mevcut klasör ve uygulama yapısı
- Kullanılan runtime, framework ve package manager sürümleri
- Mevcut DB ve migration durumu
- Çalıştırılabilen test/lint/typecheck komutları
- Bu belgeye göre eksik olan temel modüller
- Önerilen ilk milestone ve dosya bazlı uygulama planı

Kullanıcı açıkça istemeden büyük mimari değişikliği yapma.

---

# 1. Ürün tanımı

## 1.1 Vizyon

CRM ve diğer kaynaklardaki gayrimenkul portföy verilerini bir araya getirerek portföy performansını analiz eden, düşük performanslı veya pazarlama desteğine ihtiyaç duyan gayrimenkulleri işaretleyen ve tek işlemle yüksek kaliteli, yapay zekâ destekli pazarlama videoları üreten bir SaaS platformu.

İlk kullanım alanı emlak ofisleri ve gayrimenkul danışmanlarıdır. Ancak marka ve çekirdek mimari emlakla sınırlı tasarlanmamalıdır. İleride farklı sektörlere yönelik AI içerik ve otomasyon ürünleri eklenebilir.

## 1.2 Ürünün temel değer önerisi

- CRM ve portföy verilerinin tek yerde toplanması
- Gayrimenkul bazında lead ve içerik performansı analizi
- Hangi portföyün pazarlama desteğine ihtiyaç duyduğunun belirlenmesi
- Gayrimenkul fotoğraflarından otomatik video oluşturulması
- Kullanıcının editör, timeline veya tasarım aracı kullanmak zorunda kalmaması
- Yüksek kaliteli AI image-to-video sahneleri, gerçek fotoğraf animasyonu, seslendirme ve müziğin tek pipeline'da birleştirilmesi
- Üretim maliyetinin, kredi tüketiminin ve kullanıcı haklarının şeffaf takip edilmesi

## 1.3 MVP'de yapılacaklar

1. Multi-tenant workspace ve kullanıcı yönetimi
2. LeadPilot için ilk CRM adapter'ı — API kapsamı doğrulanırsa
3. CSV/XLSX portföy ve lead import
4. Canonical property ve lead veri modeli
5. Gayrimenkul listeleme ve detay ekranı
6. Veri kapsamı/eksik veri uyarıları
7. Temel portföy performans analizi
8. Tek butonla 30–60 saniyelik video üretimi
9. Dikey ve yatay video çıktısı
10. Üretim geçmişi ve video versiyonları
11. Kredi ve ücretsiz yeniden üretim hakkı sistemi
12. Paket, ödeme ve fatura entegrasyonu için temel altyapı
13. Admin panelinde provider maliyetleri ve iş durumları

## 1.4 MVP dışında tutulacaklar

- Tam özellikli manuel video editörü
- Kullanıcıya timeline/sahne/metin düzenletme
- Kullanıcıya AI modeli seçtirme
- Otomatik sosyal medya paylaşımı (ikinci faz)
- WhatsApp kişisel uygulama mesajlarını çekme
- CRM'lerin tümünü aynı anda entegre etme
- Sahibinden veya başka ilan portallarından yetkisiz veri çekme
- İlk sürümde kendi AI video modelini eğitme
- İlk sürümde Kubernetes veya mikroservis mimarisi
- Kullanıcı onayı olmadan otomatik sosyal medya yayını

---

# 2. Kullanıcı deneyimi ve ürün akışları

## 2.1 Ana kullanıcı akışı

1. Kullanıcı workspace'e giriş yapar.
2. CRM bağlantısı yapar veya CSV/XLSX yükler.
3. Sistem gayrimenkulleri ve mevcut lead verilerini senkronize eder.
4. Kullanıcı portföy listesini ve performans analizlerini görür.
5. Bir gayrimenkulü seçer veya sistemin önerdiği düşük performanslı portföyden başlar.
6. Kullanıcı **Video üret** butonuna basar.
7. Sistem fotoğrafları analiz eder, sahne planı kurar, AI sahnelerini üretir, senaryoyu ve seslendirmeyi oluşturur, müziği seçer/üretir ve videoları render eder.
8. Kullanıcı işleme durumunu izler.
9. Video tamamlanınca kullanıcı önizler.
10. Beğenirse indirir. Beğenmezse hakkı varsa bir defaya mahsus ücretsiz tam yeniden üretim yapar.
11. Ücretsiz yeniden üretim hakkı yoksa veya bu video serisinde daha önce kullanılmışsa yeni üretim 1 kredi harcar.

## 2.2 Video üretim ekranı

Ekran basit olmalı. Kullanıcıya video editörü sunulmayacak.

Gösterilecekler:

- Gayrimenkul başlığı ve küçük kapak görseli
- Video üret butonu
- Üretim sırasında durum ve yaklaşık aşama göstergesi
- Tamamlandığında video önizlemesi
- Dikey MP4 indir
- Yatay MP4 indir
- Yeniden üret butonu
- Kaç kredi kaldığı
- Kaç ücretsiz yeniden üretim hakkı kaldığı
- Bu video için ücretsiz yeniden üretimin kullanılıp kullanılmadığı
- İsteğe bağlı kısa geri bildirim: "Neyi beğenmedin?" (serbest metin zorunlu değil)

Kullanıcıya AI sağlayıcı adı, model adı, prompt, sahne sayısı veya teknik parametre gösterilmesi zorunlu değildir.

## 2.3 Üretim durumları

Backend job state machine:

- `queued`
- `validating`
- `loading_property_data`
- `analyzing_photos`
- `planning_scenes`
- `generating_script`
- `generating_ai_scenes`
- `generating_voice`
- `selecting_music`
- `composing_video`
- `rendering_portrait`
- `rendering_landscape`
- `quality_check`
- `completed`
- `failed`
- `cancelled`

Frontend'de teknik aşamalar daha anlaşılır etiketlerle sunulabilir: "Fotoğraflar analiz ediliyor", "Video hazırlanıyor", "Ses ve müzik ekleniyor", "Son render yapılıyor".

Progress yüzdesi gerçek worker progress'inden türetilmeli. Sahte, sabit hızla artan progress bar kullanılmamalı.

---

# 3. Video üretim kuralları

## 3.1 Süre ve format

- Video süresi minimum **30 saniye**, maksimum **60 saniye** olmalı.
- Süre; fotoğraf sayısı, gayrimenkul veri yoğunluğu, anlatılacak özellik sayısı ve sahne akışına göre otomatik belirlenmeli.
- Sistem 30, 45 veya 60 saniye civarında üretim planlayabilir; kesin süre seslendirme ve sahne zamanlamasına göre ayarlanmalı.
- İki çıktı oluşturulmalı: `9:16` dikey ve `16:9` yatay.
- Çıktılar MP4, H.264 video ve AAC audio olarak teslim edilebilir. Üretim sırasında kodek ve bitrate cihaz uyumluluğu test edilmelidir.
- Hedef çıktı kalitesi başlangıçta 1080p olmalı. 4K, gerçek model/renderer desteği ve maliyet doğrulamasından sonra eklenmeli.

## 3.2 AI sahne sayısı

Önceki sabit 2–3 sahne yaklaşımı kaldırılmıştır. Sahne sayısı otomatik belirlenir ve 3'ten fazla olabilir.

Başlangıç planlama hedefi (değiştirilebilir konfigürasyon):

| Video süresi | Tipik AI sahne hedefi | Not |
|---|---:|---|
| 30 sn | 3–4 | Kısa, seçilmiş hareketli sahneler |
| 45 sn | 4–5 | Dengeli tanıtım |
| 60 sn | 5–6 | Daha fazla mekân ve detay |

15–20 fotoğraf kullanıldığında 5–6 AI sahne mantıklı başlangıç aralığıdır. Fotoğrafların tamamı AI video yapılmak zorunda değildir. Diğer kareler Remotion ile pan/zoom, parallax benzeri kontrollü hareketler ve geçişlerle kullanılabilir.

Bu sayılar ticari model maliyeti doğrulanana kadar **varsayılan politika** olmalıdır. Uygulama içine sabit kodlanmamalı; `video_generation_policy` konfigürasyonundan yönetilmelidir.

## 3.3 Görsel kalite ilkesi

- İlk öncelik görsel kalitedir; en ucuz model varsayılan seçilmemelidir.
- Model seçimi yalnızca benchmark sonucuna göre yapılmalıdır. Marka/model popülerliği kalite kanıtı değildir.
- Test seti gerçek gayrimenkul fotoğraflarından oluşmalı: iç mekân, dış cephe, havuz, balkon, mutfak, banyo, manzara, drone/aerial, küçük alan, düşük ışık.
- Ana metrikler: mimari/geometri korunumu, kapı/pencere/duvar deformasyonu, mobilya tutarlılığı, yapay nesne üretme, kamera hareketinin doğallığı, detay kalitesi, flicker, renk kayması.
- AI video gerçeğe aykırı özellik veya mekân üretebilir. Kullanıcıya gerçek mülkü temsil etmeyen özellikler eklenmemeli.
- Otomatik kalite kontrol kusurları işaretleyebilir ama kusursuz doğruluk garantisi vermez.
- Sistem kaynaklı ciddi model/render hatası başarısız üretim sayılır ve kullanıcı hakkı iade edilir.

## 3.4 AI sahne + gerçek fotoğraf karışımı

Önerilen kompozisyon:

- Seçilmiş kareler: AI image-to-video ile hareketli sahneler.
- Diğer kareler: gerçek fotoğraf + Remotion pan/zoom ve hafif kamera hareketi.
- Başlık, fiyat, metrekare, oda sayısı ve konum gibi gerçek bilgiler doğrudan canonical property snapshot'tan gelir.
- AI yalnızca anlatım ve sahne akışı için yardımcı olur; doğrulanmamış emlak iddiası üretemez.
- Her sahnede kaynak fotoğraf ID'si, AI modeli, prompt versiyonu, clip süresi ve usage maliyeti tutulmalı.

## 3.5 Yatay ve dikey çıktı

- Aynı AI klibi iki formatta mümkün olduğunca tekrar kullanılmalı; iki kez AI üretimi yapılmamalıdır.
- Ancak her sağlayıcının aspect ratio davranışı farklıdır. Örneğin fal üzerindeki Kling v3 Pro image-to-video dokümanı aspect ratio'nun başlangıç görselinden belirlendiğini ve `aspect_ratio` parametresinin yok sayıldığını belirtiyor.
- Bu nedenle seçilen provider/model için gerçek test yapılmalı. Tek master klibin hem 9:16 hem 16:9 kırpılması kompozisyonu bozuyorsa bu durum otomatik olarak gizlenmemeli.
- MVP varsayılanı: bir master AI klibi üret, iki formata smart crop/reframe uygula; crop güvenli değilse gerçek fotoğrafı Remotion hareketiyle kullan veya kullanıcıya hangi formatı önceliklendireceği sorusunu ürün kararı olarak sonraya bırak.
- İkinci aspect ratio için tekrar AI üretimi ancak açıkça fiyatlandırılmış ek maliyet/ürün kararıyla eklenmeli.

## 3.6 Senaryo ve doğruluk

LLM'e yalnızca doğrulanmış property snapshot alanları verilmeli.

Örnek güvenilir alanlar:

- İlan başlığı
- Satış/kiralama türü
- Fiyat ve para birimi
- Oda sayısı
- Brüt/net metrekare (ayrı alanlar)
- İl/ilçe/mahalle
- Bina yaşı
- Kat bilgisi
- Isıtma türü
- Eşyalı olup olmadığı
- Site/tesis özellikleri (kaynakta varsa)
- CRM'den gelen açıklama

LLM şu tür ifadeleri kaynaksız ekleyemez:

- "Denize 5 dakika"
- "Yatırım garantili"
- "Kesintisiz deniz manzarası"
- "Depreme dayanıklı"
- "Lüks rezidans"
- "Yeni yapılmış"

LLM çıktısı yapılandırılmış JSON olmalı ve schema validation'dan geçmeli. Bilgi yoksa metinde kullanılmamalı.

## 3.7 Tam yeniden üretim — bağlayıcı kural

Kullanıcı yeniden üretme istediğinde yeni bir generation başlatılır ve video baştan sona yeniden oluşturulur.

Her tam yeniden üretimde MUTLAKA yeniden yapılacaklar:

- Fotoğraf/görsel analizi
- Sahne seçimi ve sıralaması
- Sahne planı
- AI image-to-video kliplerinin tamamı
- Senaryo
- Seslendirme/TTS
- Fon müziği üretimi veya seçimi
- Animasyon ve kamera hareketleri
- Geçişler ve cut kararları
- Dikey render
- Yatay render
- Final quality check

Önceki generation'dan şu yaratıcı çıktılar yeniden kullanılamaz:

- Önceki AI video klipleri
- Önceki seslendirme
- Önceki müzik seçimi/üretimi
- Önceki senaryo
- Önceki sahne sıralaması
- Önceki animasyon ve geçişler
- Önceki render çıktıları

Yeniden üretimde tekrar kullanılabilecek tek şeyler:

- Orijinal fotoğraf dosyaları (değişmediği sürece)
- CRM'den alınmış doğrulanmış property verisi snapshot'ı
- Kullanıcının daha önce yüklediği orijinal kaynak asset'ler

Bunlar yaratıcı çıktı değil, kaynak veridir. Tam yeniden üretim, kaynağı yeniden indirmek zorunda olduğumuz anlamına gelmez.

## 3.8 Müzik ve ses

- Varsayılan dil Türkçe olmalı; başka diller sonraki fazda eklenebilir.
- TTS sağlayıcısı adapter üzerinden değiştirilebilir olmalı.
- Türkçe telaffuz, isim/mahalle okunuşu, sayısal değerler, fiyat ve metrekare ifadeleri gerçek örneklerle test edilmeli.
- Müzik her generation'da yeniden seçilmeli veya yeniden üretilmeli.
- Ticari kullanım hakkı, yeniden dağıtım ve son kullanıcıya teslim lisansı açıkça doğrulanmamış müzik kullanılmamalı.
- MVP'de tercihen hakları belgelenmiş ve ticari kullanım için izinli müzik kataloğu kullanılmalı.
- Ses seviyesi, voice-over ducking, loudness normalization ve fade-in/fade-out uygulanmalı.
- Seslendirme metninin süresi ile sahne süreleri senkronize edilmeli. Video süresi sesin sonuna göre planlanmalı; acele hızlandırılmış TTS kullanılmamalı.

---

# 4. Kredi, paket ve yeniden üretim iş kuralları

Bu bölüm ürünün en kritik finansal/business logic bölümüdür.

## 4.1 Kredi tanımı

- **1 video generation = 1 kredi**.
- İlk üretim 1 kredi harcar.
- Ücretsiz yeniden üretim kredi harcamaz, ancak paket bazlı ücretsiz yeniden üretim havuzundan 1 hak tüketir.
- Aynı video üretim zinciri içinde maksimum **1 ücretsiz yeniden üretim** kullanılabilir.
- Bu video zincirinde ücretsiz hak kullanıldıktan sonra yapılan her yeni tam üretim 1 kredi harcar.
- Ücretsiz yeniden üretim havuzu bitmişse, video zincirinin ilk yeniden üretimi de 1 kredi harcar.
- Kredi bakiyesi sıfırsa yeni ücretli üretim başlatılamaz. Kullanıcıya kredi satın alma/paket yükseltme ekranı sunulur.
- Eksi kredi bakiyesi oluşturulmaz. "Kredisi -1 düşer" iş kuralı, mevcut bakiyeden **1 kredi düşülmesi** anlamına gelir; negatif bakiye değildir.

## 4.2 Ücretsiz yeniden üretim sayaçları

İki ayrı sayaç vardır:

1. **Paket ücretsiz yeniden üretim havuzu:** Dönem boyunca kullanılabilecek toplam ücretsiz yeniden üretim sayısı.
2. **Video zinciri ücretsiz yeniden üretim hakkı:** Her `video_project` veya generation chain için maksimum 1.

İki koşul birden sağlanıyorsa yeniden üretim ücretsizdir:

- Workspace'in kullanılabilir ücretsiz yeniden üretim hakkı > 0
- Bu video zincirinde `free_regeneration_used = false`

İşlem başarıyla tamamlanıp kullanıcıya teslim edilince ücretsiz hak kalıcı olarak tüketilir. Provider/render hatası nedeniyle başarısız olan yeniden üretimde hak iade edilir.

## 4.3 Örnek: 10 kredili paket

Paket 10 kredi ve 3 ücretsiz yeniden üretim hakkı içeriyorsa:

| İşlem | Kredi değişimi | Ücretsiz hak değişimi |
|---|---:|---:|
| Video A ilk üretim | -1 | 0 |
| Video A ilk yeniden üretim | 0 | -1 |
| Video A ikinci yeniden üretim | -1 | 0 |
| Video B ilk üretim | -1 | 0 |
| Video B ilk yeniden üretim | 0 | -1 |
| Video C ilk üretim | -1 | 0 |
| Video C ilk yeniden üretim | 0 | -1 |

Video A zincirinde ücretsiz hak kullanıldığı için aynı zincirde daha sonra yeni bir ücretsiz üretim hakkı açılamaz.

## 4.4 Önerilen paket tablosu

Aşağıdaki paketler ürün/pazar testine yönelik **başlangıç hipotezidir**. Yayına almadan önce gerçek provider maliyetleri, vergiler/ödeme kesintileri, müşteri görüşmeleri ve pilot kullanım verisiyle yeniden hesaplanmalıdır.

| Paket | Aylık video kredisi | Toplam ücretsiz yeniden üretim | Kullanıcı koltuğu | Kullanım profili |
|---|---:|---:|---:|---|
| Starter | 10 | 3 | 2 | Tek ofis / küçük ekip |
| Growth | 30 | 10 | 5 | Aktif emlak ofisi |
| Professional | 75 | 25 | 10 | Büyük ofis / yoğun portföy |
| Agency | 150 | 50 | 25 | Çok danışmanlı ajans / şubeler |

Paketlerin ücretsiz yeniden üretim hakkı yaklaşık toplam kredi sayısının üçte biri olarak tasarlanmıştır. Her video zincirinde yine yalnızca 1 ücretsiz yeniden üretim vardır.

### Önerilen fiyat hipotezi

| Paket | Aylık öneri fiyatı (TL) | Yaklaşık bir kredi geliri |
|---|---:|---:|
| Starter | 6.990 TL | 699 TL |
| Growth | 18.990 TL | 633 TL |
| Professional | 44.990 TL | 600 TL |
| Agency | 84.990 TL | 567 TL |

**Bu fiyatlar doğrulanmış piyasa fiyatı değildir.** Premium kalite ve pahalı image-to-video üretimi varsayımıyla hazırlanmış ilk test çıpasıdır. KDV dahil/hariç sunum, vergi, tahsilat komisyonları ve yerel muhasebe uygulaması finansal/hukuki incelemeden sonra belirlenmelidir.

### Paket özellikleri — önerilen başlangıç

| Özellik | Starter | Growth | Professional | Agency |
|---|---|---|---|---|
| Video kredisi | 10 | 30 | 75 | 150 |
| Ücretsiz yeniden üretim | 3 | 10 | 25 | 50 |
| Koltuk | 2 | 5 | 10 | 25 |
| Workspace | 1 | 1 | 1 | 3 (öneri) |
| CRM bağlantısı | 1 | 2 | 3 | 5 |
| CSV/XLSX import | Var | Var | Var | Var |
| Portföy analizi | Temel | Gelişmiş | Gelişmiş | Gelişmiş |
| Video geçmişi | 30 gün | 90 gün | 180 gün | 365 gün |
| Dikey + yatay MP4 | Var | Var | Var | Var |
| İndirme | Var | Var | Var | Var |
| Şube/ekip raporu | Yok | Temel | Var | Gelişmiş |
| Marka kiti | Yok | Yok | 1 | Çoklu marka kiti (sonraki faz) |
| Öncelikli üretim kuyruğu | Yok | Yok | Var | Var |
| API/Webhook erişimi | Yok | Yok | Sınırlı | Gelişmiş (sonraki faz) |

Paketlerdeki CRM bağlantı sayısı ve saklama günleri iş ihtiyacına göre değiştirilebilir; teknik altyapıda konfigürasyon olmalı.

## 4.5 Kredi ve ücretsiz hak tüketiminde güvenlik

- Kredi hareketleri `credit_ledger` tablosunda append-only olmalı.
- Bakiyeler ledger toplamı ile uzlaştırılabilmeli.
- Aynı generation için iki paralel request iki kez kredi harcamamalı.
- Reservation/capture/refund modeli kullanılmalı.
- İlk üretim talebinde 1 kredi atomik olarak rezerve edilir.
- İş başarıyla tamamlanınca rezervasyon capture edilir.
- Teknik hata, timeout sonrası kesin başarısızlık veya kullanıcıya teslim edilemeyen render durumunda rezervasyon iade edilir.
- Ücretsiz hak da benzer şekilde `reserved -> consumed` veya `released` akışıyla yönetilir.
- Kullanıcı videoyu beğenmediği için kredi iadesi yapılmaz; ücretsiz yeniden üretim hakkı/ücretlendirme kuralı uygulanır.
- Admin manuel düzeltmeleri gerekçe, actor ve timestamp ile audit log'a yazılmalı.

## 4.6 Video generation zinciri

Her kullanıcının tıklaması bir `video_project`/production series oluşturur. Bu seri içinde bir veya daha fazla `video_generation` kaydı bulunur.

- İlk generation: 1 kredi.
- Aynı project'teki ilk regeneration: ücretsiz havuzda hak varsa ücretsiz; aksi halde 1 kredi.
- Aynı project'teki sonraki tüm regeneration'lar: 1 kredi.
- Aynı property için kullanıcı yeni ve bağımsız bir video projesi başlatırsa bu yeni proje ilk generation olarak ücretlendirilir ve kendi tek ücretsiz yeniden üretim hakkına sahip olabilir.
- Ücretsiz hak kazanmak için mevcut videonun generation zincirini kullanmak gerekir; kullanıcı önceki project içindeki hakkı tekrar kullanamaz.

## 4.7 Yenileme ve rollover önerisi

MVP için basit kural:

- Aylık kredi bakiyesi fatura döneminde yüklenir.
- Ücretsiz yeniden üretim havuzu da aynı dönemde yüklenir.
- Kullanılmayan aylık ücretsiz yeniden üretim hakları dönem sonunda sıfırlanır.
- Kredi rollover kararı pilot müşteri kullanımını gördükten sonra verilir. İlk sürümde rollover olmaması en kolay uygulanabilir kuraldır; ancak satın alma ekranında açıkça belirtilmelidir.
- Ek kredi paketi (top-up) ayrı ledger kaydı olmalı. Top-up kredileri için ücretsiz yeniden üretim hakkı tanımlanmamalı; bu hak abonelik paketinden gelir.
- İptal, plan downgrade, refund ve dönem değişim kuralları ödeme sağlayıcısı entegrasyonundan önce yazılı hale getirilmeli.

---

# 5. Fiyatlandırma ve birim ekonomi

## 5.1 Model maliyetlerini görmezden gelme

AI video üretiminin maliyeti model, saniye, çözünürlük, ses ayarı, sağlayıcı ve retry durumuna göre değişir.

21 Kasım 2026 tarihinde kontrol edilen fal fiyat sayfasında Kling v3 Pro için liste fiyatı $0.14/saniye görünüyor; modelin özel endpoint sayfasında ses kapalı kullanım $0.112/saniye, ses açık kullanım $0.168/saniye olarak listeleniyor. Bu fiyat farklılıkları nedeniyle uygulama belirli bir fiyatı kod içine sabitlememeli; satın alma öncesi endpoint/parametre bazında doğrulamalıdır.

Bu dokümandaki planlama hesabında daha spesifik endpoint sayfasındaki **$0.112/saniye (audio off)** değeri örnek alınmıştır.

### AI video maliyeti örneği

| AI sahne sayısı | Klip başına saniye | Toplam AI saniyesi | $0.112/saniye | 50.512 TL/USD ile yaklaşık TL |
|---:|---:|---:|---:|---:|
| 3 | 5 | 15 | $1.68 | 84.9 TL |
| 4 | 5 | 20 | $2.24 | 113.1 TL |
| 5 | 5 | 25 | $2.80 | 141.4 TL |
| 6 | 5 | 30 | $3.36 | 169.7 TL |
| 8 | 5 | 40 | $4.48 | 226.3 TL |

USD/TRY dönüşümü 21 Kasım 2026 referans değeri olan yaklaşık 50.512 TL kullanılarak yapılmıştır. Kur ve provider fiyatları değişebilir.

Bu tablo **sadece AI video klip üretim maliyetidir**. Şunlar dahil değildir:

- TTS
- LLM metin ve fotoğraf analizi
- Müzik lisansı/aboneliği
- Render compute
- Storage ve CDN/egress
- Başarılı ama kalite açısından yetersiz üretimin yeniden yapılması
- Ödeme komisyonları
- Destek, satış, operasyon, vergi ve sabit altyapı maliyeti

## 5.2 Ücretsiz yeniden üretim etkisi

Paket başına ücretsiz haklar 3/10, 25, 50 gibi yaklaşık %33 oranındadır. Tüm kullanıcılar tüm ücretsiz hakları kullanırsa:

- 10 kredilik pakette 10 ücretli ilk üretim + 3 ücretsiz yeniden üretim = 13 toplam render generation
- 30 kredilik pakette 30 + 10 = 40 generation
- 75 kredilik pakette 75 + 25 = 100 generation
- 150 kredilik pakette 150 + 50 = 200 generation

Bu da ücretli kredi başına azami 1.33 video üretimi anlamına gelir. Fiyatlama motoru bunu hesaba katmalı.

## 5.3 Önemli maliyet politikası

- `video_generation_policy` içinde maksimum AI scene seconds, maksimum sahne sayısı, model, çözünürlük ve süre sınırları olmalı.
- MVP için varsayılan hedef: 30–60 saniyelik video başına yaklaşık 4–6 adet 5 saniyelik AI klip; kalan sahneler gerçek fotoğraflardan Remotion hareketiyle oluşturulur.
- Daha fazla AI sahnesi görsel kaliteye gerçekten katkı sağlamıyorsa sırf fotoğraf sayısı fazla diye artırılmamalı.
- Paket başına maliyet limiti, planlanan provider çağrısından önce tahmin edilmeli.
- Bütçe aşımı varsa alternatif gerçek fotoğraf animasyonu kullanılmalı veya admin/premium policy devreye girmeli.
- Kaliteyi düşürerek gizlice daha ucuz modele geçmek yasak. Model fallback'ı yalnızca kalite benchmark'ında onaylı provider/model listesi içinden olabilir.
- Her generation için gerçek provider usage faturası/response metadata kaydedilmeli.

## 5.4 Paket fiyatlarını yayına almadan önce gerekenler

En az 20–30 gerçek gayrimenkul fotoğraf setiyle şu test yapılmalı:

1. 30 saniye video
2. 45 saniye video
3. 60 saniye video
4. 3, 4, 5 ve 6 AI sahne sayısı
5. Kling v3 Pro ve en az bir alternatif model
6. Türkçe TTS kalitesi
7. 9:16 ve 16:9 crop/reframe kalitesi
8. Her üretimin gerçek provider maliyeti
9. Kullanıcıların ücretsiz yeniden üretim kullanma oranı
10. Başarısız/yeniden denenmiş provider işlerinin gerçek maliyeti

En az 30–50 pilot generation'ın gerçek maliyetleri ölçülmeden fiyat tablosu kesin kabul edilmemeli.

---

# 6. Portföy analizi ve lead performansı

## 6.1 Neden yalnızca lead sayısı yeterli değil?

Bir mülkün az lead alması otomatik olarak kötü video veya kötü pazarlama anlamına gelmez. Talep; fiyat, konum, mevsim, mülk türü, piyasa şartları, ilan görünürlüğü ve veri kaynağı gibi faktörlerden etkilenir.

Analiz en az şu metrikleri ayırmalıdır:

- Portföy yaşı
- Görüntülenme/impression (kaynak sağlıyorsa)
- Tıklama (kaynak sağlıyorsa)
- Lead sayısı
- Lead / view oranı
- Lead kaynağı
- Fiyat değişimi
- Medyan fiyat / benzer portföy bilgisi (gelecek faz)
- Verinin son güncellenme zamanı
- Veri kapsamı ve güvenilirliği

## 6.2 Data coverage

Her metrik kaynağına ve veri eksikliğine göre confidence/coverage tutulmalı.

Örnek:

- CRM lead kayıtları: var
- Instagram reach: yok
- Portal görüntülenme: API'den gelmiyor
- Web form lead: var
- WhatsApp Business: bağlantı yok
- Telefonla gelen lead: manuel girilmiş

Analiz ekranı veri eksiklerini görünür kılmalı ve eksik veriden kesin sonuç çıkarmamalı.

## 6.3 İlk analiz çıktısı

- Düşük lead alan portföyler
- Uzun süredir portföyde olan gayrimenkuller
- Lead var ama dönüşüm düşük olanlar
- Fotoğraf sayısı/kalitesi düşük portföyler
- Eksik açıklama/özellik alanları
- İçerik üretimine aday portföyler

MVP'de bir skor üretilebilir; fakat skorun açıklaması gösterilmeli. Örn: "Son 30 günde 2 lead, portföy yaşı 75 gün, fotoğraf sayısı 4; veri kapsamı orta." Veri kaynakları yoksa "pazarlama başarısız" gibi hüküm verilmemeli.

---

# 7. CRM entegrasyon mimarisi

## 7.1 Provider bağımsız yaklaşım

Ürün LeadPilot'a bağımlı kodlanmamalıdır. İlk adapter LeadPilot olabilir, fakat tüm CRM verisi canonical modele dönüştürülmelidir.

Önerilen yapı:

```text
CRM Providers
  ├── LeadPilotAdapter
  ├── GenericRestAdapter (later)
  ├── CsvImportAdapter
  └── Future adapters
          |
          v
Integration Hub
          |
          v
Canonical Domain Model
  ├── Property
  ├── PropertyAsset
  ├── Lead
  ├── PropertyLeadMetric
  └── SyncRun
```

## 7.2 Adapter contract

Her adapter aşağıdaki işlemleri destekleyebilmeli:

```ts
interface CrmAdapter {
  testConnection(connection: CrmConnection): Promise<ConnectionTestResult>;
  syncProperties(input: SyncInput): Promise<SyncResult<PropertyDTO>>;
  syncLeads(input: SyncInput): Promise<SyncResult<LeadDTO>>;
  syncPropertyAssets?(input: SyncInput): Promise<SyncResult<PropertyAssetDTO>>;
  getCapabilities(): CrmCapabilities;
}
```

`getCapabilities()` alan bazında hangi verinin desteklendiğini belirtmeli. Örneğin property data, photos, leads, status, price history, webhooks.

## 7.3 LeadPilot ilk entegrasyonu

- LeadPilot API dokümantasyonu, müşteri hesabındaki izinler ve gerçek API kapsamı doğrulanmadan entegrasyonun tamamlandığı varsayılmamalı.
- Portföy, görsel, lead, lead-property eşleşmesi, lead kaynağı ve tarih alanlarının API'den çekilip çekilemediği ayrı ayrı kontrol edilmeli.
- Webhook varsa event-driven sync tercih edilmeli.
- Webhook yoksa kontrollü polling ve periyodik reconciliation kullanılmalı.
- Harici ID saklanmalı; tekrar gelen kayıtlar idempotent upsert edilmeli.
- Silinen/deaktif edilen portföyler soft-delete veya source status ile işlenmeli.
- API rate limit ve sayfalama kurallarına uyulmalı.

## 7.4 CSV/XLSX fallback

MVP'de mutlaka desteklenmeli. CRM API kapsamı bilinmiyorsa ürün geliştirme yalnızca API'ye bağımlı kalmamalı.

- Alan eşleme ekranı
- Zorunlu alan doğrulama
- Duplicate tespiti
- Import preview
- Hatalı satır raporu
- Import geçmişi
- Aynı dosyanın tekrar import edilmesinde duplicate kayıt oluşturmama
- Kaynak sistem ve external ID saklama

CSV doğrulama, gerçek otomatik CRM entegrasyonunun doğrulandığı anlamına gelmez.

## 7.5 Sahibinden ve diğer ilan portalları

Portalların kurumsal ilan API'leri ile lead/performans API'leri aynı şey varsayılmamalı. Resmi ve izinli entegrasyon olmadan scraping yapılmamalı. Portföy bilgileri CRM veya yetkili veri kaynağından alınmalı.

---

# 8. Önerilen teknoloji yığını

MVP'de modüler monolith + ayrı background worker süreçleri tercih edilmeli. Her modülü ayrı mikroservise bölmek ilk sürümde gereksiz operasyon yüküdür.

## 8.1 Frontend

- **Next.js App Router + React + TypeScript**
- Tailwind CSS
- shadcn/ui veya benzer erişilebilir component sistemi
- TanStack Query: server state/data fetching
- React Hook Form + Zod: form ve schema validation
- Zustand yalnızca gerçekten global client state gerekiyorsa
- Video preview için native HTML video veya Remotion Player; editör oluşturulmayacak

Temel ekranlar:

1. Login / invitation
2. Workspace onboarding
3. CRM bağlantıları ve import
4. Dashboard
5. Portföy listesi
6. Property detail + analiz
7. Video generate/progress/result
8. Generation history
9. Credit & billing
10. Team/users
11. Admin/internal operations (ayrı yetki)

## 8.2 Backend

- **NestJS + TypeScript**
- REST API
- OpenAPI/Swagger
- Zod veya class-validator ile DTO validation (tek yaklaşım seç; iki validator'ı her katmanda karıştırma)
- Prisma ORM
- PostgreSQL
- Redis + BullMQ
- WebSocket veya Server-Sent Events ile job progress

Backend modülleri:

```text
src/
  auth/
  tenants/
  users/
  billing/
  credits/
  properties/
  leads/
  analytics/
  integrations/
    crm/
      adapters/
      sync/
  media/
  video-projects/
  video-generations/
  ai-providers/
    image-to-video/
    tts/
    llm/
    music/
  rendering/
  notifications/
  audit/
  admin/
```

## 8.3 Worker mimarisi

Aynı NestJS kod tabanı içinde ayrı process/container olarak worker çalıştırılabilir. En az iki kaynak profili:

1. **AI/Orchestration Worker:** provider API çağrıları, dosya hazırlığı, LLM/TTS/AI scene üretimi
2. **Render Worker:** Remotion/FFmpeg ve yoğun CPU/RAM işlemleri

İş yükü arttığında ayrı scale edilir.

Önerilen queue'lar:

- `crm-sync`
- `asset-analysis`
- `video-orchestration`
- `ai-video-generation`
- `tts-generation`
- `music-selection`
- `video-render`
- `quality-check`
- `notifications`

BullMQ job'ları küçük ve idempotent olmalı. Job state tek başına işin doğruluk kaynağı değildir; DB'de generation stage state tutulmalı.

## 8.4 Database

- PostgreSQL (managed service)
- Prisma migrations
- JSONB yalnızca esnek provider metadata veya versioned project manifest gibi uygun alanlarda
- İlişkisel alanlar JSONB içine saklanmamalı
- Tenant-scoped query ve unique constraint'ler kullanılmalı

## 8.5 Redis

- BullMQ queue storage
- Kısa ömürlü cache/rate-limit
- Session veya distributed lock ihtiyacı

Kalıcı iş kayıtlarının tek kopyası Redis'e bırakılmamalı. Önemli state PostgreSQL'de tutulmalı.

## 8.6 Object Storage

S3-compatible object storage (AWS S3, Cloudflare R2 veya uygun bölgesel sağlayıcı).

Bucket/prefix önerisi:

```text
raw/{tenantId}/{propertyId}/photos/...
normalized/{tenantId}/{propertyId}/...
generations/{tenantId}/{projectId}/{generationId}/ai-scenes/...
generations/{tenantId}/{projectId}/{generationId}/audio/...
generations/{tenantId}/{projectId}/{generationId}/renders/portrait.mp4
generations/{tenantId}/{projectId}/{generationId}/renders/landscape.mp4
```

- Private bucket
- Signed URL
- MIME ve dosya boyutu kontrolü
- Checksum/hash
- Lifecycle/retention policy
- Provider'a giden geçici URL'lerin süre ve erişim güvenliği

## 8.7 Video rendering

- **Remotion**: programmatic React-based composition
- **FFmpeg**: muxing, resampling, audio mixing, transcoding, thumbnails, post-processing
- Render işlemleri API server'da yapılmamalı; worker container'da çalışmalı.
- Project manifest JSON olarak versiyonlanmalı.
- Render deterministik ve tekrar üretilebilir olmalı; kullanılan composition version, font, asset, audio ve timing kaydedilmeli.
- Remotion ticari lisans şartları, ekip/şirket kullanımı ve deployment modeli launch öncesi kontrol edilmeli.

## 8.8 AI provider abstraction

Önerilen interface'ler:

```ts
interface ImageToVideoProvider {
  generate(input: ImageToVideoInput): Promise<ProviderJobResult>;
  getJob(jobId: string): Promise<ProviderJobStatus>;
  cancel?(jobId: string): Promise<void>;
  estimateCost(input: ImageToVideoInput): Promise<CostEstimate>;
  getCapabilities(): ModelCapabilities;
}

interface TextToSpeechProvider {
  synthesize(input: TtsInput): Promise<AudioAssetResult>;
  estimateCost(input: TtsInput): Promise<CostEstimate>;
}

interface LlmProvider {
  generateStructured<T>(input: StructuredGenerationInput): Promise<T>;
}

interface MusicProvider {
  selectOrGenerate(input: MusicInput): Promise<MusicAssetResult>;
}
```

Her provider adapter şunları döndürmeli:

- Provider name
- Model/endpoint ID
- External request ID
- Job ID
- Duration, resolution, seconds/tokens/characters
- Estimated cost
- Final billed cost (mümkünse)
- Currency
- Status/error code
- Raw metadata (PII içermeden)

## 8.9 Önerilen başlangıç provider'ları

### Image-to-video

- Birincil test adayı: fal.ai üzerinden Kling v3 Pro image-to-video
- Alternatif benchmark: Seedance 2.x, Veo veya diğer erişilebilir yüksek kaliteli modeller
- Ürün `fal.ai`'ye doğrudan bağımlı olmamalı; provider adapter zorunlu
- İlk model seçimi gerçek gayrimenkul fotoğrafları benchmark'ıyla yapılmalı.

### TTS

- Test adayı: ElevenLabs Multilingual v2 veya yeni Türkçe performansı daha iyi olan model
- TTS adapter ile model geçişi mümkün olmalı
- Türkçe sayısal ifade, yer isimleri ve telaffuz testleri zorunlu

### LLM / Vision

- Sağlayıcıdan bağımsız structured output kullanımı
- Görsel sınıflandırma, fotoğraf kalite kontrolü, sahne fikri ve metin üretimi için multimodal model
- Property facts doğrudan canonical data snapshot'tan gelmeli

### Music

- İlk sürümde ticari lisans durumu açık ve kanıtlanabilir bir müzik kütüphanesi
- Generative music provider sonraki fazda; ticari kullanım ve yeniden dağıtım hakkı doğrulandıktan sonra

---

# 9. Yüksek seviyeli sistem mimarisi

```text
                         ┌────────────────────────┐
                         │     Next.js Web App    │
                         │ Dashboard / Portfolio  │
                         │ Video / Credits / Team │
                         └───────────┬────────────┘
                                     │ HTTPS REST + SSE
                                     v
                         ┌────────────────────────┐
                         │       NestJS API       │
                         │ Auth / Tenant / Billing│
                         │ Properties / Credits   │
                         │ Video Orchestration    │
                         └──────┬─────────┬───────┘
                                │         │
                         SQL    │         │ Jobs
                                v         v
                       ┌────────────┐  ┌────────────┐
                       │ PostgreSQL │  │ Redis      │
                       │ Domain DB  │  │ BullMQ     │
                       └────────────┘  └─────┬──────┘
                                             │
                           ┌─────────────────┴────────────────┐
                           v                                  v
                 ┌──────────────────┐               ┌──────────────────┐
                 │ AI/Orchestration │               │ Render Workers   │
                 │ Asset/Vision     │               │ Remotion         │
                 │ Script/LLM       │               │ FFmpeg           │
                 │ Image-to-Video   │               │ Portrait/Landsc. │
                 │ TTS / Music      │               │ QC / Thumbnails  │
                 └─────────┬────────┘               └─────────┬────────┘
                           │                                  │
                           └────────────────┬─────────────────┘
                                            v
                                  ┌────────────────────┐
                                  │ S3-Compatible Store│
                                  │ Photos / Audio     │
                                  │ AI Clips / MP4     │
                                  └────────────────────┘

External systems:
  CRM (LeadPilot / CSV / future CRM adapters)
  AI providers (I2V / LLM / TTS / music)
  Payment provider
  Later: Meta Instagram API / social platforms
```

---

# 10. Veri modeli (önerilen başlangıç)

Bu, kesin Prisma schema değil; Claude implementasyon sırasında isimleri ve normalize yapıyı gözden geçirebilir. İş kuralları korunmalı.

## 10.1 Multi-tenant ana tablolar

### `Tenant`

- `id`
- `name`
- `slug`
- `status`
- `createdAt`
- `updatedAt`

### `User`

- `id`
- `email`
- `name`
- `passwordHash` veya external auth provider ID
- `status`
- `createdAt`

### `Membership`

- `id`
- `tenantId`
- `userId`
- `role` (`OWNER`, `ADMIN`, `MANAGER`, `MEMBER`, `VIEWER`)
- `createdAt`

Unique: `(tenantId, userId)`.

### `Subscription`

- `id`
- `tenantId`
- `planId`
- `providerSubscriptionId`
- `status`
- `currentPeriodStart`
- `currentPeriodEnd`
- `cancelAtPeriodEnd`

### `Plan`

- `id`
- `code`
- `name`
- `monthlyPriceMinor`
- `currency`
- `monthlyCredits`
- `freeRegenerationAllowance`
- `maxSeats`
- `maxCrmConnections`
- `retentionDays`
- `featuresJson`
- `isActive`

Plan limits DB/config bazlı olmalı; frontend içine hardcode edilmemeli.

## 10.2 Credit tables

### `CreditAccount`

- `id`
- `tenantId`
- `availableCredits`
- `reservedCredits`
- `updatedAt`

### `CreditLedger`

- `id`
- `tenantId`
- `accountId`
- `type` (`GRANT`, `RESERVE`, `CAPTURE`, `REFUND`, `TOP_UP`, `ADMIN_ADJUSTMENT`, `EXPIRY`)
- `amount` (işaretli integer)
- `referenceType`
- `referenceId`
- `idempotencyKey`
- `description`
- `createdByUserId`
- `createdAt`

Unique: `(tenantId, idempotencyKey)`.

### `FreeRegenerationAccount`

- `id`
- `tenantId`
- `periodStart`
- `periodEnd`
- `granted`
- `available`
- `reserved`
- `consumed`

### `FreeRegenerationLedger`

- `id`
- `tenantId`
- `videoProjectId`
- `generationId`
- `type` (`GRANT`, `RESERVE`, `CONSUME`, `RELEASE`, `EXPIRE`, `ADMIN_ADJUSTMENT`)
- `amount`
- `idempotencyKey`
- `createdAt`

## 10.3 CRM/property tables

### `CrmConnection`

- `id`
- `tenantId`
- `provider` (`LEADPILOT`, `CSV`, `GENERIC_REST`, ...)
- `status`
- `encryptedCredentials`
- `scopesJson`
- `capabilitiesJson`
- `lastSyncAt`
- `createdAt`

### `SyncRun`

- `id`
- `tenantId`
- `crmConnectionId`
- `status`
- `startedAt`
- `finishedAt`
- `recordsRead`
- `recordsCreated`
- `recordsUpdated`
- `recordsFailed`
- `errorSummary`

### `Property`

- `id`
- `tenantId`
- `crmConnectionId` nullable (manual/import source possible)
- `externalId` nullable
- `title`
- `description`
- `listingType` (`SALE`, `RENT`, `OTHER`)
- `propertyType`
- `priceAmount`
- `priceCurrency`
- `grossAreaM2`
- `netAreaM2`
- `bedroomCount`
- `bathroomCount`
- `floor`
- `buildingAge`
- `heatingType`
- `furnished`
- `country`
- `city`
- `district`
- `neighborhood`
- `latitude` / `longitude` nullable
- `status`
- `sourceUpdatedAt`
- `lastSyncedAt`
- `dataCoverageScore`
- `createdAt`
- `updatedAt`

Unique source constraint: `(tenantId, crmConnectionId, externalId)` where applicable.

### `PropertyAsset`

- `id`
- `tenantId`
- `propertyId`
- `sourceUrl` nullable
- `storageKey`
- `mimeType`
- `width`
- `height`
- `fileSize`
- `checksum`
- `sortOrder`
- `sourceType`
- `createdAt`

### `Lead`

- `id`
- `tenantId`
- `crmConnectionId`
- `externalId`
- `source`
- `status`
- `createdAtSource`
- `updatedAtSource`

PII alanları mümkün olan en az seviyede tutulmalı. MVP analiz için lead adı/telefonu gerekmiyorsa alınmamalı.

### `PropertyLeadRelation`

- `id`
- `tenantId`
- `propertyId`
- `leadId`
- `createdAt`

### `PropertyLeadMetric`

- `id`
- `tenantId`
- `propertyId`
- `periodStart`
- `periodEnd`
- `leadCount`
- `viewCount` nullable
- `clickCount` nullable
- `sourceCoverageJson`
- `calculatedAt`

## 10.4 Video tables

### `VideoProject`

- `id`
- `tenantId`
- `propertyId`
- `createdByUserId`
- `title`
- `status`
- `freeRegenerationUsed` boolean
- `generationCount`
- `createdAt`
- `updatedAt`

### `VideoGeneration`

- `id`
- `tenantId`
- `videoProjectId`
- `generationNumber`
- `status`
- `billingType` (`INITIAL_CREDIT`, `FREE_REGENERATION`, `PAID_REGENERATION`)
- `creditReservationId` nullable
- `freeRegenerationReservationId` nullable
- `propertySnapshotJson`
- `projectManifestJson`
- `projectManifestVersion`
- `videoDurationSeconds`
- `aiSceneCount`
- `aiVideoSeconds`
- `estimatedCostUsd`
- `actualCostUsd`
- `providerCostMetadataJson`
- `failureCode` nullable
- `failureMessageSafe` nullable
- `startedAt`
- `completedAt`
- `createdAt`

Unique: `(videoProjectId, generationNumber)`.

### `VideoScene`

- `id`
- `tenantId`
- `videoGenerationId`
- `sceneNumber`
- `sceneType` (`AI_VIDEO`, `PHOTO_MOTION`, `TITLE`, `CTA`, `OTHER`)
- `sourceAssetId` nullable
- `promptVersion` nullable
- `provider` nullable
- `model` nullable
- `durationSeconds`
- `assetStorageKey` nullable
- `status`
- `costUsd` nullable

### `VideoOutput`

- `id`
- `tenantId`
- `videoGenerationId`
- `format` (`PORTRAIT_9_16`, `LANDSCAPE_16_9`)
- `storageKey`
- `mimeType`
- `fileSize`
- `durationSeconds`
- `width`
- `height`
- `createdAt`

### `ProviderUsage`

- `id`
- `tenantId`
- `videoGenerationId`
- `provider`
- `model`
- `operation`
- `externalRequestId`
- `units`
- `unitType`
- `estimatedCost`
- `actualCost`
- `currency`
- `status`
- `rawMetadataJson`
- `createdAt`

## 10.5 Audit and observability

- `AuditLog`
- `WebhookEvent`
- `OutboxEvent` (transactional outbox pattern gerekli olduğunda)
- `SystemIncident`

---

# 11. API taslağı

Tüm endpoint'ler `/api/v1` altında versioned olmalı. Tenant context backend tarafından doğrulanmalı; client'ın gönderdiği `tenantId` tek başına yetki kanıtı değildir.

## 11.1 Auth / tenant

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /tenants`
- `POST /tenants`
- `POST /tenants/:tenantId/invitations`
- `GET /tenants/:tenantId/members`

## 11.2 CRM / import

- `GET /crm/providers`
- `POST /crm/connections`
- `POST /crm/connections/:id/test`
- `GET /crm/connections/:id/capabilities`
- `POST /crm/connections/:id/sync`
- `GET /crm/sync-runs/:id`
- `POST /imports/csv/preview`
- `POST /imports/csv/commit`

## 11.3 Properties / analytics

- `GET /properties`
- `GET /properties/:id`
- `GET /properties/:id/metrics`
- `GET /analytics/portfolio`
- `GET /analytics/recommendations`

## 11.4 Video

- `POST /properties/:propertyId/video-projects`
- `GET /video-projects`
- `GET /video-projects/:id`
- `POST /video-projects/:id/generations`
- `GET /video-generations/:id`
- `POST /video-generations/:id/cancel` (yalnızca güvenli aşamada mümkünse)
- `GET /video-generations/:id/outputs`
- `POST /video-generations/:id/feedback`

Generation create API `Idempotency-Key` header'ı desteklemeli.

## 11.5 Credits / billing

- `GET /billing/plan`
- `GET /billing/usage`
- `GET /credits/balance`
- `GET /credits/ledger`
- `GET /credits/free-regenerations`
- `POST /billing/checkout`
- `POST /billing/webhooks/:provider`

Provider webhook imzaları doğrulanmalı. Webhook duplicate delivery idempotent işlenmeli.

---

# 12. Video generation orchestration

## 12.1 Orchestration flow

```text
User clicks Generate
        |
        v
Validate tenant, property, plan and credits
        |
        v
Reserve one credit (or free regeneration entitlement)
        |
        v
Create VideoGeneration + snapshot + manifest version
        |
        v
Analyze source photos
        |
        v
Create new scene plan
        |
        +------> Generate new script
        |
        +------> Generate all new AI video scenes
        |
        +------> Generate new TTS narration
        |
        +------> Select/generate new music
        |
        v
Compose fresh project manifest
        |
        v
Render 9:16 and 16:9
        |
        v
Quality validation
        |
        +---- failure ---> refund reserved credit/free right, mark failed
        |
        v
Commit credit/free right consumption
        |
        v
Mark completed and notify user
```

## 12.2 Full regeneration davranışı

Regeneration aynı pipeline'ı tekrar çalıştırır. Önceki `VideoGeneration` read-only geçmiş olarak kalır. Yeni generation'ın manifest'i ayrı olmalı.

**Önceki generation cache'i yaratıcı output için kullanılmaz.**

Kaynak property snapshot'ı yeni generation başlangıcında CRM'den yeniden sync edilebilir veya kullanıcı onayıyla mevcut snapshot kullanılabilir. Ancak tüm yaratıcı adımlar yeni generation ID ve yeni creative outputs üretmelidir.

## 12.3 Job granularity

Tek büyük BullMQ job içinde her şeyi çalıştırma. Aşamaları küçük job'lara böl:

- `analyze-assets`
- `plan-scenes`
- `generate-script`
- `generate-ai-scene` (scene başına job)
- `generate-tts`
- `select-music`
- `compose-manifest`
- `render-output` (format başına job)
- `quality-check`
- `finalize-generation`

Parent/child Flow kullanılabilir. Her aşama DB state güncellemeli ve idempotent olmalı.

## 12.4 Failure strategy

Hataları şu kategorilere ayır:

- `PROVIDER_RATE_LIMIT`
- `PROVIDER_TIMEOUT`
- `PROVIDER_JOB_FAILED`
- `PROVIDER_AUTH_ERROR`
- `ASSET_DOWNLOAD_FAILED`
- `INVALID_MEDIA`
- `LLM_SCHEMA_INVALID`
- `TTS_FAILED`
- `MUSIC_LICENSE_OR_ASSET_ERROR`
- `RENDER_FAILED`
- `STORAGE_UPLOAD_FAILED`
- `QUALITY_REJECTED`
- `USER_CANCELLED`
- `INTERNAL_ERROR`

Geçici provider hataları exponential backoff ve jitter ile retry edilebilir. Ancak retry sayısı, provider maliyeti ve job idempotency birlikte düşünülmeli.

- Provider request duplicate edilmeden önce mevcut external job ID kontrol edilmeli.
- Aynı scene job başarısız diye generation'ın bütün başarılı aşamaları tekrar ücretlendirilmemeli; fakat kullanıcı regeneration başlatırsa bütün kreatif süreç sıfırdan başlar.
- Sistem kaynaklı başarısız generation için rezervasyon iade edilir.
- Provider'da başarılı output alındıktan sonra final render başarısızsa iç retry yapılabilir; kullanıcıya teslim edilemiyorsa iş başarısız sayılır ve entitlement iade edilir. Bu retry'ların iç maliyeti `ProviderUsage`'a kaydedilir.
- Kullanıcının beğenmemesi teknik hata değildir ve otomatik kredi iadesi doğurmaz.

---

# 13. Güvenlik, KVKK ve veri yönetişimi

Bu sistem CRM lead kayıtları, iletişim bilgileri, gayrimenkul portföyü, kullanıcı hesapları ve görseller işleyebilir. Kişisel veri kapsamı en aza indirilmeli.

## 13.1 Temel ilkeler

- Veri minimizasyonu: Video ve analiz için gerekli olmayan lead kişisel verilerini çekme.
- Tenant isolation: Tüm query'ler tenant scope ile korunmalı.
- Role-based access control.
- TLS in transit.
- At-rest encryption.
- CRM OAuth/API secret/token'ları KMS veya envelope encryption ile saklanmalı.
- Secret'lar loglanmamalı.
- Admin erişimleri audit edilmeli.
- Dosya indirme için kısa süreli signed URL kullanılmalı.
- Upload dosyaları MIME, magic bytes, boyut ve mümkünse malware taramasından geçirilmeli.
- Backup ve restore testleri yapılmalı.
- Veri saklama ve silme politikası belirlenmeli.

## 13.2 KVKK operasyonu

- İşleme amacı, veri kategorileri, hukuki sebep ve saklama süresi hukuk danışmanıyla belirlenmeli.
- Workspace müşterisi ile platform sağlayıcısının veri sorumlusu/veri işleyen rolleri sözleşmeyle netleştirilmeli.
- Veri işleme sözleşmesi (DPA) hazırlanmalı.
- Alt işleyenler (AI provider, cloud storage, email, payment) envantere alınmalı.
- Yurt dışına veri aktarımı, provider lokasyonu ve güncel KVKK şartları değerlendirilmeden kişisel veri aktarımı yapılmamalı.
- Veri sahibi başvurusu, silme/düzeltme ve veri ihlali müdahale süreçleri tasarlanmalı.
- CRM lead verisini AI provider'a göndermemek; AI prompt'larında kişisel veriyi kullanmamak temel ilke olmalı.

Bu bölüm hukuki görüş yerine geçmez; canlıya çıkmadan güncel KVKK mevzuatı ve transfer kuralları için profesyonel inceleme gerekir.

## 13.3 AI çıktısında doğruluk ve sorumluluk

- AI sahneleri mülkün gerçek özelliklerini değiştirebilir.
- Kullanıcı videoyu yayınlamadan önce izlemeli ve sorumluluğu kullanıcı onayına bağlı olmalı.
- İlk fazda otomatik yayınlama yok.
- Kullanıcıya AI generated/AI enhanced içerik açıklaması ve kullanım şartı sunulması hukuk/marka kararı olarak değerlendirilmelidir.

---

# 14. Admin paneli, ölçümleme ve operasyon

Admin paneli sadece iç ekip/authorized admin erişimine açık olmalı.

Gösterilecek metrikler:

- Günlük/haftalık/aylık generation sayısı
- Başarılı/başarısız generation oranı
- Ortalama generation süresi
- Ortalama AI scene count
- Ortalama AI seconds per video
- Generation başına provider cost
- Workspace başına maliyet
- Ücretsiz regeneration kullanım oranı
- Paket bazında tüketim
- Credit refund ve admin adjustment hareketleri
- Provider hata dağılımı
- Queue wait time
- Render worker utilization
- Storage büyümesi
- Model kalite değerlendirmeleri

Alarm eşikleri:

- Provider maliyeti plan tahminini aşarsa
- Fail rate belirli eşiğin üzerine çıkarsa
- Queue bekleme süresi artarsa
- Storage/upload hataları yükselirse
- Billing webhook teslim edilemezse
- Credit ledger ile account balance reconcile farkı oluşursa

Log/trace/correlation ID her request ve generation boyunca taşınmalı. PII loglanmamalı.

---

# 15. Test stratejisi ve Definition of Done

## 15.1 Unit tests

- Credit reserve/capture/refund
- Free regeneration eligibility
- One-free-regeneration-per-project rule
- Plan allowance reset
- Credit expiry/top-up rules
- Tenant authorization
- CRM field mapping
- Script fact validation
- Manifest schema
- Provider cost estimate calculation

## 15.2 Integration tests

- Provider adapter with mocked API
- Real provider sandbox/staging test
- CRM adapter with fixture data
- CSV import duplicate handling
- BullMQ retry/idempotency
- Storage signed URL and upload
- Render worker test fixture
- Payment webhook signature and idempotency

## 15.3 E2E acceptance tests

1. Yeni tenant oluşturulur ve kullanıcı davet edilir.
2. CSV import yapılır ve property listesinde görünür.
3. Property detail açılır ve data coverage gösterilir.
4. İlk video generation 1 kredi rezervasyonuyla başlar.
5. Video tamamlanır, iki format output bulunur ve kredi capture edilir.
6. İlk regeneration, free pool uygunsa ücretsiz hak rezervasyonuyla başlar.
7. Regeneration pipeline önceki AI scene, TTS, music, script ve render asset'lerini kullanmaz.
8. Aynı project içindeki ikinci regeneration 1 kredi harcar.
9. Free pool bitmişse başka project'teki ilk regeneration da 1 kredi harcar.
10. Provider veya render hatasında kredi/free entitlement iade edilir.
11. İki paralel regeneration isteği aynı tek ücretsiz hakkı iki kez tüketemez.
12. Kredi sıfır ise ücretli generation engellenir.
13. Tenant A'nın kullanıcısı Tenant B property/video dosyasına erişemez.

## 15.4 Definition of Done

Bir modül ancak:

- Typecheck geçiyor
- Lint geçiyor
- İlgili unit/integration testleri geçiyor
- Error handling ve logging var
- Yetkilendirme/tenant scope kontrol edilmiş
- Migration uygulanmış ve rollback yaklaşımı dokümante edilmiş
- UI loading/empty/error state'leri var
- API schema dokümante edilmiş
- Geliştirici README güncellenmiş

olduğunda tamamlandı sayılır.

---

# 16. Uygulama yol haritası

## Milestone 0 — Repo ve kararların doğrulanması

- Repository incelemesi
- Node/TS framework sürüm sabitlemesi
- Environment setup
- Lint/typecheck/test pipeline
- Database ve Redis local setup
- Architecture decision records (ADR)

**Çıktı:** Çalışan iskelet, README, local dev talimatları.

## Milestone 1 — Multi-tenant SaaS temel yapısı

- Auth
- Tenant/workspace
- Membership/roles
- Plan entitlements modeli
- Audit log
- Base navigation/UI

**Çıktı:** Kullanıcı ve workspace yönetimi.

## Milestone 2 — Property data foundation

- Canonical property model
- CSV/XLSX import
- Photo storage
- Asset metadata
- Property list/detail
- Data coverage

**Çıktı:** CRM bağımsız portföy veri altyapısı.

## Milestone 3 — CRM adapter framework

- Adapter contract
- LeadPilot API access/scope verification
- LeadPilot adapter (yalnız doğrulanmış endpoint'lerle)
- Sync runs
- Polling/webhook strategy
- Reconciliation and idempotency

**Çıktı:** İlk gerçek CRM entegrasyonu veya API kapsamı doğrulanamazsa kullanılabilir CSV fallback.

## Milestone 4 — Credit & billing core

- Plan catalog
- Credit account/ledger
- Free regeneration account/ledger
- Reservation/capture/refund
- Package period reset
- Admin adjustments
- Billing provider integration

**Çıktı:** Kredi ve ücretsiz hak sistemi testlerle güvence altında.

## Milestone 5 — Video pipeline vertical slice

Önce tek property ve tek test generation akışı:

- Photo analysis
- Scene plan
- Script
- TTS
- Music
- 1–2 AI scenes
- Remotion composition
- FFmpeg render
- Storage + preview

Sonrasında 3–6 AI scene, 30–60s ve iki format genişletilir.

**Çıktı:** Gerçek bir property datasından uçtan uca video.

## Milestone 6 — Full regeneration + production hardening

- Tam regeneration pipeline
- Previous generation creative asset non-reuse testleri
- Credit/free entitlement tests
- Provider retries
- Cost metering
- Job progress
- Admin usage dashboard

**Çıktı:** Ticari kuralları doğru uygulayan üretim sistemi.

## Milestone 7 — Analytics & recommendations

- Lead/property relation
- Metric aggregation
- Coverage/confidence
- Portfolio recommendations
- Basic dashboard

**Çıktı:** Portföy performansı ve video öneri akışı.

## Milestone 8 — Pilot ve fiyat doğrulaması

- 3–5 gerçek emlak ofisiyle pilot
- 20–30 gerçek property fotoğraf seti
- 30–50 video generation
- Ücretsiz yeniden üretim oranı
- Gerçek video cost per generation
- Kullanıcı memnuniyeti ve edit ihtiyacı
- Paket fiyatı ve AI scene budget güncellemesi

**Çıktı:** Fiyatlandırma ve production policy için gerçek veri.

## Milestone 9 — Social publishing (sonraki faz)

- Meta OAuth/permissions
- Instagram Business/Creator account connection
- Publishing API flow
- Media requirements
- Insights sync
- Publication status + retry

Yayınlama entegrasyonu için Meta API permissions, account type, app review ve platform limitleri önceden doğrulanmalı. Kullanıcı onayı olmadan yayın yapılmamalı.

---

# 17. Ürün kararları ve açık riskler

## Kesinleşmiş kararlar

- Ürün adı henüz seçilmedi.
- Ana hedef ilk etapta emlak ofisleri, mimari genişleme ise sektör bağımsız AI platformuna uygun.
- Video kullanıcı açısından tek butonla oluşturulacak.
- Video 30–60 saniye olacak.
- Dikey ve yatay çıktı sunulacak.
- Görsel kalite en yüksek öncelik.
- AI sahne sayısı sabit 2–3 olmayacak; fotoğraf ve içerik yoğunluğuna göre 3'ten fazla olabilir.
- Seçilmiş sahneler AI image-to-video, diğer sahneler gerçek fotoğraf animasyonu olabilir.
- Kullanıcı tam video çıktısını inceler; editör/timeline kullanmaz.
- Her video zincirinde en fazla 1 ücretsiz tam yeniden üretim hakkı vardır.
- Paket bazında toplam ücretsiz yeniden üretim havuzu vardır.
- Ücretsiz havuz bittiğinde veya video zinciri ücretsiz hakkını kullandıktan sonra her yeniden üretim 1 kredi harcar.
- İlk generation 1 kredi harcar.
- Teknik hatada kredi/ücretsiz hak iade edilir.
- Kullanıcı beğenmediyse bu teknik hata değildir.
- Tam yeniden üretimde AI sahneleri, fotoğraf analizi, senaryo, TTS, müzik, animasyon, geçiş ve render baştan yapılır.
- Orijinal kaynak fotoğraflar ve doğrulanmış property snapshot tekrar kullanılabilir.
- Önceki generation'ın yaratıcı çıktısı yeni generation'da kullanılmaz.
- İlk CRM LeadPilot olabilir ancak ürün LeadPilot'a bağımlı olmayacak.
- CSV/XLSX fallback olmalı.

## Pilot öncesi doğrulanacak riskler

1. LeadPilot API gerçek kapsamı ve erişim şartları
2. AI image-to-video model benchmark'ı
3. Kling/Seedance/Veo gibi modellerde mimari tutarlılık
4. Aynı AI clip ile dikey/yatay crop kalitesi
5. Türkçe TTS kalitesi ve telaffuz
6. Müzik ticari lisans kapsamı
7. Her video için gerçek AI scene seconds
8. Kullanıcıların ücretsiz regeneration kullanma oranı
9. TL fiyatlarının müşteri ödeme isteği
10. Provider veri saklama, privacy ve data processing şartları
11. Remotion commercial license
12. Sosyal medya yayın API izinleri

---

# 18. Claude'un uygulama sırası ve kodlama standardı

Claude Code aşağıdaki sırayı izlemeli:

1. Repository audit ve plan
2. Monorepo ihtiyacını değerlendir. İlk sürüm için gereksiz package ayrımı yapma.
3. Shared TypeScript types ve config
4. PostgreSQL schema + migrations
5. Tenant/auth/roles
6. Property + import
7. Credit/ledger domain ve testler
8. Video project/generation domain
9. BullMQ orchestration
10. Mock provider adapters
11. Tek gerçek image-to-video provider
12. TTS/music adapter
13. Remotion renderer
14. UI integration
15. Full regeneration tests
16. Admin usage/cost page
17. CRM adapter

## Kod kalitesi

- Strict TypeScript
- `any` kullanımını mümkün olduğunca engelle
- Domain logic controller içine koyma
- Provider SDK çağrısı domain service içine gömülmemeli
- Tüm monetary values integer minor units veya decimal-safe representation ile saklanmalı
- USD provider cost için currency ve exchange-rate snapshot tut
- Tarihler UTC saklanmalı; tenant locale/timezone UI'da uygulanmalı
- API request validation zorunlu
- Structured logging
- Idempotency key
- Timeouts
- Exponential backoff + jitter
- Circuit breaker gerekirse provider adapter katmanında
- Secret management
- DB transaction ve unique constraint
- Background job idempotency
- Unit + integration + E2E test

## Ortam değişkenleri örneği

```env
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
AUTH_SECRET=
ENCRYPTION_KEY=
FAL_API_KEY=
ELEVENLABS_API_KEY=
PAYMENT_PROVIDER_SECRET=
PAYMENT_WEBHOOK_SECRET=
```

Gerçek secret değerleri `.env.example` içine konulmamalı. Sadece placeholder.

---

# 19. Resmî teknik kaynaklar ve fiyat referansları

> Fiyatlar ve provider yetenekleri zamanla değişebilir. Uygulamaya sabit değer olarak gömmek yerine provider konfigürasyonu ve usage meter üzerinden yönet.

## AI video

- fal pricing: https://fal.ai/pricing
- fal image-to-video model explorer: https://fal.ai/explore/image-to-video-apis
- Kling v3 Pro image-to-video endpoint, capabilities and pricing: https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video

21 Kasım 2026 tarihinde kontrol edilen Kling v3 Pro özel endpoint sayfası ses kapalı $0.112/s, ses açık $0.168/s belirtmektedir. Genel fal pricing sayfasında Kling v3 Pro için $0.14/s listesi görüldüğünden endpoint/parametre bazında maliyet yeniden doğrulanmalıdır.

## Text-to-speech

- ElevenLabs API pricing: https://elevenlabs.io/pricing/api
- ElevenLabs TTS API overview: https://elevenlabs.io/text-to-speech-api

21 Kasım 2026 tarihinde pricing sayfasında Multilingual v2 için $0.10/1K karakter ve Flash/Turbo için $0.05/1K karakter gösterilmektedir. Türkçe kalite benchmark'ı yine de gereklidir.

## Frontend

- Next.js App Router: https://nextjs.org/docs/app
- Next.js installation: https://nextjs.org/docs/app/getting-started/installation

## Backend / Queue

- NestJS queues: https://docs.nestjs.com/techniques/queues
- BullMQ docs: https://docs.bullmq.io/
- BullMQ idempotent jobs: https://docs.bullmq.io/patterns/idempotent-jobs

## Video rendering

- Remotion render docs: https://www.remotion.dev/docs/render
- Remotion SSR docs: https://www.remotion.dev/docs/ssr

## KVKK

- KVKK Veri Güvenliğine İlişkin Yükümlülükler: https://www.kvkk.gov.tr/Icerik/2040/Veri-Guvenligine-Iliskin-Yukumlulukler

## Döviz referansı

- 21 Kasım 2026 USD/TRY referans değeri için: https://waverate.app/rates/usd-to-try
- TCMB kurlarını yayımlayan Resmî Gazete: https://www.resmigazete.gov.tr/

---

# 20. Son ürün ilkesi

Bu ürün bir video editörü değildir. Kullanıcıya karmaşık üretim araçları sunmak yerine, CRM ve kaynak verilerinden otomatik pazarlama çıktısı üretir.

Kullanıcı deneyimi basit kalmalı; karmaşıklık orchestration, provider adapter, render worker, kredi kontrolü, veri doğruluğu ve kalite kontrol katmanlarında çözülmelidir.

En kritik başarı ölçütü kaç özellik geliştirdiğimiz değil:

1. Kullanıcı gerçekten kaliteli video alıyor mu?
2. Mülkün gerçek özellikleri korunuyor mu?
3. Kullanıcı bunu minimum eforla yapabiliyor mu?
4. Ücretsiz yeniden üretim dahil her generation'da pozitif birim ekonomi korunuyor mu?
5. CRM verisi güvenilir ve yeterince kapsamlı mı?

Bu beş soruya gerçek pilot verisiyle olumlu yanıt verilmeden ölçekleme yapılmamalıdır.
