# SESSION 2026-04-22 — Handoff: Highlights + Marginalia + Kütüphanem (v1)

**Ne bu dosya:** Bu session'da (Cowork/design) Hilal ile alınan UX + teknik kararların
operasyonel özeti. Bir sonraki Claude Code session'ı bu dosyayı `Read` ile açsın,
kodu yazmaya başlasın. Tasarım iterasyonu BİTTİ — artık implementation.

**Kapsam:** OCR akışına (a) sayfadaki vurguları ve (b) el yazısı kenar notlarını
çıkarma yeteneği eklemek + (c) bu verileri gösteren AN detay ekranını yeniden
kurmak + (d) tüm notları tek yerden gezmek için yeni bir "Notların" sekmesi.

---

## 1. Alınan ürün kararları (tartışma kapalı)

1. **Üç farklı "ses" var, karıştırılmayacak:**
   - **Yazarın sesi** — altı çizili / fosforlu / mürekkep underline.
   - **Senin sayfa üstü sesin** — el yazısı kenar notları.
   - **Senin uygulama sesin** — `userNote` alanı.

2. **"Hepsini user_note'a ekle" önerisi REDDEDİLDİ.** `userNote` dokunulmaz
   kalır, boş ve davetkâr. Yeni alanlar ayrı.

3. **`pageHeading` ayrı bir field DEĞİL.** Sayfa başına yazılmış el yazısı not
   da `marginalia[]` içine düşer; `position: 'top'` metadata'sıyla UI render
   katmanında "promoted" olarak büyütülür. Gerekçe: pozisyon niyet değil,
   sayfada boş yere denk gelme. Ayrı field olmayan bir kategoriyi veri modeline
   sokmamak için.

4. **Summary + tags** (mevcut `MOMENT_ENRICH_PROMPT` üretiyor) korunur.
   Enrichment prompt'una tek satırlık ek: eğer `highlights` verildiyse tag
   seçerken onlara ağırlık ver. Summary kuralları değişmez (yargısız, ≤20
   kelime, tanımlayıcı).

5. **Her yakalanan öğenin yanında opt-in "Kendi notuma ekle" aksiyonu** olacak
   (long-press veya swipe). Varsayılan davranış asla agresif dolum yapmaz;
   kullanıcı ister ise elle lift eder.

6. **Altını çizilmiş ★ ve bracket gibi işaretler metin değil, önem sinyali.**
   `emphasisMarkers: number` olarak sayılır; UI'da marginalia'da ★ gösterimi
   rozet olarak kullanılır. Ayrı text entry üretilmez.

---

## 2. Veri modeli — final

### 2.1 `reading_moments` tablosuna yeni kolonlar

| Kolon | Tip | Null | Açıklama |
|---|---|---|---|
| `highlights` | `JSON` | ✓ | Array of highlight entries (altı çizili + fosforlu) |
| `marginalia` | `JSON` | ✓ | Array of marginalia entries (el yazısı notlar) |

**`pageHeading` ayrı kolon DEĞİL** — bkz. karar 3.

### 2.2 JSON şekilleri (TypeScript)

```ts
type HighlightEntry = {
  text: string;                                   // maxLength 500
  kind: 'highlighter' | 'underline';
  color?: 'pink' | 'yellow' | 'green' | 'other'; // algılanabildiyse
};

type MarginaliaEntry = {
  text: string;                                   // maxLength 500
  position?: 'top' | 'side' | 'inline';           // render promotion için
  anchor?: string;                                // yakın satırın ilk ~4 kelimesi
  hasStar?: boolean;                              // ★/⭐ işareti var mı
};

// reading_moments kaydı (ek alanlar):
type ReadingMomentExtras = {
  highlights: HighlightEntry[] | null;
  marginalia: MarginaliaEntry[] | null;
};
```

### 2.3 Backward compatibility

Mevcut moment kayıtlarında iki kolon da `null` kalır. Eski API tüketicileri
(client de dahil) bu alanları `?? []` ile handle etsin. Migration sırasında
veri dönüştürmesi YOK.

---

## 3. LLM mimarisi

### 3.1 Çağrı topolojisi — üç call, ikisi paralel

```
[Resim R2'ye yüklendi]
         │
    ┌────┴───────────────────┐
    ▼                        ▼   (paralel)
 OCR cleanText          Markings extraction
 flash-lite             full flash           
 (mevcut)               (YENİ)
    └─────────┬──────────────┘
              ▼
     Enrichment (summary+tags)
     flash-lite (mevcut)
     input: cleanText + highlights
```

**Neden full flash markings için:** flash-lite handwriting'i hallucinate
ediyor; "Genel AI" gibi 2-kelimelik notta yanlış okuma kullanıcı güvenini
anında kırar. Maliyet farkı kontrollü (50/gün cap zaten var).

**Neden paralel:** latency. İki call aynı resim üzerinde, bağımsız. Sıralı
yaparsak +2s; paralel +0.5s.

### 3.2 Kill switch

`ENV.enableMarkingCapture` — Railway'den flip edilebilir, redeploy gerekmez.
Regression olursa kapat, moment akışı çalışmaya devam etsin. Default ON.

### 3.3 Prompt taslağı (`server/_core/prompts.ts`'ye)

> Not: Bu taslak, final prompt DEĞİL. Bir sonraki session eval üzerinde
> iterate ederek son halini verir.

```
MARKINGS_PROMPT:
"Bu kitap sayfası fotoğrafını analiz et. ÇIKAR:

1. highlights[]: Kullanıcının altını çizdiği veya fosforlu kalemle
   işaretlediği metin parçaları. Her biri için: text (parçanın tamamı),
   kind ('highlighter' veya 'underline'), color (görülebiliyorsa).
   Basılı italik metni underline SANMA. Metin içi numaralandırmayı
   ((1)(2)(3) gibi) underline SANMA.

2. marginalia[]: Sayfaya kullanıcının el yazısıyla eklediği notlar.
   Her biri için: text, position ('top' sayfanın üst boşluğunda,
   'side' kenar boşluğunda, 'inline' metin arasında), anchor
   (varsa yakındaki satırın ilk 4 kelimesi), hasStar (yanında ★
   işareti varsa). Basılı metni el yazısı SANMA. Parmağı / gölgeyi
   marginalia SANMA.

3. emphasisMarkers: sayfada kaç tane ★, süslü parantez, kement
   işareti gördüğünün sayısı. Metin değil, sadece sayı.

Hiçbiri yoksa boş array döndür. JSON dışı hiçbir şey yazma."
```

### 3.4 JSON schema (strict)

```ts
MARKINGS_SCHEMA = {
  name: "markings_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      highlights: {
        type: "array",
        maxItems: 15,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string", maxLength: 500 },
            kind: { type: "string", enum: ["highlighter", "underline"] },
            color: { type: "string", enum: ["pink","yellow","green","other"] }
          },
          required: ["text", "kind"]
        }
      },
      marginalia: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string", maxLength: 500 },
            position: { type: "string", enum: ["top","side","inline"] },
            anchor: { type: "string", maxLength: 80 },
            hasStar: { type: "boolean" }
          },
          required: ["text"]
        }
      },
      emphasisMarkers: { type: "integer", minimum: 0, maximum: 20 }
    },
    required: ["highlights", "marginalia", "emphasisMarkers"]
  }
}
```

### 3.5 Enrichment prompt'a eklenecek tek satır

Mevcut `MOMENT_ENRICH_PROMPT` Türkçe metnin sonuna:

```
Eğer kullanıcının vurguladığı kısımlar verildiyse, tag seçerken bu
kısımlara ağırlık ver. Summary kuralları değişmez (yargısız, ≤20 kelime).
```

Ve input'a cleanText'in yanında `ÖZELLIKLE VURGULANAN: <highlights-text-concat>`
eklensin.

---

## 4. Database migration

**Dosya:** `drizzle/0005_add_markings.sql` (elle, `apply-migration.mjs` ile uygulanacak)

```sql
ALTER TABLE reading_moments
  ADD COLUMN highlights JSON NULL,
  ADD COLUMN marginalia JSON NULL;
```

**CLAUDE.md hatırlatması:** `drizzle-kit migrate` KULLANMA, `drizzle-kit generate`
KULLANMA. `node scripts/apply-migration.mjs drizzle/0005_add_markings.sql` ile
uygula. `DATABASE_URL` env'de olmalı (Railway değişkenleri).

**Schema güncellemesi:** `drizzle/schema.ts`'de `readingMoments` tablosuna iki
kolon eklenmeli — `highlights: json('highlights')`, `marginalia: json('marginalia')`.

---

## 5. Server implementation noktaları

### 5.1 `server/routers.ts` — `moments.create` mutation

Mevcut OCR bloğundan sonra, enrichment'tan ÖNCE:

```ts
// 2b. Markings extraction — OCR ile paralel olsun idealde, basit başlangıç:
let highlights: HighlightEntry[] | null = null;
let marginalia: MarginaliaEntry[] | null = null;

if (ENV.enableMarkingCapture && ocrImageUrl) {
  try {
    const markingsResponse = await invokeLLM({
      model: ENV.geminiModelChat,  // full flash — handwriting kalitesi için
      messages: [
        { role: "user", content: [
          { type: "text", text: MARKINGS_PROMPT },
          { type: "image_url", image_url: { url: ocrImageUrl, detail: "high" } }
        ]}
      ],
      responseFormat: { type: "json_schema", json_schema: MARKINGS_SCHEMA }
    });
    // ... parse, validate, assign
  } catch (err) {
    // Best-effort — moment yine kaydolur, markings null
    console.warn("[markings] extraction failed", {
      userId: ctx.user.id,
      model: ENV.geminiModelChat,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// 2c. Enrichment — mevcut akış, artık highlights da input olarak giriyor
```

**İdealde:** OCR ve markings `Promise.all` ile paralel çalışsın; enrichment
ikisi bittikten sonra. Ama v1'de sıralı da kabul — latency optimizasyonu
ikinci iterasyon.

### 5.2 Log discipline

**OCR text'i, highlights text'i, marginalia text'i LOG'A YAZMA.** Hepsi
PII. Mevcut `console.warn` pattern'indeki field'lar (userId, model,
promptName, durationMs, error.message) korunur — content field'ı yok.

### 5.3 `server/db.ts` — `createReadingMoment`

Fonksiyonun input'una `highlights` ve `marginalia` eklenmeli. Drizzle otomatik
JSON serialization yapıyor, extra iş yok.

---

## 6. UI implementation — iki ekran

### 6.1 AN detay ekranı (`app/...an-detail.tsx` veya mevcut dosya)

**Referans mockup:** `palimps-an-detay-v1-final` (Cowork artifact).

Yapı yukarıdan aşağı:
1. **Hero photo** — full width, aspect 380:460. Overlay: ★/★★ varsa sol üst köşede, pageHeading/top marginalia varsa fotoğraf üzerinde el yazısıyla (accent renkte, hafif rotate).
2. **Glassmorphism nav** — back + kitap adı+sayfa chip + menu.
3. **Content kartı** (scroll ile yukarı gelen):
   - Summary label + serif tek satır summary
   - Tag chip row (lavender)
   - **Altını çizdiklerin** section — serif quote block'lar, sol kenar:
     - pembe → `--pink` (`#EC4899`) border + pink gradient
     - mürekkep → `--primary` (`#6E46C8`) border + primary gradient
   - **Kenar notların** section — el yazısı font kartlar:
     - `position === 'top' && text.length ≥ 4 kelime` → promoted: accent gradyan zemin, font 20px, ★ varsa yanında
     - diğer → sade kart, font 17px, accent renk
   - **Kendi notun** — dashed border boş textarea, placeholder "Bu sayfa hakkında ne hissettin?"
   - **Sayfanın tamamı** — katlı, default kapalı, tap ile `ocrText` açılır.

### 6.2 Notların sekmesi (yeni route)

**Referans mockup:** `palimps-kutuphanem-v1-final` (Cowork artifact).

Yapı:
1. **Header** — "Notların" + meta count
2. **Metrik şeridi** — 3 hücre: toplam an / toplam altı çizili / toplam kenar not. Deterministik COUNT query.
3. **Arama** — client-side metin eşlemesi (LLM YOK v1'de). `ocrText` + `highlights[].text` + `marginalia[].text` + `userNote` içinde case-insensitive Türkçe locale arama.
4. **Hatırlat kartı** — günün gösterilecek içeriğine göre:
   - "1 yıl önce bugün X kitabı" (tam yıl dönümü varsa)
   - "N hafta önce şunu yazmışsın: <marginalia.text>" (son 30 günün dışında ilk marginalia)
   - Deterministik karar, LLM YOK.
5. **Timeline** — tarih grupları ("Bu hafta" / "Geçen hafta" / "X ay önce"). Her item:
   - Kitap adı + sayfa
   - Kind rozeti: altı çizili (pembe), altı çizili (mürekkep), kenar notun
   - İçerik (serif ya da el yazısı fontla)
   - Tag chip'leri
6. **Alt tab bar** — Ana sayfa / **Notların** (aktif) / Ekle / Profil

### 6.3 Palette (aynen kullan — `theme.config.js`)

```
background: #F8F6FF
foreground: #160E2C
muted:      #5F5678
primary:    #6E46C8
accent:     #A78BFA
surface:    #FDFBFF
border:     #E4DCFA
```

Yardımcı tokenler (gerekirse component'ta lokal):
```
--pink:        #EC4899
--pink-soft:   #FCE7F3
--primary-soft:#E9E0FB
--accent-soft: #F2EDFF
--border-soft: #EEE7FB
```

### 6.4 Font kuralları

- Altı çizili (yazarın sesi) → `ui-serif` (Fonts.serif)
- Kenar notu (el yazısı hissi) → iOS'ta "Snell Roundhand" fallback "Bradley Hand"; NativeWind'de font-family override gerekir. Ayrı bir `--font-hand` utility ekle.
- UI chrome → `system-ui` (Fonts.sans)
- Metrik sayıları → `ui-rounded` (Fonts.rounded) — warmth

### 6.5 Boş / az-veri / olgun durum — görünürlük kuralları (progressive disclosure)

**Neden bu bölüm var:** Hilal'in flag'i — "birikmedikçe boş kalır, veri yoksa
tasarımda uzay boşluğu hissi olmamalı". Her ekran 3 yaşam aşamasında da iyi
görünmeli: hiç veri yok, az veri (<10), olgun. Referans mockup:
`palimps-kutuphanem-states` (Cowork artifact, 3 telefon yan yana).

#### 6.5.1 AN detay (bkz. 6.1)

Summary + tag + `userNote` **her zaman** görünür — boş olsalar bile
iskelet/placeholder olarak.

Koşullu render'lar:

| Alan | Görünür koşul | Gizli davranış |
|---|---|---|
| `summary` + tag chip'leri | **HER ZAMAN** (enrichment başarısız olsa bile) | Summary yoksa → "—", tag yoksa → satırı tamamen çıkar |
| `highlights[]` section | `highlights?.length > 0` | Section başlığı + container komple gizlenir, dashed placeholder YOK |
| `marginalia[]` section | `marginalia?.length > 0` | Aynı — komple gizle |
| `userNote` dashed kart | **HER ZAMAN** görünür (boşsa placeholder metni) | "Bu sayfa hakkında ne hissettin?" — davetkâr kalır |
| "Sayfanın tamamı" accordion | `ocrText?.length > 0` | Accordion başlığı gizli, section yok |

**Kritik:** Altı çizili / kenar notu yoksa diye summary + tag'i gizleme. Bu
iki alan AN'ın omurgası — fotoğraf + özet + etiket = minimum viable AN.
Highlights/marginalia bonus.

#### 6.5.2 Notların tab (bkz. 6.2)

Üç durum:

**(A) Boş durum — `counts.total === 0`:**
- Header görünür ama meta count gizli ("Notların" tek başına).
- Metrik şeridi **gizli** (0/0/0 göstermek "fakir" hissi verir).
- Arama **gizli**.
- Hatırlat kartı **gizli**.
- Timeline **gizli**.
- Yerine: **Welcome kartı** — book+ ikon, başlık "Notların burada yaşayacak",
  alt metin ("Kitap okurken bir sayfa seç, fotoğraf çek. Özeti, etiketleri,
  altı çizdiklerin ve kenar notların burada toplanır."), primary CTA "İlk
  anını ekle", secondary link "Nasıl çalışıyor?".
- Altında 3-adım tips kartı (1. fotoğraf, 2. işaretler otomatik, 3. zaman
  içinde birikir).

**(B) Az veri — `1 <= counts.total < 10`:**
- Metrik şeridi **görünür** (gerçek sayılar: 4 / 12 / 1 vb.).
- Arama **`counts.total >= 3`** olunca görünür, altında boş.
- Hatırlat kartı **GİZLİ** (veri çok genç, yapay hissi vermesin).
- Timeline **görünür**, sadece dolu grupları render et ("Bu hafta" vs. yok,
  "Dün" ve "Bu hafta" varsa ikisi). Date label grupları **`items.length > 0`**
  olursa render, yoksa atla.
- En altta soft dashed "+ Yeni an ekle" nudge kartı (muted border, başlatıcı).

**(C) Olgun — `counts.total >= 10`:**
- Tam 6.2 spec'i — metrik + arama + Hatırlat + timeline + tüm grup etiketleri.
- Hatırlat görünürlük alt koşulu: **`oldestMomentAgeDays >= 21`** VEYA
  **tam yıl dönümü** (`createdAt.month === today.month && .day === today.day`).
  İkisi de yoksa Hatırlat kartı yine gizli, metrik → doğrudan timeline.

**Kod düzeyinde:** tRPC `moments.list` payload'ı tek çağrıda bunları
dönsün — client deterministik olarak hangi kart'ı göstereceğine karar etsin:

```ts
type NotlarinListResponse = {
  moments: MomentListItem[];           // paginate edilir
  counts: {
    total: number;
    highlights: number;                // SUM over highlights arrays
    marginalia: number;                // SUM over marginalia arrays
  };
  hatirlatCandidate: {
    kind: 'anniversary' | 'old_marginalia';
    momentId: string;
    label: string;                     // "1 yıl önce bugün" / "6 hafta önce"
    preview: string;                   // max 120 char
  } | null;                            // null → kart gizlenir
};
```

`hatirlatCandidate` üretimi server-side, deterministik, LLM YOK (tekrar:
"Hatırlat" duygusal etki verir ama mekaniği SQL query — `oldest non-recent
marginalia` + `same day of year in past year`).

#### 6.5.3 İkonografi + bileşen yeniden kullanım

- Welcome kartının book+ ikonu ve tips kartı — `components/` altında yeni
  `<EmptyLibraryState />` bileşeni olarak koy, reuse edilmese bile
  Notların tab'ını kirlenmekten koruyacak sınır.
- Soft nudge — Dashed border `var(--border)` (`#E4DCFA`), plus ikon accent
  (`#A78BFA`). Zaten `ScreenContainer`'a benzeyen stil; mevcut button
  pattern'i ile üret.

---

## 7. Eval — prompt iterasyonu için hazır golden set

**6 HEIC fotoğraf Hilal'in `/uploads` klasöründe** (bu session'da yüklendi):

| Dosya | Ne içeriyor |
|---|---|
| IMG_7191.HEIC | Pembe fosforlu, iki uzun cümle + "entelektüel el emeği" alıntısı |
| IMG_7192.HEIC | Pembe fosforlu, devam pasajı |
| IMG_7193.HEIC | Pembe fosforlu, kısa parça "internetten sipariş edilebilecek bir kıyamet" |
| IMG_7195.HEIC | Dolmakalem underline + metin içi (1)(2)(3)(4) numaralandırma (BASILI, underline SANILMAMALI) |
| IMG_7196.HEIC | Sayfa başına el yazısı "Yapay Zeka Yönetici(liği)?" + ★★ + paragraf altı çizme |
| IMG_7197.HEIC | Uzun underline + kenarda süslü parantez grupu + el yazısı "Genel AI" marjinal not |

**Test yazım yeri:** `server/__tests__/markings.test.ts`.

**Beklenen failure mode'ları test et:**
1. Basılı italik metni underline sanma (7195'te italik kelime var)
2. Parmağı / gölgeyi marginalia sanma (7196'da başparmak var)
3. "(1)(2)(3)(4)" numaralandırmasını underline içine dahil etme
4. Handwriting'i yanlış okuma ("Genel AI" → "Genel Al" vb.)
5. ★ işaretini atlama (7196'da iki ★, 7197'de en az bir)

**Eval protokolü (önerilen):**
- Her fotoğraf için beklenen {highlights, marginalia, emphasisMarkers} şeklini insan elle JSON olarak yaz.
- Test: gerçek LLM çağrısını yap, output'u beklenenle karşılaştır (fuzzy match — tam eşitlik değil, içerik örtüşmesi).
- Success threshold: 6 fotoğraftan en az 5'inde "geçti" (text overlap ≥%80, kind doğru, marginalia sayısı ±1).

---

## 8. Guardrails / privacy

1. **Aydınlatma metni** (KVKK) güncellenmeli:
   "OCR ile basılı metin çıkarımı" → "OCR ile basılı metin VE el yazısı not çıkarımı".
   `palimps-guardrails` skill'indeki metin şablonunu kontrol et.

2. **Privacy Manifest** üzerinde data type değişikliği yok (zaten image
   veriyoruz Gemini'ye). Yeni SDK yok, yeni domain yok.

3. **Log PII:** content field'ları ASLA log'a yazma. Mevcut pattern korunur.

4. **Data deletion:** `reading_moments` satırı silindiğinde `highlights` ve
   `marginalia` otomatik gider (aynı satır). KVKK deletion job'u değişmez.

---

## 9. Deferred — v1'de YAPILMAYACAK, niye

| Özellik | Neden erteleniyor |
|---|---|
| Tag atlası (tag cloud) | 10 notlu kullanıcıda "boş mağara" hissi. 100+ notta anlam kazanır. v1.5. |
| LLM discover kartları ("Senin için") | Scheduled job + cache + cost izleme bir haftalık iş. Deterministik "Hatırlat" kartı aynı duygusal etkinin %10 maliyetiyle verilebiliyor. v2. |
| Curated export (yıllık, tema paketi) | Düz markdown/csv export yeterli v1'de. LLM-powered curation ayrı yaratım akışı olarak v2. |
| Kütüphanem'de doğal dil sorgu | Basit arama yeterli. Chat sekmesi zaten var. v2. |
| Streak / XP / level / push nag | **Asla.** PALIMPS "sade kütüphaneci"; Duolingo değil. Metrik şeridi koleksiyon hissini veriyor, streak mekaniği yok. |

---

## 10. Anti-pattern uyarıları

1. **Auto-fill `userNote`:** YAPMA. `userNote` sakral, boş kalır, opt-in lift
   ile kullanıcı istediğinde doldurur.

2. **`pageHeading` kolonu eklemek:** YAPMA. `marginalia[].position === 'top'`
   ile aynı iş yapılır, fazla kategori fazla karmaşa.

3. **`drizzle-kit generate` / `migrate` çalıştırmak:** YAPMA. Hand-written
   migration, `apply-migration.mjs`. Bkz. CLAUDE.md.

4. **Markings için flash-lite:** YAPMA. Handwriting kalitesi çöker. Full flash.

5. **OCR prompt'una "markings de çıkar" satırı ilave etmek:** YAPMA. İki ayrı
   call. Tek prompt yapınca cleanText kalitesi de düşer; Gemini aynı anda iki
   iş yaparken biri zayıflar.

6. **Structured output'u `strict: false` yapmak:** YAPMA. Hallucinated key'ler
   / extra property'ler runtime error yerine sessizce kaybolur.

7. **Kenar notlarını altı çizili ile aynı listede göstermek:** YAPMA. İki ayrı
   section, iki ayrı tipografi, iki ayrı renk. Üç ses asla karışmaz.

8. **Summary + tag'i highlights/marginalia yok diye gizlemek:** YAPMA. Summary
   ve tag AN'ın omurgası — enrichment başarılıysa her zaman görünür, yeni
   alanların doluluğuna bağlı değil. Section 6.5.1'e bak.

9. **Boş durumda 0/0/0 metrik göstermek:** YAPMA. `counts.total === 0` iken
   metrik şeridi komple gizlenir, yerine welcome kartı gelir. "Sıfır" sayısı
   yeni kullanıcıya fakir hissi verir.

10. **Hatırlat kartını zorla doldurmak:** YAPMA. `hatirlatCandidate` server'dan
    `null` dönerse kart render edilmez — yapay "sana hatırlatacak bir şey yok
    ama yine de buradayız" placeholder'ı kurma. Sessizlik kabul.

---

## 11. Implementation sırası — önerilen

1. ✅ **Karar aşaması** — bu dosya (tamamlandı).
2. **Migration** — `drizzle/0005_add_markings.sql` + `schema.ts` güncelle + apply.
3. **Server prompts + schema** — `prompts.ts`'ye `MARKINGS_PROMPT` +
   `MARKINGS_SCHEMA` ekle. Mevcut `MOMENT_ENRICH_PROMPT`'u highlights'ı tag'e
   yansıtacak şekilde revize et.
4. **Router wiring** — `moments.create`'e markings call ekle (paralel
   idealde), `createReadingMoment` db helper'ı güncelle.
5. **Eval** — 6 HEIC fotoğrafı golden set yap, `markings.test.ts` yaz,
   prompt'u iterate et.
6. **Guardrails** — aydınlatma metni güncellemesi.
7. **UI — AN detay** — mevcut detay ekranını mockup'a göre yeniden kur.
8. **UI — Notların tab** — yeni route + components.
9. **Kill switch + feature flag test** — `ENV.enableMarkingCapture=false`
   ile moment akışı hala çalışıyor mu regression test.
10. **EAS build + TestFlight** — `buildNumber` bump et, release notes yaz.

---

## 12. Referans artifact'lar (Cowork session'ında kalır)

- `palimps-an-mockup-v1` — detay ekranı üç yönü karşılaştırması (A/B/C)
- `palimps-kutuphanem-mockup-v1` — Kütüphanem üç yönü karşılaştırması
- `palimps-kutuphanem-v1-final` — seçilen sade v1 Notların ekranı (PALIMPS paletinde)
- `palimps-an-detay-v1-final` — seçilen hibrit AN detay ekranı (PALIMPS paletinde)
- `palimps-kutuphanem-states` — Notların sekmesinin üç yaşam evresi: boş / az-veri / olgun (6.5'in görsel karşılığı)

`palimps-kutuphanem-v1-final` + `palimps-an-detay-v1-final` → olgun durumun referansı.
`palimps-kutuphanem-states` → boş ve ara durumun referansı.
İlk ikisi (mockup-v1) alternatif karşılaştırma kaydı.

---

## 13. Açık soru — bir sonraki session'a

- Paralel call için `Promise.all` mı yoksa Railway/tRPC'de dikkat edilmesi gereken bir pattern var mı? (teyit et)
- `color` detection flash'ın güvenilir bildiği bir şey mi? Eval'de iki-üç renk üzerinden doğrulama yap.
- Marginalia `anchor` (yakındaki satırın ilk kelimeleri) gerçekten faydalı mı yoksa YAGNI mi? İlk eval'den sonra karar.
- iOS'ta handwriting fallback font'u nasıl taşınır NativeWind/Expo stack'inde? (araştır, gerekirse `expo-font`).

---

**Bu dosyayı bir sonraki task'ın ilk iş olarak oku, sonra kodu yaz.**
