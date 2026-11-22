# Milestone 6 — Gerçek sağlayıcı adaptörleri

> Blueprint: §5.3, §8.8, §8.9, §12.4, §16 M6
> Durum: **Kod yazıldı. Anahtarlar gelene kadar varsayılan sağlayıcılar mock.** Testler henüz çalıştırılmadı.

## Kapsam

- Görüntü→video: fal.ai üzerinden Kling (`PROVIDER_I2V=fal`).
- Senaryo (LLM): Anthropic Messages API, yapısal çıktı + sayı doğrulaması (`PROVIDER_LLM=anthropic`).
- Seslendirme (TTS): ElevenLabs (`PROVIDER_TTS=elevenlabs`).
- Müzik: lisanslı katalog dosyası (`PROVIDER_MUSIC=catalog`). Katalog yoksa üretim başlamaz.
- Her çağrıda zaman aşımı, sınırlı yeniden deneme (429/5xx/ağ), hata eşlemesi (§12.4), kullanım kaydı.
- Gerçek sağlayıcı seçili ama anahtarı yoksa API ve worker **başlamaz** (fail-fast).

## Doğrulanacaklar (anahtar gelince, resmi dokümandan)

Bu kod resmi API şemalarını ezbere yazdı. Anahtar gelmeden önce aşağıdakiler resmi dokümanla
karşılaştırılmalı ve gerekirse düzeltilmeli. Bu maddeler doğrulanmadan gerçek çağrı yapılmaz.

1. fal Kling v3 Pro: istek gövdesi alanları (`prompt`, `image_url`, `duration`), kuyruk uç noktaları
   (`queue.fal.run`, `/status`, sonuç), sonuç JSON'undaki video URL alanı.
2. Anthropic Messages: model kimliği (`LLM_MODEL`), `anthropic-version` başlığı, yanıt içerik bloğu.
3. ElevenLabs: `output_format`, `model_id`, ses kimliği (`ELEVENLABS_VOICE_ID`), Türkçe model.
4. Görüntü URL'si: fal sunucusu depodaki imzalı URL'ye erişebilmeli (yerelde erişilemez; M6 deploy
   gereksinimi: `OBJECT_STORAGE_PUBLIC_ENDPOINT`).
5. Müzik kataloğu: ticari kullanım ve yeniden dağıtım lisansı belgesi.

## Bilinen sınırlar

- Gönderim ile iş kimliğinin DB'ye yazılması arasında çökme olursa aynı klip iki kez gönderilebilir
  (fal idempotency anahtarı desteklemiyorsa). Maliyet `ProviderUsage` ile izlenir.
- Gerçek faturalanan maliyet yerine tahmin kaydedilir; faturalar gelince düzeltilecek.
