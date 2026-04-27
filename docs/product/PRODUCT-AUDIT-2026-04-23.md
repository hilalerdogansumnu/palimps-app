# PALIMPS — Product-Designer Audit (2026-04-23, pre-submit)

**Auditor:** product-designer skill (Şef invocation)
**Scope:** Tüm app/ ekranları, components/ paylaşımlı UI, copy (locales/tr.json + en.json)
**Rubric:** Linear speed + Storytel warmth + Supercell juice; brand consistency; empty/loading/error states; haptics; spacing scale; a11y; responsive; TR+EN sync

---

## Triage

- **🔴 BLOCKER** — submit öncesi mutlaka düzeltilmeli (brand inconsistency, kırık TR/EN, crash/ship hazırlık sorunu, reviewer reject riski)
- **🟡 POLISH** — shippable ama kalite artırır, v1.0.1'de temizle
- **🔵 TRACK** — v1.1+ not, aklındakine kaydedilsin

---

## Kapsam (okuma sırası)

1. [login.tsx](#1-logintsx)
2. [_layout.tsx + tabs layout](#2-_layouttsx--tabs-layout)
3. [(tabs)/index.tsx — Kitaplarım](#3-tabsindextsx--kitaplarım)
4. [(tabs)/chat.tsx — Asistan](#4-tabschattsx--asistan)
5. [(tabs)/profile.tsx — Profil](#5-tabsprofiletsx--profil)
6. [add-book.tsx](#6-add-booktsx)
7. [add-moment/* flow](#7-add-moment-flow)
8. [ocr-edit.tsx](#8-ocr-edittsx)
9. [book/[id].tsx](#9-bookidtsx)
10. [moment/[id].tsx — AN detay (hero yeni feature)](#10-momentidtsx--an-detay-hero-yeni-feature)
11. [premium.tsx — paywall (reviewer attention)](#11-premiumtsx--paywall-reviewer-attention)
12. [profile/account.tsx — delete account](#12-profileaccounttsx--delete-account)
13. [profile/edit-name.tsx](#13-profileedit-nametsx)
14. [notification-settings.tsx](#14-notification-settingstsx)
15. [tag/* + dev/*](#15-tag--dev)

---

## Özet (tek bakışta)

**Gün 1 taraması — 6 ekran okundu (login, layout, tabs, home, premium, profile/account).**
Kalan: chat, profile (tabs), add-book, add-moment flow, moment detay (yeni feature!), ocr-edit, book detay, edit-name, notification-settings, tag, dev. **En kritik kalan: moment/[id].tsx** — launch'ın yeni feature'ı (highlights + marginalia render) henüz denetim görmedi.

### Submit blocker'ları (🔴 — Cuma'dan önce)

1. **Tagline tutarsızlığı** — login.tsx'te `t("app.tagline")` → tr.json:2 `"Kişisel Okuma Hafıza Sistemi"` (corporate). Website landing `"Kitap okuma hafızan"` (editoryal, samimi). Marka iki yüzlü konuşuyor. Çözüm: tr.json'u website tagline'ına hizala, EN de `"Your reading memory"`.
2. **Kitaplarım sortBy dead state** — (tabs)/index.tsx'te `sortBy` state, `handleSortChange` + sorted results, calculateRelevance hepsi yazılı **ama kullanıcının sortBy'ı değiştireceği UI yok**. Ya menü/picker ekle, ya koddan çıkar. Dead code ship'lemek Apple 2.1 App Completeness reject riski.
3. **Hardcoded Türkçe `"an"` — EN locale'te bozuk** — (tabs)/index.tsx:558 `{item.momentCount} an` — aynı dosyada zaten `t("home.momentCount", { count })` helper var (line 429), onu kullanmıyor. EN kullanıcı "3 an" görür, Apple reviewer bunu yakalar.
4. **Hardcoded Türkçe `"Premium üyesiniz"`** — premium.tsx:140 `<Text>Premium üyesiniz</Text>` — EN locale yok. Reviewer paywall'ı mutlaka ziyaret eder. Fix: `t("premium.active")` veya `t("premium.youArePremium")`.

### Polish (🟡 — v1.0.1'de ideal)

- **Turkish locale normalization**: (tabs)/index.tsx sort + search'te `.toLowerCase()` kullanılıyor (line 141, 142, 148, 157-175). CLAUDE.md açıkça uyardığı risk — "İhsan" → "i̇hsan" (i + combining dot above) olur, `"ı"` ile başlayan kitaplar yanlış sıralanır. `.toLocaleLowerCase("tr-TR")` ile fix.
- **Kitaplarım search bar a11y**: empty state search'te `accessibilityLabel` var (line 258-259), dolu listede yok (line 372). EN parity.
- **premium.tsx**: TouchableOpacity → Pressable modernize (RN new API); purchase button tıklamasında Light haptic yok (sadece passive spinner).

### Track (🔵 — v1.1+ not)

- **"Bilinmeyen kitap" copy**: Arşivlenen kitaplar için moment.bookId ilişkisi kopuk görünmesin — "arşivlenen kitaba ait an" gibi.
- **Premium allowlist side effect**: `isUserPremium` allowlist'e düşen user (dev email) paywall'ı göremez — owner-device QA için test sandbox account gerekir.

---

## Ekran ekran bulgular

### 1. login.tsx

**Genel ton:** Sakin, tek CTA, Apple native button, privacy note alt çizgi. Linear restraint + Storytel warmth dengesi iyi.

🔴 **BLOCKER — Tagline corporate**:
- Line 132: `t("app.tagline")` → "Kişisel Okuma Hafıza Sistemi"
- Website'te "Kitap okuma hafızan" kullanıyoruz. **tr.json:2 + en.json** güncel:
  - TR: `"tagline": "Kitap okuma hafızan"`
  - EN: `"tagline": "Your reading memory"`
- Etkisi: Reviewer login'i açar, marka ilk 10 saniyede "kitap okuma hafızası" mı "hafıza sistemi" mi belirsiz kalır.

🟡 **POLISH — hardcoded style values**: fontSize 28 + fontWeight 700 + letterSpacing 2 hepsi inline. Typography scale'e uygun ama design tokens çıkarılırsa tutarlılık artar.

🟢 **GOOD**: iOS-only fallback, cancel vs. error ayrımı, Sentry-aware error handling, lock icon + privacy note hissi.

---

### 2. _layout.tsx + (tabs)/_layout.tsx

**Genel ton:** Clean Expo Router + safe area + Sentry + RevenueCat + ErrorBoundary + onboarding gate. Solid foundation.

🟢 **GOOD**: ErrorBoundary wrapping, min safe area insets (top 16, bottom 12), onboarding gate, Stack modals, tab HapticTab.

🔵 **TRACK**: `initManusRuntime` legacy import (line 27 "Keep for compatibility") — v1.0.1 housekeeping, birlikte `subscribeSafeAreaInsets` web-only path'i.

---

### 3. (tabs)/index.tsx — Kitaplarım

**Genel ton:** Linear density + iOS large title + Mail-style swipe-left archive + custom delete modal + FAB. Çok iş yapıyor tek ekran.

🔴 **BLOCKER — sortBy dead state**:
- Line 27: `type SortOption = "relevance" | "date-newest" | "date-oldest" | "author"`
- Line 38: `const [sortBy, setSortBy] = React.useState<SortOption>("date-newest")`
- Line 118: `handleSortChange` fn var
- Line 124-207: `sortedSearchResults` memo kullanıyor
- **UI'da `setSortBy` çağırılan bir yer YOK.** Kullanıcı sortBy'ı değiştiremez → 4 sort seçeneği gereksiz, sadece date-newest çalışır.
- Fix: ya search results üstüne SegmentedControl veya sheet ekle, ya sortBy state'ini komple çıkar.

🔴 **BLOCKER — `"{item.momentCount} an"` hardcoded TR**:
- Line 558: `<Text>{item.momentCount} an</Text>`
- Aynı dosyada zaten line 429: `t("home.momentCount", { count: (book as any).momentCount })` helper doğru kullanım. Bu satırda unutulmuş.
- EN kullanıcı "3 an" görür → "3 moments" olmalı.

🟡 **POLISH — Turkish `.toLowerCase()` yerine `.toLocaleLowerCase("tr-TR")`**:
- Line 141-142: sort by author için `.toLowerCase()` — "İhsan" hatalı sort edilir.
- Line 157-175 calculateRelevance: search query ile text comparison — "Şiir" içerikli kitaplar için yanlış relevance.
- CLAUDE.md §Non-Obvious Gotchas açıkça uyarıyor bu tam gotcha'yı.

🟡 **POLISH — Search a11y inconsistent**:
- Empty state search (line 256-259): `accessibilityLabel`, `accessibilityRole: "search"`, `accessibilityHint` hepsi var.
- Dolu liste search (line 371-387): sadece `placeholder`, a11y props yok.
- VoiceOver kullanıcıları iki durumda farklı deneyim yaşar.

🟢 **GOOD**: Pull-to-refresh + haptic, iOS Mail-style swipe archive + amber accent, delete confirmation custom modal (iOS native Alert'ten daha zengin), FAB with shadow + haptic, BookCover component reuse, relevance scoring logic.

🔵 **TRACK — "unknown book" copy (line 445)**: moment.bookId ile bağlı kitap silinmişse "Bilinmeyen kitap" yazar. v1.0'da delete edilen kitap'ın moment'ları cascade silindiği için zaten bu case çok nadir. Ama archive feature cascade etmiyor → arşivlenen kitabın moment'ları search'te görünürse bu copy düşer. v1.0.1 için "arşivlenen kitap" daha dürüst.

---

### 4. premium.tsx — paywall

**Genel ton:** Apple 3.1.2 compliant (cancellation info + restore purchases), 8 feature list, primary color CTA, loading states covered.

🔴 **BLOCKER — `"Premium üyesiniz"` hardcoded TR (line 140)**:
```tsx
<Text style={{ ... color: colors.success ... }}>
  Premium üyesiniz
</Text>
```
- `t()` çağrısı yok. tr.json + en.json'a eklenmeli:
  - TR: `"premium.youAreActive": "Premium üyesiniz"`
  - EN: `"premium.youAreActive": "You're a Premium member"`
- **Apple reviewer paywall'ı mutlaka test eder.** Premium bypass ile yönelirse bu banner'ı görür, EN'de Turkish text = reject.

🟡 **POLISH — TouchableOpacity → Pressable**: Line 203-244. Modern RN pattern Pressable + `({ pressed })` state. Fark marjinal ama codebase tutarlılığı.

🟡 **POLISH — Haptic eksik**: Line 204 TouchableOpacity onPress'te Light haptic yok. Apple purchase sheet kendi haptic verir ama pre-sheet tap'te app kendi vermeli (Supercell "juice" rule).

🟢 **EXCELLENT**: Cancellation info section (App Store 3.1.2 compliance), restore purchases, RevenueCat offerings yüklendi, purchasing state disabled + opacity, success alert + router.back, already-premium banner.

---

### 5. profile/account.tsx — hesap hub + delete

**Genel ton:** iOS Settings inset-grouped pattern, sakin "Tehlikeli Bölge" eksik (başlık çıkarılmış, tek kırmızı buton — pattern-compliant).

🟢 **EXCELLENT**:
- Private-relay email mask'i (line 45-49) — CLAUDE.md'deki ve skill'deki cardinal sin önlenmiş
- Delete flow: haptic + confirmation Alert + double haptic (Success / Error) + error toast + logout + router.replace
- Pro user subscription row → Apple native subscriptions page (`https://apps.apple.com/account/subscriptions`), Free user → /premium
- Free tier usage card (5/5 kitap · 10/10 Hafıza) sakin progress bar, Pro'da render edilmez
- Delete double-tap protection (`deletePromptOpenRef`) — iOS Alert race condition için defensive
- UsageRow component abstraction temiz, `fontVariant: ["tabular-nums"]` detayı nice touch

🟢 **EXCELLENT — destructive button pattern**: `colors.error` + `"400"` weight + ortalanmış + açıklayıcı footer. iOS HIG perfect.

🔵 **TRACK**: "Apple ile giriş" login method string — future'da Google Sign In eklenirse string map değişir.

---

### 6. moment/[id].tsx — AN detay (Gün 2, ios-developer + product-designer birlikte)

**Genel ton:** v6 amber/purple aile semantic tints (Amber=kitaptan geleni, Purple=AI/dijital), progressive disclosure (highlights 140 char, OCR 500 char truncate), haptic matrix disiplinli, comment archaeology mükemmel (50328 bug'ı +refkard). 587 satır tek ekran — hero feature'a yakışır yoğunluk.

🔴 **BLOCKER — Dark mode'da HIGHLIGHTS okunamıyor (line 306)**

V6 palette'i açıkça "Light-mode tuned" (line 18). Diğer section'lar dark-mode-safe çünkü `V6.ocrText` / `V6.summaryText` / `V6.marginText` / `V6.noteText` hepsi **hardcoded koyu** (bg da hardcoded açık). AMA line 306'da highlights alanında:

```tsx
<Text style={{ fontSize: 14, lineHeight: 21, color: colors.foreground }}>
  {displayText}
</Text>
```

`colors.foreground` dynamic:
- Light mode: `#160E2C` (near-black) × `V6.highlightsBg: #FDF4E3` (light amber) → contrast ~16:1 ✓
- **Dark mode: `#EDE9FA` (near-white) × `#FDF4E3` (light amber) → contrast ~1.5:1 ✗ unreadable**

Apple reviewer dark mode'u mutlaka toggle eder. `userInterfaceStyle: "automatic"` (app.config.ts:53) → sistem dark olduğunda app da dark olur. **Yeni feature'ın hero render'ı dark'ta kırık.**

**Fix (1 satır):** `colors.foreground` → `V6.ocrText` (aynı amber ailesi, zaten `#3B2A08`, her iki mode'da dark kalır).

🔴 **BLOCKER — `Image` from 'react-native' kullanılıyor (line 2 + 209)**

ios-developer cardinal sin: *"Using `Image` from react-native instead of `expo-image` (no caching, no placeholder, no memory management)."*

Bu hero feature screen'inde. Etki:
- Blurhash placeholder yok → boş alan sonra ani yükleme (flash)
- Memory yönetimi yok → aynı moment'a tekrar tekrar bakmak leak üretir
- Cache yok → her ziyarette R2'den yeniden indirir (bandwidth + latency)
- Cold load TTI etkisi ≥100ms

**Fix:**
```tsx
// Önce import değiştir:
import { Image } from "expo-image";

// Sonra component'i genişlet:
<Image
  source={{ uri: moment.pageImageUrl }}
  style={{ width: "100%", aspectRatio: 3/2, borderRadius: 16, backgroundColor: colors.surface }}
  contentFit="cover"
  transition={200}
  placeholder={{ blurhash: "L5H2EC=PM+yV0g-mq.wG9c010J}I" }}  // placeholder için geçici tokenstring
  accessibilityLabel={t("momentDetail.pageImageAlt")}
/>
```
Not: `placeholder` prop opsiyonel ama eklenirse çok iyi olur. `accessibilityLabel` zorunlu (eksik — aşağıda ayrı blocker).

🔴 **BLOCKER — Page image'da `accessibilityLabel` yok (line 209)**

VoiceOver kullanıcı için resim görünmez oluyor. Kitap sayfası fotoğrafı bu ekranın merkez içeriği. Apple a11y 2026 enforcement, takip ediliyor.

**Fix:** `<Image>` component'ine `accessibilityLabel={t("momentDetail.pageImageAlt")}` + `en.json` + `tr.json` key ekle (e.g. "Kitap sayfası fotoğrafı" / "Book page photo").

🟡 **POLISH — V6 palette'in dark mode variant'ı yok (satır 21-32)**

Highlights blocker'ı haricinde diğer section'lar (summary, OCR, margin, note) dark mode'da teknik olarak **okunabilir** ama **görsel olarak uyumsuz**: dark screen üzerinde light island'lar olarak durur, tonal bütünlük kopar. iOS dark mode kullanıcıları jarring bulur ama reviewer'ı reject etmez (okunabilir).

v1.0.1: V6 palette'i `theme.config.js`'e v6 alanı olarak taşı, light+dark variants tanımla. Comment zaten bu yolu işaret ediyor (line 19-20).

🟡 **POLISH — `useCallback` ile defansif memoization (line 65-72)**

React Compiler ON (`reactCompiler: true`). Cardinal sin: *"Don't add `React.memo` / `useMemo` / `useCallback` unless profiling shows need."*

```tsx
const toggleHighlight = React.useCallback((idx: number) => { ... }, []);
```

Compiler zaten stable reference üretiyor. useCallback silinebilir. Etki ihmal edilebilir ama codebase'te "defansif memoization" anti-pattern'i örneği olmasın.

🟡 **POLISH — `localeMap` dead code (line 175)**

```tsx
const localeMap: Record<string, string> = { en: "en-US", tr: "tr-TR", de: "de-DE", es: "es-ES" };
```

PALIMPS sadece `tr` + `en` destekliyor. `de` + `es` hiç kullanılmayacak. Kopya-yapıştır kalıntısı. İki key'i sil, fonksiyonel etki yok.

🟡 **POLISH — Bare `<ActivityIndicator size="large">` loading state (line 152)**

Cardinal sin yumuşak ihlal: *"no spinner in the middle of the screen for <300ms operations (feels 'stuck')."*

Detay ekranı network'e bağlı. Yavaş bağlantıda boş ekran + spinner "stuck" hissi. Skeleton (hero image şerit + 3 paragraf grey placeholder) native his verir.

v1.0.1: Skeleton component oluştur.

🟡 **POLISH — IIFE JSX pattern (line 346)**

```tsx
{moment.ocrText && (() => {
  const OCR_TRUNCATE = 500;
  // ...
  return (<View>...</View>);
})()}
```

Çalışır ama React Compiler IIFE boundary üzerinden optimize etmeyebilir. Önerilen: `<OcrTextSection text={moment.ocrText} expanded={ocrExpanded} setExpanded={setOcrExpanded} />` gibi ayrı component.

v1.0.1 — taste call, launch blocker değil.

🔵 **TRACK — `parseInt(id, 10)` defensive not (line 50)**

URL `/moment/abc` → `parseInt("abc") = NaN` → tRPC 404. "Not found" ekranı düşer, çalışıyor. Ama defansif:

```tsx
const momentId = Number.isFinite(Number(id)) ? Number(id) : -1;
```

Edge case, not düş, v1.1 sertleştirilebilir (Zod ile validate).

🔵 **TRACK — Edit modal save sonrası toast yok**

Modal kapanır, haptic Success fires. Kullanıcı %99 "kaydedildi" anlar ama explicit görsel feedback yok. v1.1 toast pattern.

### 🟢 Moment detail — EXCELLENT'ler

- **Comment archaeology (line 203-206)** — 50328 smoke test bug'ı (remote Image aspectRatio sorunu) yorumda belgelenmiş. Explicit aspectRatio 3/2 kararı ve `book/[id].tsx` + `tag/[name].tsx` parite notu. Bir başka dev 6 ay sonra "niye aspectRatio zorla 3/2?" diye bakarsa cevap orada.
- **V6 palette rationale comment (line 15-20)** — Amber=kitaptan / Purple=AI ayrımı semantic. Rasgele renk değil, mesaj taşıyor.
- **Haptic matrix disiplini** — `Light` (tap), `selectionAsync` (toggle), `Success` (commit), `Error` (fail). Skill matrix'e bire bir.
- **Progressive disclosure 2 level** — global OCR expanded + index-based highlights Set. Sayfa akışı tıkanmıyor, her highlight kendi başına yönetiliyor.
- **Conditional section render** — `{moment.summary && ...}`, `{moment.highlights && .length > 0 && ...}`, `{moment.tags && length >= 2 && ...}`. Empty state = hide, not show. Product-designer "no noise" kuralı.
- **Tag ≥ 2 gate (line 465)** — Gemini 1 tag dönerse (kenar case) UI'yı kirletmiyor. Defensive + feels intentional.
- **Unified "Notes" section (line 407-458)** — marginalia (amber italic Georgia) + userNote (purple sans) aynı başlık altında, iki farklı ses. Product-designer'ın "hepsini user_note'a ekle önerisi REDDEDİLDİ" handoff kararına kadar dayanan design. Örnek: aynı bilgi kategorisinin farklı aracı (kalem vs dijital) tipografiyle ayrılıyor.
- **NavigationBar custom menu + hitSlop (line 192-199)** — standart iOS pattern, hitSlop genişletilmiş (44×44 garantisi), tıklanabilirlik düzgün.
- **KeyboardAvoidingView** (line 513) edit modal için. iOS `padding` behavior ile keyboard popup'ı input'u yemiyor.
- **tRPC mutation disiplini** (line 76-86) — onSuccess + onError hem haptic hem visual feedback.

### moment/[id].tsx — blocker özeti

| # | Satır | İş | Süre |
|---|---|---|---|
| 1 | 306 | `colors.foreground` → `V6.ocrText` | 1 dk |
| 2 | 2 + 209 | `Image` (RN) → `Image` (expo-image) + `contentFit` + `transition` | 5 dk |
| 3 | 209 | `accessibilityLabel` ekle + locale key (TR + EN) | 3 dk |

Toplam ~10 dakika. Bu 3 fix ile moment/[id].tsx ship-ready.

---

### 7. add-moment/[bookId].tsx — core feature path (Gün 2 ios-developer lens)

**Genel ton:** Phase-evolving progress labels, taxonomized error handling (rate-limit, timeout, network, 4xx, 5xx, presign-fail, freemium caps), UpsellSheet kullanımı, CropModal custom pattern, AI note generation premium-gated, streak notification scheduler. Core yetki ekranı, iyi emek verilmiş.

🔴 **BLOCKER — `Image` from 'react-native' (line 8 + 441-445)**

Üçüncü cardinal sin tekrarı (moment/[id] ve book/[id]'den sonra). Bu sefer preview — kullanıcı çektiği fotoğrafı ekranda görüyor ama silent-fail riski var (yerel URI çünkü aslında güvenilir, ama brand consistency + caching behavior için expo-image şart). Aynı migration pattern (swap import + contentFit + transition + accessibilityLabel).

🟢 **EXCELLENT:**
- **Phase-evolving progress** (line 97-118) — preparing → uploading → extracting → enriching → finalizing. Timer-based fake progress server'ın tek blocking call'unu UX olarak kıran zekice bir hack. Comment 50328 smoke test'e dayanıyor.
- **handleUploadError taxonomy** (line 258-306) — 8 farklı error path ayrımı: FORBIDDEN/freemium cap → UpsellSheet (haptic Medium = invitation), RATE_LIMIT_EXCEEDED → no-retry alert, UPLOAD_TIMEOUT / NETWORK_ERROR / UPLOAD_HTTP_4xx / UPLOAD_HTTP_5xx / PRESIGN_FAILED her biri kendi copy'si + Sentry captureException. "Silent failures lose trust" prensibi canlı uygulanmış.
- **UpsellSheet pattern** — freemium cap'te alert yerine sheet. Medium haptic = davet, error değil. 50325 karar commentiyle belgelenmiş.
- **Custom CropModal** — iOS ImagePicker'ın 1:1 square locked kırpmasından kaçınmak için (comment line 201-203): kitap sayfası kenarındaki masa/parmak OCR'a sızıyor.
- **scheduleStreakAlert** (line 39-69) — i18n.t() outside React context doğru kullanım; AsyncStorage'dan settings.streakAlert check; eski alert cancel sonra yeni schedule.
- **Permission request discipline** — camera + library öncesi granted check.
- **AI note generation premium-gate** (line 180-186) + upgrade redirect.

🟡 **POLISH:**
- `UPLOAD_TIMEOUT_MS = 30_000` hardcoded. 4G zayıf hatta yavaş upload'lar için belki kısa. Observability gelince prod median upload latency ölçüp tuning.
- `generateNoteMutation.onError` generic `t("common.error")` fallback'i kullanıyor — ai-spesifik copy daha iyi olur.

---

### 8. ocr-edit.tsx — ORPHAN SCREEN (Gün 2)

**Genel tanı:** 397 satırlık tam ekran — font size/alignment/style control'leri, live preview, OCR text editor, page number input. Görsel olarak well-designed.

🔴 **BLOCKER (dead code OR broken feature):**

**Reachability check** (grep): tüm app'te **tek bir `router.push("/ocr-edit")` yok.** Expo Router file-based routing ile route otomatik register olur (`/ocr-edit` URL'i valid olur) ama **HİÇBİR UI'dan navigate edilmiyor**. Orphan.

**İki yorum — birini seç:**

**(a) Dead code.** Özellik tasarlanmış ama add-moment akışına bağlanmamış; kullanılmıyor, bundle'ı şişiriyor, test edilmiyor, bakım borcu. **v1.0.1'de dosyayı sil** (+ locales'deki `ocrEdit` key'leri).

**(b) Feature abandoned-mid-wire.** handleSave (line 69-90) state'i dışarı iletmeden `router.back()` yapıyor — user'ın font/alignment/style tercihleri **kaybediliyor**. Save butonu sahte. Eğer feature UX intent'i "user OCR çıktısını customize etsin" idiyse, bu implementation tamamlanmamış. Launch'a sığmaz.

**Benim önerim: (a)**. Product-designer "remove before you add" prensibi. Eğer gerçekten font customization isteniyorsa v1.1'de `moment/[id]` detail screen'de inline edit option olarak eklenir — ayrı bir ekran + orphan save daha karışık.

🔴 **BLOCKER (eğer reachable olursa):** handleSave bilgi kaybı — state parent'a iletilmiyor. router.back() sync, comment "parent screen will receive" yalan. Gerçek implementation `router.back()` yerine `router.replace(...)` veya `router.back({ params })` pattern'i veya shared state store gerektirir.

🔴 **BLOCKER (eğer reachable olursa):** `Image` from 'react-native' (line 1, 148). Aynı cardinal sin.

---

### 9. (tabs)/chat.tsx — Asistan (Gün 2)

**Genel ton:** Quota-aware, rate-limit-aware, Sentry-disciplined, optimistic UI update, locale-aware server calls, retry affordance, upsell in-transcript (alert değil). Çok sağlam bir chat implementasyonu.

🟢 **EXCELLENT:**
- **Quota handling** (line 109-120) — ASSISTANT_QUOTA_EXHAUSTED → in-transcript upsell message + Premium CTA button. Alert değil, pattern-consistent.
- **Rate limit handling** (line 124-136) — retry YOK çünkü "saat içinde tekrar fail eder" (comment). Retry haptic spam'i önlenmiş.
- **Unexpected errors** (line 138-160) — Sentry captureException surface:"chat" + trpcCode + trpcMessage + isKnownServerError context. Retry affordance eklenir (error kind + retryPrompt).
- **Optimistic quota update** (line 96-98) — server response.quotaRemaining ile localRemaining düşer, query refetch beklenmez.
- **Server locale pass** (line 83) — i18n.language "en" ise "en" yollanır, yoksa "tr". Server cevabı kullanıcının diline göre üretir.
- **Freemium counter in header** (line 308-320) — Linear-tarzı sessiz, accessibility role "text", sayı 0 iken de gösteriliyor ("neden gönderemediğini anlasın" comment).
- **Quick replies useMemo** — 4 seçenek yerine her render'da yeniden oluşmuyor.
- **Legacy "premiumRequired" → "quotaExhausted" migration** (line 13-16) comment'le belgelenmiş.
- **KeyboardAvoidingView** + keyboardVerticalOffset: 100 (tab bar için).
- **maxLength 500 + returnKeyType send + onSubmitEditing** — native message input discipline.
- **Retry clears prior error messages** (line 66-69) — transcript'te dead system message birikmiyor.

🟡 **POLISH:**
- **Line 326** — `<Text style={{ fontSize: 32 }}>◻</Text>` empty state icon. Literal Unicode box. Should be MaterialIcons "chat-bubble-outline" or similar. Brand hissi çok düşük şu haliyle.
- **Line 373** — Loading placeholder `...` (üç nokta). `t("chat.thinking")` veya "Hafıza taranıyor…" daha warm + storytel-bookish.
- **Line 285** — `.toLocaleTimeString("tr-TR", ...)` hardcoded TR locale. EN kullanıcı için bile Turkish time format. `i18n.language.startsWith("en") ? "en-US" : "tr-TR"` pattern (handleSend'in locale pick'i gibi) tutarlı olur.

🔵 **TRACK:**
- Conversation history persistence yok — app restart = transcript sıfırlanır. Bazı chat app'leri tutuyor, PALIMPS "sade kütüphaneci" felsefesiyle tutmama kararı olabilir (taste call, v1.1 discuss).
- Assistant bubble'da avatar/identifier yok (user = primary color bubble, assistant = surface). "Kütüphaneci" kimliği görsel olarak da belirebilir.

---

### add-moment + ocr-edit + chat özeti

| Ekran | 🔴 Blocker | 🟡 Polish | 🔵 Track |
|---|---|---|---|
| add-moment | 1 (expo-image migration) | 2 | 0 |
| ocr-edit | 1-3 (dead code vs. 3 gerçek) | 0 | 0 |
| chat | 0 | 3 | 2 |

### Rekursif bulgu: rn Image cardinal sin

Bu ses başlı başına bir mini-migration. `Image` from 'react-native' görülen noktalar:
- ✅ moment/[id].tsx — fix'lendi dün
- ✅ book/[id].tsx — fix'lendi bu sabah
- ⚠️ add-moment/[bookId].tsx — fix bekliyor
- ⚠️ ocr-edit.tsx — dead code ise önemsiz, reachable ise blocker
- ✅ components/book-cover.tsx — zaten expo-image (dün grep ile doğrulandı)

### Güncel blocker listesi (Cuma submit için)

1. `add-moment/[bookId].tsx` expo-image migration (5-10 dk)
2. `ocr-edit.tsx` karar: sil VE dosyayı sil (5 dk) VEYA reachable yap + save fix (~30-60 dk, v1.0.1'e kaydır daha mantıklı)

---

### 10-15. Kalan ekranlar

Öncelik: (tabs)/profile.tsx, add-book.tsx, profile/edit-name.tsx, notification-settings.tsx, tag/*, dev/* + components ortak kütüphane.
- **add-moment/* flow** 🟠 HIGH — core feature path (camera → OCR → edit → save), multi-step
- **ocr-edit.tsx** 🟠 HIGH — OCR sonrası kullanıcı düzenlemesi, phantom highlights bug'ının göründüğü yer
- **(tabs)/chat.tsx** 🟠 HIGH — Asistan, reviewer test eder
- **(tabs)/profile.tsx** 🟡 MID — profile hub
- **add-book.tsx** 🟡 MID — modal
- **book/[id].tsx** 🟡 MID — kitap detay + export
- **profile/edit-name.tsx** 🟢 LOW — küçük ekran
- **notification-settings.tsx** 🟢 LOW
- **tag/** 🟢 LOW
- **dev/** 🟢 LOW — production'da unreachable

---

## Özel not — ortak component'lar tarama gerekli

- `components/screen-container.tsx` — safe area handling, tüm ekranlarda kullanılıyor
- `components/navigation-bar.tsx` — back label pattern, premium + account + diğer detay ekranlarda
- `components/book-cover.tsx` — Kitaplarım + search result'ta
- `components/haptic-tab.tsx` — tab bar
- `hooks/use-colors.ts` — theme tokens tek kaynak
- `lib/i18n/` — TR + EN resource parity

Bu component'lar product-designer skill'ine göre yüksek leverage noktaları — `useColors()` kırık olsa tüm app kırılır. Gün 2'de de taranacak.

---

## Sonuç — Cuma submit için net 4 blocker

| # | Dosya:Satır | İş | Süre |
|---|---|---|---|
| 1 | `locales/tr.json` + `en.json` `app.tagline` | Website ile hizala: "Kitap okuma hafızan" / "Your reading memory" | 2 dk |
| 2 | `app/(tabs)/index.tsx` sortBy | UI ekle (SegmentedControl sheet menü veya header filter) ya da koddan çıkar | 15-60 dk |
| 3 | `app/(tabs)/index.tsx:558` `{momentCount} an` | `t("home.momentCount", { count })` ile değiştir | 1 dk |
| 4 | `app/premium.tsx:140` `"Premium üyesiniz"` | `t()` çağrısına sar, EN key ekle | 3 dk |

Blocker'lar toplam ~20-70 dakika. sortBy kararı kapsamı belirliyor — "koddan çık" (hızlı) vs. "UI ekle" (temiz).

Gün 2'de kalan 10 ekran + components tarandıktan sonra final blocker sayısı netleşir.

