# PALIMPS — Decision Log

Solo dev için yazılı hafıza. `palimps-retrospective-engineer` skill'i bu
dosyanın ownership'ini taşır. Post-incident writeup, release retro,
abandoned-path kaydı ve "daha önce buradaydık" pattern detection'ı için
tek referans noktası.

**Format:** Reverse-chronological (en yeni üstte). Her giriş:

```
## YYYY-MM-DD — Tek cümle başlık
Bir-iki cümle bağlam: niye bu karar alındı, alternatif neydi, nerede
değişiklik oluyor (dosya / env var / config).
```

---

## 2026-04-24 — Session expire graceful handling (IOS-4 fix, _layout.tsx)

Sentry IOS-4 (TRPCClientError "Please login 10001", 7 events / 1 user / 5 days)
+ IOS-1 (release-health-check, aynı trace ID) kök sebebi: chat.send 401
dönüşünde client graceful handle etmiyor, TRPCClientError uncaught → Sentry.
Fix: app/_layout.tsx'e global QueryCache + MutationCache onError handler
eklendi. isSessionExpireError() (httpStatus 401 / code UNAUTHORIZED /
"Please login" regex) yakalayınca: Auth.removeSessionToken + clearUserInfo
+ notifyAuthChange fire. useAuth hook re-fetch, isAuthenticated=false →
AuthGuard useEffect router.replace("/login"). Duplicate 401 guard'ı var
(sessionExpireInProgress + 2sn reset). Sentry.addBreadcrumb kullanılır,
captureException DEĞİL — expected flow (TTL, revocation).

TestFlight validation: 24+ saat bekle → chat'e mesaj yaz → login'e
otomatik redirect olmalı, error alert'te takılmamalı.

## 2026-04-24 — ErrorBoundary full rewrite (palette + i18n)

components/error-boundary.tsx'te iki cardinal sin bulundu: (1) hardcoded
Turkish metinler ("Bir şeyler yanlış gitti", "Tekrar Dene") — EN user
crash ekranında Türkçe görüyordu, (2) hardcoded hex palette ios-developer
skill'in stale amber/green varsayılanı (#FFFDF7 + #3D7A5F) — PALIMPS
gerçek mor/lavender brand paletten kopuk bir kaza ekranı. Fix: class
component functional wrapper (ErrorBoundary) içine alındı. Wrapper
useColors() + useTranslation() çağırıp class'a prop olarak injection
yapıyor. locales'e errors.unhandled.{title, subtitle, retry} eklendi
TR + EN.

## 2026-04-24 — rn Image cardinal sin tamamen eliminate edildi

6 ekranda rn Image → expo-image migration: moment/[id], book/[id],
add-moment/[bookId], add-book, tag/[name]. ocr-edit.tsx 397 satır orphan
screen silindi. Tüm call-site'lar artık contentFit + transition + surface
backgroundColor fallback + accessibilityLabel ile tutarlı. Silent Image
fail (50331 dogfood bug gibi) user-facing app'te artık yok.

## 2026-04-24 — 50331 dogfood bug: blank moment card — expo-image + placeholder fix

Hilal 06:29'da AN eklediğinde kart body'si boş göründü (userNote "!!!" + tarih
görünüyordu; image + ocrText blank). 06:58'de app restart sonrası düzeldi.

**Tanı (3 halka):**
1. OCR server'da 2 deneme de fail → `ocrText = null` by design (graceful
   degradation; comment: "OCR başarısız olsa bile devam et" line 593-594).
2. Image render yanıt verdi ama `pageImageUrl` RN Image ile silent fail
   (403/propagation delay/TTL whatever) → blank Image area. Cardinal sin
   (ios-developer skill "never use rn Image, use expo-image").
3. "Incomplete moment" state design edilmemişti — empty state + loading
   state vardı ama "moment var, içeriği kısmi" için placeholder yoktu.

**Fix uygulandı:**
- `app/book/[id].tsx` moment card: `Image` from react-native → `Image` from
  expo-image + `contentFit` + `transition={200}` + backgroundColor surface +
  accessibilityLabel. Silent fail → surface-renk fallback.
- Incomplete-moment placeholder: `!pageImageUrl && !ocrText` durumunda
  hourglass ikonu + "An işleniyor…" + "Birkaç saniye sonra tekrar kontrol et"
  copy'si (TR + EN locale key'leri eklendi).

**Observability gap belgelendi (Task #17, v1.0.1):** Hilal Sentry feed'e baktı
06:29 bug saatinde kayıt yok. OCR fail server console.warn (Railway only),
client silent Image fail breadcrumb'sız. v1.0.1'de Sentry-server + client
breadcrumb discipline.

**Not:** Bu bug "data kaybı" değil — moment DB'de doğru kaydedilmiş, sadece
render blank'di. Yine de launch-critical, çünkü kullanıcı "an kaydolmadı"
paniği yaşar ve retry yapar (double-save riski).

## 2026-04-23 — Product audit Gün 1, 4 submit blocker fix edildi

product-designer skill audit taraması 6/15 ekranda 4 submit blocker tespit
etti, dördü de aynı gece düzeltildi:
(1) `app.tagline` website ("Kitap okuma hafızan") ile app tr.json + en.json
    arasındaki tutarsızlık — hizalandı (website canonical).
(2) `app/(tabs)/index.tsx` sortBy dead UI state — state + handler + 4-way
    switch memo koddan çıkarıldı; sortedSearchResults memo sadeleşti ve her
    zaman relevance-sort yapıyor. "Remove before you add" (Linear prensibi).
    v1.1'de gerçek kullanım sinyali gelirse Segmented Control ile geri
    eklenebilir, o zaman toLocaleLowerCase("tr-TR") da şart olacak (Turkish
    "İ" gotcha, CLAUDE.md).
(3) `app/(tabs)/index.tsx:558` hardcoded `{count} an` — aynı dosyada mevcut
    `t("home.momentCount", { count })` helper'ı kullanacak şekilde düzeltildi.
    EN locale parity.
(4) `app/premium.tsx:140` hardcoded "Premium üyesiniz" — `t("premium.alreadyPremium")`
    ile sarıldı; locales dosyasında key zaten mevcuttu. Apple reviewer paywall
    ziyareti için kritikti.
Kalan 10 ekran Gün 2 taramasında — öncelik moment/[id].tsx (launch'ın yeni
highlights + marginalia feature hero ekranı).

## 2026-04-23 — EAS project slug rename: okuma-hafizasi-mvp → palimps

app.config.ts appSlug değiştirildi. EAS projectId UUID
(f64f8212-7a0a-47f9-bb64-b2d4d6870ccd) aynı — build geçmişi, submissions,
TestFlight state kaybolmuyor. Sadece dashboard URL değişiyor. rawBundleId
(space.manus.okuma.hafizasi.mvp...) ise Apple App Store Connect identity
olduğu için değiştirilemez; v2 yeni app olarak launch ederse ancak
kurtulunabilir. logoUrl (manus S3 legacy ref) dead code olarak comment'lendi,
v1.0.1 cleanup'ta silinir. Hilal expo.dev UI'dan da dashboard rename
yapacak.

## 2026-04-23 — Kill switch regression: source-scan pattern seçildi

Integration test harness (tRPC caller + invokeLLM mock + DB mock) codebase'te
yok. Full mock'lu integration testi yazmak 2-4 saatlik iş; Cuma submit
penceresinde scope dışı. Pragmatik alternatif: server/__tests__/markings.test.ts'e
source-scan regression test bloğu eklendi. routers.ts'in kaynak kodunu okuyup
5 kritik kontrat regex ile doğrulanıyor: (1) if (ENV.enableMarkingCapture)
wrapper, (2) MARKINGS_PROMPT + MARKINGS_SCHEMA identifier'ları, (3) model
geminiModelChat (NOT geminiModelOcr), (4) responseFormat type json_schema,
(5) try/catch + PII-safe warn log. Refactor kaza regression'unu yakalar,
runtime davranışını garanti etmez (onun için full integration test gerekir,
v1.0.1+).

## 2026-04-23 — Phantom highlights bug gözlendi, launch scope'undan çıkarıldı

Gemini markings extraction sayfada hiç işaret yokken quotation'ları
highlights olarak işaretliyor (fixture: IMG_7305.HEIC, 22:20). Launch
blocker değil — data bozulması yok, "Gizle" butonu UX çözümü, kill
switch var. v1.0.1 retro: prompt iterate + negative fixture eval.
Hilal kararı: not al, sonra incele.

## 2026-04-23 — Iyzico kolonları v1.0.1 cleanup'ına ertelendi

`users.iyzicoCustomerId` ve `users.iyzicoSubscriptionRef` DB'de hala duruyor —
migration `0004_native_auth_revenuecat.sql` bu iki DROP'u içermesine rağmen
production'da tam uygulanmamış. Schema.ts'de ve canlı kodda referans yok,
zararsız ölü kolonlar. Cuma submit öncesi destructive schema change yapmamak
için ertelendi. Post-launch yapılacak: 0004'ü review + sadece eksik
statement'lar için `0009_cleanup_iyzico.sql` + `palimps-database-admin`
skill'i ile uygulama.

## 2026-04-23 — Bilinmeyen Private Relay allowlist email'i temizlendi

`PREMIUM_TEST_EMAILS` (Railway env) içinden `cbd9kdmmfh@privaterelay.appleid.com`
çıkarıldı — sahibi bilinmiyordu, launch öncesi temizlenmesi gerekliydi. Kalan
tek email: `hilalsumnu@gmail.com` (owner). Paywall testi için bundan sonra
App Store Connect sandbox tester kullanılacak, allowlist'e ek yapılmayacak.

## 2026-04-23 — Privacy policy KVKK + markings kapsamına güncellendi

`site/privacy.html` 15 Nisan 2026 → 23 Nisan 2026 bump. Dört blocker
düzeltildi: §1 kullanıcı içeriği (OCR + highlights + marginalia), §2 feature
kapsamı + hukuki sebep, §4 yurt dışı transfer (Google Gemini US, 48h log
retention), §5 Gemini cümlesi materyal olarak yeniden yazıldı. §7 KVKK Md. 11
tam liste. Veri Sorumlusu legal identity (GAP-6) bilinçli olarak v1.1'e
ertelendi. `guardrails` skill denetimi sonucu.

## 2026-04-23 — Notların tab v1.1'e ertelendi

Launch scope'undan çıkarıldı. Sıfırdan route + backend payload + empty states
+ timeline = 3-5 günlük iş, App Store review penceresine sığmıyor. v1.0
(tabs)/ sadece Kitaplarım + Asistan + Profil içerecek. Highlights + marginalia
AN detay ekranında zaten live (v6 amber palette, app/moment/[id].tsx).

## 2026-04-22 — 6-HEIC gerçek-LLM eval dogfood-sonrasına ertelendi

`server/__tests__/markings.test.ts` schema + prompt invariant unit testi
olarak yazıldı; gerçek LLM call'lu eval yapılmadı. Gerekçe (Hilal pivot):
"mükemmel U&UX ile önce bir teste çıkalım". Kill switch
(`ENABLE_MARKING_CAPTURE`) fallback olarak var — regression görünürse
production'da flip.
