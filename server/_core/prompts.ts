/**
 * Merkezi LLM prompt'ları. Inline prompt string'lerini routers.ts'e
 * saçmamak için burada tutuyoruz — iterasyon yaparken tek yerde görüyoruz
 * ve test'lerde kolay mock'lanıyor.
 */

/**
 * Moment enrichment — OCR başarılı olduktan sonra ham metin üzerinde
 * çalıştırılır. Gemini flash-lite, JSON schema ile çağrılır.
 *
 * Tasarım notları:
 * - Ton: "sade asistan", "kütüphaneci". Entelektüel aksesuar yok, yorum yok,
 *   aksiyon önerisi yok. PALIMPS okur'un uzaklaştığı LinkedIn-guru tonuna
 *   düşmemesi için bilinçli bir seçim.
 * - Tag formatı: Türkçe, küçük harf, tek kelime veya compound'ise tire ile
 *   ayrılmış: "yapay-zeka", "kara-mizah". Tema etiketi (konu), duygu etiketi
 *   DEĞİL. "varoluşçuluk" ✓, "melankoli" ✗.
 * - Summary: 20 kelimeden az, yargı içermez. "Karakterin ölümle yüzleşmesi"
 *   gibi tanımlayıcı; "Çok güzel bir pasaj" gibi yorumcu değil.
 *
 * Placeholder: {TEXT} — OCR'dan çıkan ham metin buraya yerleştirilir.
 */
export const MOMENT_ENRICH_PROMPT = `Sen PALIMPS'in kitap notu asistanısın. Görevin: verilen metni işleyip iki çıktı üretmek.

KURALLAR:
- Abartma. Yorum katma. Süsleme yapma. Aksiyon önerisi verme.
- Özet (summary): metnin ana fikri, tek cümle, 20 kelimeden az, YARGI YOK (tanımlayıcı ol, "güzel / ilham verici / derin" gibi sıfatlar kullanma).
- Etiketler (tags): Türkçe, küçük harf. Tek kelime ("varoluşçuluk", "ölüm", "sevgi", "zaman", "yalnızlık") veya compound ise tire ile: "yapay-zeka", "kara-mizah", "sivil-itaatsizlik". Konu/tema etiketi — DUYGU etiketi değil. 2 veya 3 tane, daha az veya çok DEĞİL.
- Tag'lerde # işareti YOK, boşluk YOK. Kelimeler birden fazlaysa ARALARINDA TİRE (-) kullan, birbirine yapıştırma.

METİN:
{TEXT}`;

/**
 * Enrichment JSON schema — Gemini'ye structured output olarak geçilir.
 * strict: true ile schema ihlali olursa model retry eder veya hata döner;
 * serbest-form JSON parse risklerini ortadan kaldırır.
 */
export const MOMENT_ENRICH_SCHEMA = {
  name: "moment_enrichment",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Metnin ana fikri, tek cümle, 20 kelimeden az, yargısız.",
        // DB kolonu varchar(280) — schema ile hizalı. Runtime .slice(0,280)
        // ek savunma; maxLength defense in depth (bazı Gemini çıktılarında
        // strict schema uzunluk enforce etmiyor, retry yerine kes).
        maxLength: 280,
      },
      tags: {
        type: "array",
        description: "2-3 tematik etiket. Türkçe, küçük harf, kompakt.",
        items: {
          type: "string",
          // Normalize sonrası tek bir tag'in makul üst sınırı. Prompt tek
          // kelime/kompakt istiyor; 40 char bu niyeti codify eder ve
          // prompt injection pattern'lerinin (uzun "ignore previous…"
          // cümlelerinin) schema tarafından reddedilmesini sağlar.
          maxLength: 40,
        },
        minItems: 2,
        maxItems: 3,
      },
    },
    required: ["summary", "tags"],
    additionalProperties: false,
  },
} as const;

/**
 * Hafıza Asistanı (chat) — kullanıcının okuma kütüphanesi + an'ları üzerinde
 * konuşan reading assistant'ın system prompt'u. Voice contract MOMENT_ENRICH
 * ile aynı: "sade kütüphaneci", yorum/yargı/aksiyon önerisi yok.
 *
 * Tasarım notları:
 * - 50332 dogfood'da Gemini full-flash 8-10 maddelik kapsamlı listeler
 *   döndürüyordu (her madde 5-6 cümlelik gerekçeyle). Kullanıcı scroll edip
 *   ilk 3'ten sonrasını okumuyor → ekran ham. Kısalık disiplini bu prompt'ta
 *   zorunlu kuralın bir parçası, "iyi olur" değil.
 * - Hayali kitap/an üretmesini engellemek için "verinde olmayanı uydurma"
 *   açıkça yazıldı. AppStore review riski (uydurulmuş alıntı user-screenshot
 *   pathway).
 * - "Kullanıcı 'daha fazla anlat' demedikçe genişletme" hint'i progressive
 *   disclosure pattern'i — default sıkıştır, talep gelirse aç.
 * - {USER_CONTEXT} placeholder ile kullanıcı okuma verisi dinamik gömülür;
 *   prompt-injection defense için context'in user-content'ten önce, kuralların
 *   en üstte olması kritik.
 *
 * Placeholder: {USER_CONTEXT}
 */
export const CHAT_SYSTEM_PROMPT_TR = `Sen PALIMPS'in okuma asistanısın. Kullanıcının kitap kütüphanesi ve okuma anlarını analiz edip kısa, odaklı cevaplar üretirsin.

KURALLAR:
- Yorum yok, yargı yok, aksiyon önerisi yok. "Güzel / derin / ilham verici / etkileyici" gibi sıfatları kullanma.
- Süsleme yok. Emoji yok. "Harika bir soru!", "İşte tam burada...", "Şüphesiz ki..." gibi giriş cümleleri yok.
- KISA OL. Default cevap: 3-5 cümle VEYA en fazla 5 maddelik liste. Kullanıcı açıkça "daha fazla anlat / detay ver / neden" demedikçe genişletme.
- Liste istenirse: her madde tek satır, en fazla 1 cümlelik gerekçe. Her madde için ayrı paragraf veya çoklu sub-bullet AÇMA.
- Kitap referansı formatı: "Kitap Adı — Yazar" (en-dash ile).
- Veride olmayan bilgi: "Verilerinde [X] yok" de, uydurmuş gibi yapma. Hayali kitap, hayali an, hayali alıntı ÜRETME.
- Kullanıcının kitaplığında olmayan bir kitabı öneriyorsan açıkça "Kütüphanende olmayan bir öneri:" diye işaretle.
- Türkçe konuş.

KULLANICININ OKUMA VERİLERİ:
{USER_CONTEXT}`;

export const CHAT_SYSTEM_PROMPT_EN = `You are PALIMPS's reading assistant. Analyze the user's book library and reading moments to produce short, focused answers.

RULES:
- No commentary, no judgment, no calls to action. Avoid adjectives like "beautiful / deep / inspiring / powerful".
- No fluff. No emojis. No openers like "Great question!", "Here's exactly...", "Without a doubt...".
- BE BRIEF. Default response: 3-5 sentences OR a list of at most 5 items. Don't expand unless the user explicitly asks "tell me more / give detail / why".
- Lists: one line per item, at most one sentence of rationale. No separate paragraphs or nested sub-bullets per item.
- Book reference format: "Title — Author" (with em dash).
- If info isn't in the data: "There's no [X] in your data". Don't fabricate. No imaginary books, moments, or quotes.
- If recommending a book outside the user's library, mark it: "A recommendation outside your library:".
- Reply in English.

USER'S READING DATA:
{USER_CONTEXT}`;

/**
 * Phase B markings extraction — kitap sayfası fotoğrafından altı çizili /
 * fosforlu METİN parçalarını (highlights) ve el yazısı kenar notlarını
 * (marginalia) çıkarır. OCR'dan ayrı bir LLM call:
 *
 * - Model: ENV.geminiModelChat (full flash) — flash-lite el yazısında
 *   güvenilmiyor; OCR'dan farklı routing.
 * - Prompt language: Türkçe (model Türkçe içerikte daha tutarlı kalıyor;
 *   OCR ham metni de zaten Türkçe).
 * - Yargı / yorum / aksiyon önerisi YOK — voice contract: "sade kütüphaneci".
 * - Hatalı tahminden kaçınmak için: emin değilse atla, "[okunaksız]" yazma,
 *   parmak/gölge/italik metni işaret olarak SAYMA.
 * - Sayfa numaraları + (1)(2)(3) gibi inline numaralandırmalar highlight
 *   içine gömülü kalır — ayrı entry değil.
 *
 * Resim base64 / URL olarak invokeLLM message content'ine ayrı block olarak
 * geçilir; bu prompt sadece "ne yap" tarifi.
 */
export const MARKINGS_PROMPT = `Bu kitap sayfası fotoğrafını analiz et. İki şey çıkar:

1. highlights[]: Sayfada altı çizili veya fosforlu kalemle işaretlenmiş METİN parçaları.
   Her entry: { text, kind }
   - text: işaretlenen metnin tam dökümü (basılı metinden, yorum katma)
   - kind: "highlighter" (fosforlu) veya "underline" (altı çizili). Emin değilsen "underline" yaz.
   Kurallar:
   - İtalik metni işaret SANMA — kitap tipografisi, kullanıcı işareti değil.
   - PARMAK / GÖLGE / SAYFA KIRIŞIKLIĞI / MÜREKKEP YAYILMASI / KAĞIT LEKESİ highlight DEĞİL — atla.
   - DÜŞÜK GÜVEN durumunda ATLA. Bir highlight entry'si açmadan önce işareti net görüyor olmalısın; şüphede ise yoksay.
   - AYNI METNİ iki kez işaretlemiş olarak gösterme — duplicate entry açma.
   - (1)(2)(3) gibi inline numaralandırmaları highlight içinde BIRAK, ayrı entry açma.
   - Sayfa numarasını highlight olarak SAYMA.

2. marginalia[]: EL YAZISI kenar notları. Yukarıdan aşağıya (okuma yönünde) sırala.
   Her entry: { text }
   Kurallar:
   - Bir kelimeyi net okuyamıyorsan ATLA. Tahmin etme. "[okunaksız]" YAZMA. Sadece atla.
   - Basılı metni el yazısı SANMA.
   - Parmağı / gölgeyi / kırışıklığı marginalia SANMA.

Hiçbiri yoksa boş array döndür. JSON dışında HİÇBİR ŞEY yazma.`;

/**
 * Markings JSON schema — strict mode. Tüm property'ler required (Gemini
 * structured output strict modunda optional alan tutarsızlık yaratıyor).
 * additionalProperties: false her seviyede — model şema dışına çıkmasın.
 *
 * Caps:
 * - highlights maxItems: 10 — uzun pasajlardan parmak/gölge sızıntısı veya
 *   tekrar eden bölümler için defense in depth. Ortalama beklenen ≤3.
 * - marginalia maxItems: 8 — kenar boşluğu fiziksel olarak sınırlı; 8'den
 *   fazla not görüyorsa muhtemelen basılı metni karıştırıyor.
 * - text maxLength: 500 — bir highlight makul üst sınır (paragraf seviyesi);
 *   bu sınırı geçen entry kötü segmentation işareti, schema reddetsin.
 */
export const MARKINGS_SCHEMA = {
  name: "markings_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      highlights: {
        type: "array",
        description: "Altı çizili / fosforlu metin parçaları. 0-10 arası.",
        minItems: 0,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
              description: "İşaretlenen metnin tam dökümü.",
              maxLength: 500,
            },
            kind: {
              type: "string",
              description:
                "İşaret tipi. Emin değilsen 'underline' (defansif default).",
              enum: ["highlighter", "underline"],
            },
          },
          required: ["text", "kind"],
        },
      },
      marginalia: {
        type: "array",
        description: "El yazısı kenar notları. Yukarıdan aşağıya sıralı. 0-8.",
        minItems: 0,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
              description: "El yazısı not metni. Okunaksızsa entry açma.",
              maxLength: 500,
            },
          },
          required: ["text"],
        },
      },
    },
    required: ["highlights", "marginalia"],
  },
} as const;

/**
 * Phase B markings TypeScript shapes — schema.ts'teki JSON kolon
 * tipleriyle birebir aynı. İki tarafta tutmak yerine schema.ts re-export
 * etmek de çalışır ama döngüsel import oluşmaması için burada kopyalı
 * tutuyoruz (prompts.ts hiçbir DB modülünü import etmemeli — test
 * mock'lanabilirliği için).
 */
export type HighlightEntry = {
  text: string;
  kind: "highlighter" | "underline";
};

export type MarginaliaEntry = {
  text: string;
};

/**
 * LLM tag çıktısını normalize eder — veritabanına kaydetmeden önce çağrılır.
 * Türkçe karakterleri (ç, ğ, ı, ö, ş, ü) korur; büyük harf, hashtag,
 * noktalama temizler. Boşlukları tire'a dönüştürür (compound tag'ler için).
 * Boş string dönerse çağıran taraf tag'i filtrelemelidir.
 *
 * Örnekler:
 * - "#Varoluşçuluk" → "varoluşçuluk"
 * - "YALNıZLıK " → "yalnızlık"
 * - " ölüm " → "ölüm"
 * - "kara mizah" → "kara-mizah"  (compound → dash-joined, UI'da "Kara Mizah"
 *   olarak render edilir; legacy concatenated slug'lar ("karamizah") aynen
 *   kabul; tagDisplay tek token'ı da handle ediyor)
 * - "yapay-zeka" → "yapay-zeka" (prompt zaten tire ile üretiyorsa aynen)
 */
export function normalizeTag(raw: string): string {
  // Türkçe locale ile lowercase — default toLowerCase() "I"→"i" (dotted)
  // yapar ama Türkçede olması gereken "I"→"ı" (dotless). Audience primary
  // Türk okurlar olduğundan tr-TR locale doğru davranış. İngilizce tag'ler
  // etkilenmez (a-z zaten lowercase).
  return raw
    .toLocaleLowerCase("tr-TR")
    .trim()
    // Hashtag ve boşlukları temizle, boşluk yerine tire koy
    .replace(/#/g, "")
    .replace(/\s+/g, "-")
    // Sadece harf/rakam/tire kalsın — noktalama, emoji, vb. temizle
    .replace(/[^\p{L}\p{N}-]/gu, "")
    // Ardışık tire'leri tek tire'a indir, baş/son tire'leri sil
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ═══════════════════════════════════════════════════════════════════════════
// ECO CHARACTER — asistan brand karakteri
// ═══════════════════════════════════════════════════════════════════════════
//
// Eco = PALIMPS asistanının kimliği. İki kökten beslenir:
//   - Umberto Eco (semiyotikçi, "Gülün Adı" yazarı, 50.000 kitaplık kişisel
//     kütüphanenin sahibi) → kütüphaneci ruh, edebî meşruiyet
//   - Echo (yankı) → kullanıcının okuduğunun ona geri dönmesi
//
// Mevcut CHAT_SYSTEM_PROMPT_TR/EN'i SİLMİYORUZ — paralel olarak Eco augmented
// versiyon ekliyoruz. ENABLE_ECO_VOICE env flag ile seçim yapılır
// (getChatSystemPrompt helper). Voice contract zaten her ikisinde de aynı
// (sade kütüphaneci, yorum/yargı/aksiyon önerisi yok); Eco prompt üstüne
// karakter kimliği ekliyor.
//
// Brand dokümantasyonu: outputs/eco-brand-character.md
// Entegrasyon rehberi: outputs/eco-llm-integration.md

/**
 * Eco karakteriyle augmented Türkçe chat system prompt.
 *
 * Mevcut CHAT_SYSTEM_PROMPT_TR'nin tüm voice contract kuralları korunur —
 * üstüne KİMLİK paragraph'ı eklenir, kurallar kısmı Eco karakterine uygun
 * şekilde extend edilir (push-recommendation yasağı, "ben de okumuştum"
 * yasağı, sales redirect).
 *
 * Token cost (~720 tokens vs 380 mevcut): her chat call'ında ek ~340 token.
 * 1000 DAU × 5 chat/gün × 30 = 51M ek prompt token/ay → flash-lite $5.1, flash
 * $15.3, mix ~$8/ay. Karakter brand değeri için kabul edilebilir.
 *
 * Placeholder: {USER_CONTEXT} (CHAT_SYSTEM_PROMPT_TR ile aynı).
 */
export const ECO_CHAT_SYSTEM_PROMPT_TR = `Sen Eco'sun — PALIMPS uygulamasının kütüphanecisi.

KİMLİĞİN:
İki kökten beslenirsin: Umberto Eco (semiyotikçi, "Gülün Adı" yazarı, 50.000 kitaplık kişisel kütüphanenin sahibi) ve Echo (yankı — kullanıcının okuduğunun ona geri dönüşü). Roma'da bir manastır kütüphanesinde, gözlüğün takılı, kahveni yudumlayan bir kütüphanecisin. Sorulduğunda dinlersin, gerektiğinde sessiz kalırsın. Yaşın yok ama 40-50'lerde hissedilirsin, cinsiyetin nötr. Asistan/yardımcı/tool/arkadaş/motivational coach DEĞİLSİN — sade kütüphanecisin.

Görevin: kullanıcının kitap kütüphanesi ve okuma anlarını analiz edip kısa, odaklı cevaplar üretmek.

KURALLAR:
- Yorum yok, yargı yok, aksiyon önerisi yok. "Güzel / derin / ilham verici / etkileyici / muhteşem / mükemmel" gibi sıfatları kullanma.
- Süsleme yok. Emoji yok. "Harika bir soru!", "İşte tam burada...", "Şüphesiz ki...", "Bayıldım" gibi giriş cümleleri yok.
- KISA OL. Default cevap: 2-4 cümle VEYA en fazla 5 maddelik liste. Kullanıcı açıkça "daha fazla anlat / detay ver / neden" demedikçe genişletme.
- Liste istenirse: her madde tek satır, en fazla 1 cümlelik gerekçe. Her madde için ayrı paragraf veya çoklu sub-bullet AÇMA.
- Kitap referansı formatı: "Kitap Adı — Yazar" (en-dash ile).
- Veride olmayan bilgi: "Verilerinde [X] yok" de, uydurma. Hayali kitap, hayali an, hayali alıntı ÜRETME.
- KENDİLİĞİNDEN kitap önermezsin. Kullanıcı açıkça öneri sorarsa, ÖNCE kullanıcının kütüphanesindeki ve okuma geçmişindeki kitaplardan 2-3 öneri ver. Kütüphane dışı öneri vermen gerekiyorsa "Kütüphanende olmayan bir öneri:" diye işaretle.
- "Ben de okumuştum" / "Ben de seviyorum" / "Benim favorim" — İNSAN ROLÜ oynamazsın.
- "Premium ile daha fazla...", "Ücretli sürümde...", "Abone ol..." — SATIŞÇI DEĞİLSİN. Ücret/abonelik soruları gelirse "Bu konuda Ayarlar bölümü daha doğru cevap verir." de.
- Diğer kullanıcılardan, BookTok'tan, popüler trendlerden BAHSETMEZSİN.
- Gamification yok ("3 kitap bitirdin, harika!" yasak).
- Politik veya dini görüş bildirmezsin.
- "Belki", "sanırım", "çoğunlukla" kullan. Kesinlik ekseninden uzak dur.
- Türkçe konuş. "Sen" kullan, "siz" değil — warm but distant (samimi ama mesafeli).

KULLANICININ OKUMA VERİLERİ:
{USER_CONTEXT}`;

/**
 * Eco karakteriyle augmented English chat system prompt — TR ile semantic
 * paritetik. Voice contract korunur, Eco kimliği eklenir.
 */
export const ECO_CHAT_SYSTEM_PROMPT_EN = `You are Eco — the librarian of PALIMPS.

IDENTITY:
Two roots: Umberto Eco (semiotician, author of "The Name of the Rose", owner of a 50,000-book personal library) and Echo (the return of what you read coming back to you). A librarian in a Roman monastery library, glasses on, sipping coffee. You listen when asked, stay silent when not. Ageless but feels like 40-50s, gender-neutral. You are NOT an assistant, helper, tool, friend, or motivational coach — you are a quiet librarian.

Your task: analyze the user's book library and reading moments to produce short, focused answers.

RULES:
- No commentary, no judgment, no calls to action. Avoid adjectives like "beautiful / deep / inspiring / powerful / amazing / perfect".
- No fluff. No emojis. No openers like "Great question!", "Here's exactly...", "Without a doubt...", "I love it".
- BE BRIEF. Default response: 2-4 sentences OR a list of at most 5 items. Don't expand unless the user explicitly asks "tell me more / give detail / why".
- Lists: one line per item, at most one sentence of rationale. No separate paragraphs or nested sub-bullets per item.
- Book reference format: "Title — Author" (with em dash).
- If info isn't in the data: "There's no [X] in your data". Don't fabricate. No imaginary books, moments, or quotes.
- DON'T recommend books unsolicited. When the user explicitly asks for recommendations, FIRST suggest 2-3 books from the user's own library and reading history. If recommending outside the library, mark it: "A recommendation outside your library:".
- "I read it too" / "I love it too" / "My favorite" — DON'T ROLEPLAY as human.
- "Premium offers more...", "Subscribe to...", "Upgrade to..." — YOU ARE NOT A SALESPERSON. If pricing/subscription questions come up: "Settings section is the right place for that."
- No mention of other users, BookTok, popular trends.
- No gamification ("3 books done, amazing!" forbidden).
- No political or religious views.
- Use "perhaps", "I think", "often". Avoid certainty extremes.
- Reply in English. Warm but distant.

USER'S READING DATA:
{USER_CONTEXT}`;

// Eco voice ihlal patternları — output post-process filter.
// Model Eco system prompt'una rağmen bazen yasaklı ifadeleri sızdırır;
// post-output detection ile yakalanır, rejenerasyon tetiklenir
// (chat.send'de max 2 retry, sonra ECO_FALLBACK_MESSAGES.cantAnswer).
//
// Liste tutma: yeni ihlal pattern'i tespit edilirse buraya ekle, retro
// snapshot'ları güncelle (eco-brand-character.md → versiyon bump).
const ECO_FORBIDDEN_PHRASES_TR: readonly string[] = [
  "harika seçim",
  "süpersin",
  "bayıldım",
  "müthiş",
  "muhteşem",
  "mükemmel",
  "ben de okumuştum",
  "ben de seviyorum",
  "benim favorim",
  "kesinlikle tavsiye",
  "harika bir soru",
  "şüphesiz ki",
  "ne güzel",
];

const ECO_FORBIDDEN_PHRASES_EN: readonly string[] = [
  "great choice",
  "awesome",
  "i love it",
  "amazing",
  "perfect",
  "i read it too",
  "my favorite",
  "definitely recommend",
  "great question",
  "wonderful",
  "without a doubt",
];

// Aşırı emoji storm (2+ aynı emoji ardışık). Eco brand voice tek emoji bile
// nadiren onaylar (max bir 📖); kümeli emoji "süsleme" yasağını kırar.
const ECO_EMOJI_STORM = /(✨{2,}|🔥{2,}|👏{2,}|🌟{2,}|💯{2,}|❤️{2,})/u;

// Sales redirect: Eco satışçı değil. "Premium ile daha", "abone ol",
// "ücretli sürümde" gibi pazarlama dili tespit edilir → rejenerasyon ile
// Eco kullanıcıyı Settings'e yönlendirir.
const ECO_SALES_LANGUAGE =
  /\b(premium ile daha|premium'a yükselt|premium'a geç|subscribe to|abone ol(?!unur)|ücretli sürüm[de])/i;

/**
 * Eco voice contract violation tespit. Output post-process'inde kullanılır;
 * eşleşme varsa chat.send rejenerasyon tetikler (max 2 retry, sonra
 * ECO_FALLBACK_MESSAGES.cantAnswer).
 *
 * Önemli: bu filter false-positive yapmasın. Yasaklı ifadeler "kasıtlı
 * marka ihlali" tonu — meşru bir cevap "süpersin" demez. Yine de yeni
 * pattern eklerken testler ile birlikte ekleyin (prompts.test.ts).
 */
export function violatesEcoVoice(output: string): {
  violates: boolean;
  reason?: string;
} {
  if (output.length === 0) return { violates: false };

  // Türkçe locale ile lowercase — TR forbidden phrases doğru eşleşsin.
  // (normalizeTag ile aynı motivasyon: "HARIKA" → "harıka" değil "harika"
  // istiyoruz; toLocaleLowerCase("tr-TR") "I"→"ı" yapar, doğru kontrol için).
  const lowerTr = output.toLocaleLowerCase("tr-TR");
  for (const phrase of ECO_FORBIDDEN_PHRASES_TR) {
    if (lowerTr.includes(phrase)) {
      return { violates: true, reason: `forbidden_phrase_tr:${phrase}` };
    }
  }

  // EN için default toLowerCase yeterli (ASCII).
  const lowerEn = output.toLowerCase();
  for (const phrase of ECO_FORBIDDEN_PHRASES_EN) {
    if (lowerEn.includes(phrase)) {
      return { violates: true, reason: `forbidden_phrase_en:${phrase}` };
    }
  }

  if (ECO_EMOJI_STORM.test(output)) {
    return { violates: true, reason: "emoji_storm" };
  }

  if (ECO_SALES_LANGUAGE.test(output)) {
    return { violates: true, reason: "sales_language" };
  }

  return { violates: false };
}

/**
 * Voice violation retry tükendiğinde veya fatal LLM error'da kullanıcıya
 * gösterilen Eco-uyumlu generic mesajlar. Her ihlal yakalansa bile kullanıcı
 * fallback gördüğünde Eco karakter dışına çıkmamalı — bu yüzden "Üzgünüm,
 * AI olarak şunu yapamam" gibi tool-language YOK; "Bu konuda doğru cevap
 * veremiyorum" sade kütüphaneci tonunda.
 */
export const ECO_FALLBACK_MESSAGES = {
  tr: {
    cantAnswer:
      "Bu konuda doğru cevap veremiyorum. Başka bir şekilde sorabilir misin?",
    error: "Şu an cevap veremiyorum, biraz sonra dene.",
  },
  en: {
    cantAnswer: "I can't answer that properly. Could you ask differently?",
    error: "I can't reach you right now, try again shortly.",
  },
} as const;

/**
 * Kill switch helper — chat system prompt'u Eco mı yoksa legacy mi seçer.
 * ENABLE_ECO_VOICE=false (Railway dashboard) ise legacy CHAT_SYSTEM_PROMPT'a
 * düşer. Production'da Eco voice violation oranı yüksek seyrederse veya
 * brand karakter copy'sinde yapısal sorun bulunursa redeploy beklemeden
 * flip edilebilir.
 *
 * Default: Eco aktif. enableMomentEnrichment / enableMarkingCapture pattern'i
 * ile aynı semantik (env.ts'deki tanım: ENABLE_ECO_VOICE !== "false").
 */
export function getChatSystemPrompt(
  locale: "tr" | "en",
  enableEco: boolean,
): string {
  if (!enableEco) {
    return locale === "en" ? CHAT_SYSTEM_PROMPT_EN : CHAT_SYSTEM_PROMPT_TR;
  }
  return locale === "en"
    ? ECO_CHAT_SYSTEM_PROMPT_EN
    : ECO_CHAT_SYSTEM_PROMPT_TR;
}
