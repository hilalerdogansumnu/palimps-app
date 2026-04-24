# Data Governance — Geliştirici Özeti

> **Canonical dokümanlar** `docs/governance/` altındadır:
> - `PALIMPS-Veri-Sozlugu.xlsx` — tüm kolonların tam referansı (PII, retention, amaç)
> - `PALIMPS-Data-Governance-Policy.docx` — formal politika (KVKK + GDPR)
> - `PALIMPS-Data-Quality-KPIs.xlsx` — 8 ölçülebilir KPI + olay günlüğü
>
> Bu markdown, geliştirici tarafının hızlı bakacağı PR checklist ve terim
> sözlüğüdür. Politika değişikliği gerektiğinde docx/xlsx güncellenir; bu
> dosya onlara işaret eder.

---

## Öz (30 saniyede)

PALIMPS dört tablolu bir MySQL veritabanı (`users`, `books`,
`reading_moments`, `subscriptions`), iki önekli bir R2 bucket (`covers/`,
`pages/`), bir Keychain (token + user cache) ve beş AsyncStorage anahtarı
işletir. Dışarıda bağımlı olduğumuz altı üçüncü taraf var: Apple, Google
Gemini, Cloudflare, Railway, RevenueCat, Sentry. Her biri için DPA
doğrulanmıştır.

Veriler beş sınıftan birine atanır: **Kişisel Veri (PII)**, **Gizli**,
**İç**, **Açık**, **Geçici**. Sınıf, saklama ve loglama kurallarını
belirler.

---

## PR Checklist

Yeni bir veri noktası (kolon, alan, bucket key, storage anahtarı, 3.
taraf entegrasyonu) ekliyorsan PR'ında şunlar olmak zorunda:

- [ ] **Veri Sözlüğü güncellendi** — `docs/governance/PALIMPS-Veri-Sozlugu.xlsx` içinde
  ilgili sheet'e satır eklendi (tip, PII sınıfı, retention, amaç).
- [ ] **Sınıflandırma kararlaştırıldı** — PII / Gizli / İç / Açık / Geçici.
  Şüphede kaldıysan PII kabul et (en koruyucu sınıf).
- [ ] **Retention yazıldı** — varsayılan "hesap silinene kadar". Farklıysa
  politikaya referans ver.
- [ ] **Silme akışı güncellendi** — `Hesabımı Sil` endpoint'inde yeni
  veriyi de temizliyoruz mu? (PII ise evet.)
- [ ] **Aydınlatma Metni etkisi değerlendirildi** — yeni bir amaç ya da
  yeni bir 3. taraf ise Aydınlatma Metnine ek satır.
- [ ] **Loglama gözden geçirildi** — yeni alan Sentry breadcrumb'ına ya da
  console.log'a düşmüyor mu? PII asla log'a yazılmaz.
- [ ] **Yeni 3. taraf eklendiyse DPA imzalandı** — ve Veri Sözlüğünde
  "Üçüncü Taraf API" sheet'ine eklendi.

---

## Sınıflandırma — Pratik Kılavuz

| Sınıf | Nedir | Örnek | Log'a gider mi? |
|-------|-------|-------|------------------|
| Kişisel Veri (PII) | Kullanıcıya bağlanabilen her şey | `users.name`, `pageImageUrl`, `userNote` | **Hayır** (dikkatlice hash'lenmiş olsa bile) |
| Gizli | Sızıntıda hesap ele geçirilir | `app_session_token`, R2 credentials | **Asla** |
| İç | Pseudonymous operasyonel | `createdAt`, `isPremium`, `release` tag | Evet (PII olmadığı sürece) |
| Açık | Cihaz tercihi | Dil, tema | Evet (genelde gerek de yok) |
| Geçici | Tek istekte var | Gemini OCR request/response | Loglanmaz (sadece hata varsa) |

**Pratik kural:** bir alan hakkında karar verirken "bu alanı bir saldırgan
görürse ne kaybederiz?" diye sor. Hesap kaybedersek → Gizli. Kullanıcı
mahremiyeti kaybederiz → PII. Sadece teknik borç → İç.

---

## Saklama (Retention) — Quick Reference

```
users                 → hesap silinene kadar
books, moments        → hesap silinene kadar (kullanıcı tekil silebilir)
R2 covers/ pages/     → hesap silinene kadar (tekil silmeyle beraber)
subscriptions history → hesap silindikten sonra 12 ay pseudonymized
Sentry events         → 90 gün (Sentry varsayılan)
Gemini requests       → 48 saat (Google op log)
Session token         → çıkışa kadar
```

Hesap silme SLA: **7 gün iç hedef, 30 gün KVKK tavanı.**

---

## Veri Sahibi Talepleri (DSR)

KVKK Md. 11 / GDPR Art. 15-22 kapsamında bir talep gelirse:

1. Talebi `docs/governance/PALIMPS-Data-Quality-KPIs.xlsx` → "Olay
   Günlüğü" sheet'ine düş (DQ-08 KPI'ı bunu izliyor).
2. 30 günlük yasal süre saati çalışmaya başlar.
3. Veri Sahibi Haklarının dökümü — politika §9.
4. Uygulama içi "Hesabımı Sil" akışı DSR'nin çoğunu karşılar; karmaşık
   taleplerde (örn. "sadece X kitabı silinsin, kalan kalsın") manuel
   yanıt.

---

## KPI'lar — Ne Gördüğünde Neyi Tetikle

| KPI | Amber'e düşerse | Kırmızı'ya düşerse |
|-----|-----------------|--------------------|
| DQ-01 OCR başarı | OCR prompt'unu review et | Gemini model/endpoint problemi — rollback düşün |
| DQ-02 Sahipsiz R2 | Reconcile script'ini manuel çalıştır | Silme akışı bozuk — bug triage |
| DQ-03 Eksik zorunlu alan | Migration/schema drift | Data loss — incident |
| DQ-04 Duplicate openId | Unique constraint düşmüş | Incident — auth akışı bozuk |
| DQ-05 Premium cache tutarlılık | Webhook gecikmesi | RevenueCat webhook bozuk — §12 |
| DQ-06 OCR latency p95 | Gemini yavaş | Kullanıcı deneyimi bozuk — paralelizasyon düşün |
| DQ-07 Crash-free session | Release health gate tehlikede | Rollout durdurulur (AMND-2026-001) |
| DQ-08 Silme SLA | İşlem biriktir | KVKK ihlali riski — §9 |

Review kadansı ve tam ölçüm SQL'i: `PALIMPS-Data-Quality-KPIs.xlsx`.

---

## Değişiklik Yönetimi

Canonical dokümanların değişikliği bu repo ile beraber commit edilir.
Her değişiklik:

1. `git log -- docs/governance/` üzerinden izlenir.
2. docx / xlsx içindeki "Versiyon Geçmişi" tablosuna da satır eklenir.
3. Major değişiklik (yeni üçüncü taraf, yeni veri sınıfı) olduğunda
   Aydınlatma Metni de güncellenir.

Küçük hata düzeltmeleri (typo, örnek değer) için versiyon bump'ı gerekmez;
büyük değişiklik için v1.1, v2.0 gibi SemVer benzeri kademe kullan.
