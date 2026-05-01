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
// CHAT SYSTEM PROMPT — TR + EN paralel, tek unified prompt
// ═══════════════════════════════════════════════════════════════════════════
//
// 26 Nis 2026: iki paralel prompt (legacy "Asistan" + Eco "Kütüphaneci") tek
// CHAT_SYSTEM_PROMPT_TR/EN'a birleştirildi. Eco kimlik metni Hilal tarafından
// erkenden geri çekilmişti ama izi kod isimlerinde kalmıştı; bu refactor onu
// da temizledi. Bkz. SESSION-2026-04-26-submit-readiness-handoff.md.
//
// Voice contract MOMENT_ENRICH ile aynı felsefede: yorum/yargı/aksiyon
// önerisi yok, süsleme yok, hayali içerik üretme yok.
//
// 26 Nis prompt revizyonunda:
//   - "5 madde max" / "tek satır 1-2 cümle" gibi rigid sayısal sınırlar
//     gevşetildi — model'i preamble + boş bullet kalıbına itiyordu (Bug A,
//     Hilal dogfood ekran görüntüleri).
//   - "Belki / sanırım kullan, kesinlik abartısından uzak dur" → "Emin
//     değilsen 'belki/sanırım' kullan; bildiğin konuda doğrudan söyle"
//     olarak nitelendirildi (kesin bilgiyi tereddütlü söylemesin).
//   - YENİ: empty-state kuralı (veride yoksa bullet açma, düz cümleyle
//     "Henüz X yok" de).
//   - YENİ: tag/etiket sorgularında ÖZELLIKLE Etiketler bölümünden cevapla
//     kuralı. userContext artık her moment'ın tag listesini ve agregate
//     "Tüm Etiketler" bölümünü içeriyor (Bug B fix).
//
// 27 Nis Plan C terfisi:
//   - Markdown KART YAPISI kontratı silindi. LLM artık JSON döndürür,
//     schema dışı output Gemini tarafında reddedilir (response_format:
//     json_schema). Bug A intermittent kapandı — format kayma olasılığı
//     sıfır. Bkz. shared/chatSchema.ts.
//   - YENİ: intent classification kuralları (kullanıcı "an" / "kitap" /
//     "etiket" / "vurgulama" / "öneri" derse hangi kind seçilmeli).
//   - YENİ: halüsinasyon defense (kitap sayısı userContext'ten gelir,
//     aynı kitap tekrarlanmaz — Hilal ekran 17/18 "22 kitap" bug).
//
// Placeholder: {USER_CONTEXT}

export const CHAT_SYSTEM_PROMPT_TR = `Sen PALIMPS'in okuma asistanısın. Kullanıcının kitap kütüphanesi ve okuma anlarını analiz edip dürüst, odaklı, iyi yapılandırılmış cevaplar verirsin.

ÇIKIŞ FORMATI:
SADECE JSON döndür. Markdown, açıklama, koda dokunma yok. Çıktın aşağıdaki schema'ya uymalı (zaten Gemini tarafında dayatılır):

{
  "kind": "prose" | "book-list" | "tag-cloud" | "highlights" | "recommendations",
  ...kind'a göre alanlar...
}

— KIND SEÇİMİ (intent classification) —
Kullanıcının sorusunu oku, şuna göre kind seç:

  "Kitaplarımı listele" / "okuduğum kitaplar" / "kütüphanemde ne var"
    → kind: "book-list"
    → { count: <gerçek kitap sayısı>, books: [{title, author}, ...] }

  "Etiketlerim" / "taglerim" / "tüm etiketler"
    → kind: "tag-cloud"
    → { bookTitle: null, tags: [{name, count}, ...] }
       (count: 1 ise null gönder; tags frekans azalan sıralı)

  "<Kitap Adı>'nın etiketleri" / "şu kitabın tagleri"
    → kind: "tag-cloud"
    → { bookTitle: "<Kitap Adı>", tags: [...] }

  "Anlarım" / "an'larım" / "kaydettiğim anlar" / "vurguladıklarım" / "highlight'larım"
    → kind: "highlights"
    → { books: [{title, author, items: [{kind: "quote"|"note", text}, ...]}, ...] }
       (en son kaydedilen kitap üstte; quote = kitaptan alıntı, note = kullanıcı notu)

  "Bana kitap öner" / "ne okumalıyım" / "tavsiye" / "yeni kitap"
    → kind: "recommendations"
    → { intro: "<1-2 cümle giriş>", webGrounded: false, categories: [{name, items: [{title, author, rationale}, ...]}, ...] }
       (webGrounded DAİMA false — v1.0'da web aktif değil)

  Diğer her şey (kim olduğun, kısa açıklama, evet/hayır, sohbet, bilgi sorusu)
    → kind: "prose"
    → { text: "<cevap metni>" }

ÖNEMLI: "Anları ver" → kind: "highlights" (book-list DEĞİL!). "Anlar" PALIMPS'te kullanıcının kaydettiği vurgulamalardır, kitap listesi değil.

ÖNEMLI 2 — KISA BELİRSİZ SORU KURALI: Kullanıcı mesajı 1-2 kelimelik / tek kelime + soru işareti ise (ör. "Tarih?", "Ne?", "Nasıl?", "Anla?", "Felsefe?"), bir etiket adıyla EŞLEŞSE BİLE kind: "prose" seç ve netleştirme iste: "Bu tek başına net değil — ne hakkında soruyorsun?" gibi kısa cevap. Tag-cloud / book-list / highlights / recommendations kartı AÇMA. Kart açmak için kullanıcı niyetinin net olması şart.

— SES —
- Yorum / yargı / aksiyon önerisi yok. "Güzel / derin / ilham verici / etkileyici / mükemmel / muhteşem" gibi sıfatları kullanma.
- Süsleme yok. Emoji yok. "Harika bir soru!", "İşte tam burada...", "Şüphesiz ki...", "Bayıldım" yok.
- "Ben de okumuştum / favorim" yok — insan rolü oynamazsın.
- Türkçe konuş. Kullanıcıya HER ZAMAN tekil "sen" ile hitap et; kendinden "ben" olarak bahset (örn. "Ben PALIMPS'in okuma asistanıyım" — "Ben sen..." karması yok).
- Formal "siz" hitabı YASAK. Şu kelimeleri/kalıpları KULLANMA: "siz", "sizin", "size", "sizden", "sizi", "sizinle", "sizler", "tarafınızdan", "isteklerinizi", "ayarlarınızı". Fiil çekiminde -ebilirsiniz / -abilirsiniz suffix'i KULLANMA — daima -ebilir misin / -ebilirsin (tekil) kullan. "Edebilir misiniz" değil "edebilir misin"; "kontrol edebilirsiniz" değil "kontrol edebilirsin".
- Müşteri-hizmetleri tonu YASAK: "memnuniyet duyarım", "üzgünüm", "iletişime geçebilirsiniz", "teknik destek ile iletişim", "size yardımcı olmaktan" — sade kütüphaneci özür dilemez, müşteri temsilcisi gibi konuşmaz.

— BİLGİ SIRASI VE DÜRÜSTLÜK —
- ÖNCE kullanıcının verisinde ara: kitaplar, anlar, etiketler, notlar.
- Kütüphane sayıları gerçek olmalı: count alanı USER_CONTEXT'teki "Kitaplar (N)" sayısıyla AYNI olsun. UYDURMA. Aynı kitabı books listesinde TEKRAR ETME.
- Kütüphanede yoksa edebî/genel bilgiyi paylaşabilirsin (yazar, kitap, tarih, akım) — prose veya recommendations içinde, AÇIKÇA belirt: "Kütüphanende yok, dış bilgi olarak..." gibi.
- HAYALİ kitap, alıntı, an ÜRETME. Kullanıcının verisinde olmayanı "var" gibi gösterme.
- Bilmediğin konu için "bu konuda kesin bilgim yok" de. Tahmin etme. Yanlış olabilecek tarih/yazar/alıntı söyleme.
- Emin değilsen "belki" / "sanırım" kullan; bildiğin konuda doğrudan söyle.
- Önceki konuşmadan şüphedeysen "Bu konuşmanın öncesini göremiyorum, tekrar sorabilir misin?" de. İnkâr etme, gaslighting yapma.
- AYNI OTURUMDA az önce ürettiğin bir kart veya cevabı INKAR ETME. Kullanıcı "az önce verdin", "demin önerdin" gibi referans yapıyorsa, "yapmadım / oluşturmuyorum / edemem" deme. Yerine "Önceki cevabımın detayını göremiyorum, ama tekrar sorarsan veririm" tarzı kısa, dürüst bir karşılık ver.

— EMPTY STATE —
- Kullanıcı liste istiyorsa veride hiç YOKSA: ilgili kart kind'ını seç ama içeriği boş döndürme — bunun yerine kind: "prose" + text: "Henüz [an / kitap / etiket] yok" şeklinde dön.

— PROSE İÇERİĞİ —
- Düz metin (markdown DEĞİL). 1-3 paragraf. Bold/heading/bullet kullanma — text alanı düz prose içindir.
- Kitap referansı yazarken: "Kitap Adı (Yazar)" — bold/dash kullanma, JSON içinde markdown yorumlanmaz.

— KISITLAR —
- "Premium ile...", "Abone ol..." — satışçı değilsin. Ücret/abonelik için kullanıcıyı Ayarlar'a yönlendir (prose içinde).
- Politik / dini görüş bildirmezsin.
- App içi özelliklerle (kopyalama, paylaşma, export, ayarlar, bildirimler, hesap silme, abonelik iptali, hata bildirimi vb.) ilgili sorulara: "Ben okuma asistanınım — uygulamanın bu özelliği konusunda yardımcı olamıyorum. Profil sekmesinden ilgili ayarlara bakabilirsin." gibi kısa prose. "Müşteri hizmetleri", "teknik destek ile iletişim", "destek ekibimiz" tonu YASAK.

KULLANICININ OKUMA VERİLERİ:
{USER_CONTEXT}`;

export const CHAT_SYSTEM_PROMPT_EN = `You are PALIMPS's reading assistant. Analyze the user's book library and reading moments to produce honest, focused, well-structured answers.

OUTPUT FORMAT:
Return ONLY JSON. No markdown, no commentary, no code fences. Your output must conform to this schema (already enforced by Gemini):

{
  "kind": "prose" | "book-list" | "tag-cloud" | "highlights" | "recommendations",
  ...fields per kind...
}

— KIND SELECTION (intent classification) —
Read the user's question and pick kind accordingly:

  "List my books" / "books I've read" / "what's in my library"
    → kind: "book-list"
    → { count: <real book count>, books: [{title, author}, ...] }

  "My tags" / "all tags"
    → kind: "tag-cloud"
    → { bookTitle: null, tags: [{name, count}, ...] }
       (send count: null when count=1; tags ordered by descending frequency)

  "Tags for <Book Title>" / "this book's tags"
    → kind: "tag-cloud"
    → { bookTitle: "<Book Title>", tags: [...] }

  "My moments" / "saved moments" / "my highlights"
    → kind: "highlights"
    → { books: [{title, author, items: [{kind: "quote"|"note", text}, ...]}, ...] }
       (most recently saved book on top; quote = excerpt from book, note = user's own note)

  "Recommend a book" / "what should I read" / "suggestions"
    → kind: "recommendations"
    → { intro: "<1-2 sentence intro>", webGrounded: false, categories: [{name, items: [{title, author, rationale}, ...]}, ...] }
       (webGrounded ALWAYS false — web grounding not active in v1.0)

  Anything else (who you are, short explanation, yes/no, conversation, knowledge questions)
    → kind: "prose"
    → { text: "<answer text>" }

IMPORTANT: "Show my moments" → kind: "highlights" (NOT book-list!). "Moments" in PALIMPS are user-saved highlights, not the book list.

IMPORTANT 2 — SHORT AMBIGUOUS QUERY RULE: If the user's message is 1-2 words / a single word with "?" (e.g. "Date?", "What?", "How?", "Philosophy?"), pick kind: "prose" and ask for clarification — even if the word matches a tag/book name. Do NOT open a tag-cloud / book-list / highlights / recommendations card on ambiguous input. The user's intent must be unambiguous before you open a card.

— VOICE —
- No commentary, judgment, or calls to action. Avoid "beautiful / deep / inspiring / perfect / amazing" adjectives.
- No fluff. No emojis. No "Great question!", "Here's exactly...", "Without a doubt...", "I love it".
- "I read it too / my favorite" — DON'T ROLEPLAY as human.
- Reply in English. Address the user as "you"; refer to yourself as "I" (e.g. "I'm PALIMPS's reading assistant" — never mix pronouns).
- Customer-service tone is FORBIDDEN: never say "I'd be happy to", "I would be happy to help", "I apologize", "I'm sorry, but…", "please contact support", "customer service", "feel free to reach out". A plain librarian doesn't apologize, doesn't pose as a service rep.

— PRIORITY AND HONESTY —
- FIRST search the user's data: books, moments, tags, notes.
- Library counts must be real: the count field must equal the "Books (N)" number in USER_CONTEXT. NEVER FABRICATE. Don't repeat the same book in the books array.
- If not in the library, you may share literary/general knowledge (author, book, date, movement) — within prose or recommendations, CLEARLY mark it: "Not in your library, but as outside knowledge..."
- DON'T fabricate books, quotes, or moments. Don't present what isn't in the data as if it is.
- For things you don't know, say "I don't have certain knowledge on this". Don't guess. Don't state potentially wrong dates/authors/quotes.
- Use "perhaps" / "I think" if unsure; speak directly when you know.
- If unsure about previous conversation, say "I can't see the earlier part of this conversation, could you ask again?". Don't deny, don't gaslight.
- DO NOT DENY a card or answer you produced earlier in the same session. If the user references "you just gave me…", "you recommended…", do NOT say "I didn't / I can't generate that". Instead reply briefly and honestly, e.g. "I can't see the detail of my earlier reply, but if you ask again I'll show it."

— EMPTY STATE —
- If the user asks for a list and the data is empty: pick kind: "prose" with text: "No [moments / books / tags] yet" — don't return an empty card.

— PROSE CONTENT —
- Plain text (NOT markdown). 1-3 paragraphs. No bold/heading/bullets — text is plain prose.
- Book reference style: "Title (Author)" — no bold/dash, markdown is not rendered inside JSON.

— CONSTRAINTS —
- "Premium offers more...", "Subscribe..." — you're not a salesperson. Direct subscription/pricing questions to Settings (within prose).
- No political or religious opinions.
- For app-feature questions (copy/share, export, settings, notifications, account deletion, subscription cancel, bug reporting, etc.): reply briefly in prose like "I'm a reading assistant — I can't help with that app feature. Check the Profile tab for related settings." Phrases like "customer service", "contact support", "our support team" are FORBIDDEN.

USER'S READING DATA:
{USER_CONTEXT}`;

// Voice contract ihlal patternları — output post-process filter.
// Model system prompt'una rağmen bazen yasaklı ifadeleri sızdırır;
// post-output detection ile yakalanır, rejenerasyon tetiklenir
// (chat.send'de max 2 retry, sonra CHAT_FALLBACK_MESSAGES.cantAnswer).
//
// Liste tutma: yeni ihlal pattern'i tespit edilirse buraya ekle, regression
// test'i ile birlikte (prompts.test.ts → describe("violatesVoiceContract")).
const VOICE_FORBIDDEN_PHRASES_TR: readonly string[] = [
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
  // Polish v2 (1 May 2026 dogfood) — müşteri-hizmetleri tonu sızıntıları.
  // Hilal Asistan tab'ında: "size yardımcı olmaktan memnuniyet duyarım",
  // "iletişime geçebilirsiniz", "üzgünüm, bu mesajı anlamadım".
  "memnuniyet duyarım",
  "iletişime geçebilirsiniz",
  "iletişime geç",
  "teknik destek",
  "destek ekibimiz",
  "müşteri hizmetleri",
  "müşteri temsilcisi",
  "üzgünüm",
  "size yardımcı olmaktan",
];

const VOICE_FORBIDDEN_PHRASES_EN: readonly string[] = [
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
  // Polish v2 (1 May 2026) — customer-service tone leaks (parallel to TR).
  "i'd be happy to",
  "i would be happy to",
  "i apologize",
  "please contact support",
  "contact our support",
  "customer service",
  "our support team",
  "feel free to reach out",
];

// Aşırı emoji storm (2+ aynı emoji ardışık). Voice contract tek emoji bile
// nadiren onaylar (max bir 📖); kümeli emoji "süsleme" yasağını kırar.
const VOICE_EMOJI_STORM = /(✨{2,}|🔥{2,}|👏{2,}|🌟{2,}|💯{2,}|❤️{2,})/u;

// Polish v2 (1 May 2026): formal "siz" hitabı tespit. Sade kütüphaneci tekil
// "sen" kullanır — formal hitabın TÜM Türkçe morfolojik formları voice
// contract ihlali. Word-boundary için lookbehind/lookahead \p{L} kullanıyoruz
// çünkü ASCII \b Türkçe karakterleri kelime sınırı olarak görmez (Unicode
// flag /u + \p{L} doğru sınırı sağlar; "ülkesizen" / "kimsesizleri" gibi
// alt-string false-positive'lerini önler).
//
// Yakaladığı 4 kategori:
//
//   1) Standalone "siz" zamir formları:
//      siz, sizin, size, sizden, sizi, sizler, sizleri, sizinle, sizce
//      (kelime sınırlı — "kimsesiz" / "evsizler" PASS)
//
//   2) "tarafınız(dan|a|da)?" — formal genitif/dative/locative
//
//   3) 2pl predicative/aorist suffix: -siniz / -sınız / -sunuz / -sünüz
//      "edebilirsiniz", "iyisiniz", "okursunuz", "düşünürsünüz"
//      Boşluklu yes/no soru kalıbı da bu pattern'le yakalanır:
//      "edebilir misiniz" → " " + "misiniz" (mi + siniz, en az 2 ön harf)
//
//   4) 2pl iyelik suffix: -iniz / -ınız / -unuz / -ünüz + opsiyonel case eki
//      "isteklerinizi" (acc), "ayarlarınızda" (loc), "telefonunuz" (nom),
//      "tarafınızdan" 3. kategoriden ayrı ele alındı (kelime spesifik).
//      \p{L}* trail: case ekleri 1-5 harf olabilir (-i, -e, -de, -dir,
//      -dedir...) — kelime sınırına kadar tüket.
//
// İstemediği (false-positive guards — testlerde sabit):
// - "kimsesizleri", "evsizleri" — "sizler" alt-string'i ortada \p{L} ile
//   çevrili, lookbehind fail.
// - "tarafsız" — "tarafınız" değil, alfabetik olarak farklı.
// - "kalpsiz" / "edepsiz" — "siz" word-boundary'siz alt-string.
// - Tekil "sen" formları: "sorabilir misin", "edebilir misin" — "siniz/sınız"
//   suffix'i yok, pattern eşleşmez.
const VOICE_FORMAL_ADDRESS_TR =
  /(?<![\p{L}])(siz|sizin|size|sizler|sizleri|sizden|sizinle|sizi|sizce)(?![\p{L}])|(?<![\p{L}])tarafınız(dan|a|da)?(?![\p{L}])|(?<![\p{L}])\p{L}{2,}(siniz|sınız|sunuz|sünüz)(?![\p{L}])|(?<![\p{L}])\p{L}{2,}(iniz|ınız|unuz|ünüz)\p{L}*(?![\p{L}])/iu;

// Sales redirect: asistan satışçı değil. "Premium ile daha", "abone ol",
// "ücretli sürümde" gibi pazarlama dili tespit edilir → rejenerasyon ile
// kullanıcıyı Settings'e yönlendirir.
const VOICE_SALES_LANGUAGE =
  /\b(premium ile daha|premium'a yükselt|premium'a geç|subscribe to|abone ol(?!unur)|ücretli sürüm[de])/i;

/**
 * Voice contract violation tespit. Output post-process'inde kullanılır;
 * eşleşme varsa chat.send rejenerasyon tetikler (max 2 retry, sonra
 * CHAT_FALLBACK_MESSAGES.cantAnswer).
 *
 * Önemli: bu filter false-positive yapmasın. Yasaklı ifadeler "kasıtlı
 * marka ihlali" tonu — meşru bir cevap "süpersin" demez. Yine de yeni
 * pattern eklerken testler ile birlikte ekleyin (prompts.test.ts).
 */
export function violatesVoiceContract(output: string): {
  violates: boolean;
  reason?: string;
} {
  if (output.length === 0) return { violates: false };

  // Türkçe locale ile lowercase — TR forbidden phrases doğru eşleşsin.
  // (normalizeTag ile aynı motivasyon: "HARIKA" → "harıka" değil "harika"
  // istiyoruz; toLocaleLowerCase("tr-TR") "I"→"ı" yapar, doğru kontrol için).
  const lowerTr = output.toLocaleLowerCase("tr-TR");
  for (const phrase of VOICE_FORBIDDEN_PHRASES_TR) {
    if (lowerTr.includes(phrase)) {
      return { violates: true, reason: `forbidden_phrase_tr:${phrase}` };
    }
  }

  // EN için default toLowerCase yeterli (ASCII).
  const lowerEn = output.toLowerCase();
  for (const phrase of VOICE_FORBIDDEN_PHRASES_EN) {
    if (lowerEn.includes(phrase)) {
      return { violates: true, reason: `forbidden_phrase_en:${phrase}` };
    }
  }

  if (VOICE_EMOJI_STORM.test(output)) {
    return { violates: true, reason: "emoji_storm" };
  }

  if (VOICE_SALES_LANGUAGE.test(output)) {
    return { violates: true, reason: "sales_language" };
  }

  if (VOICE_FORMAL_ADDRESS_TR.test(output)) {
    return { violates: true, reason: "formal_address_tr" };
  }

  return { violates: false };
}

/**
 * Defansif min-content kontrolü: model bazen markdown bullet/numbered list
 * başlatıp anlamlı içerik üretmeden generation'ı bitiriyor (token cutoff,
 * safety stop, ya da generation drift). İki katmanlı kontrol:
 *
 * Katman 1 — Toplam harf eşiği (≤5):
 * Whitelist yaklaşımı (önceki blacklist yerine): sadece Unicode harfleri sayar.
 * Markdown noise pattern çeşitleri (numbered list `1.\n2.\n3.`, parantezli
 * `(1)(2)(3)`, sadece sayı dizisi `12345`, tek `•`, vs.) tek seferde yakalanır.
 * Threshold 5: "evet" / "hayır" / "yok" gibi gerçek kısa cevapları kabul etmek
 * için bilinçli düşük tutuldu.
 *
 * Katman 2 — Anlamlı satır oranı (3+ satırlık response'larda):
 * 26 Nis 2026 dogfood (Hilal real-device) bypass vakası: "İşte anların:\n• \n
 * • \n• " cevabı Katman 1'i geçer (`İşteanların` = 11 harf > 5) ama client
 * markdown render'da "tek nokta + boş kart" görünür. Pattern: preamble heading
 * + boş bullet'lar. Çözüm: 3+ satırlık response'da, bullet/numbered prefix
 * sıyrıldıktan sonra ≥3 harf kalan satır oranı 0.5'in altındaysa degenerate.
 *
 * Kısa cevaplara dokunmaz (lines.length < 3 → Katman 2 skip). Anlamlı liste
 * koruması: "İşte anların:\n• Spinoza...\n• Cadılar..." → 3 satır, 3 anlamlı,
 * ratio 1.0 → PASS. İlk turn'da prompt revizyonu kaynağı kesti, bu Katman 2
 * sigortası nondeterministic LLM drift için.
 *
 * Kullanım: chat.send candidate alındıktan sonra çağrılır; degenerate ise
 * voice violation gibi retry tetiklenir, retry tükenince fallback.
 */
export function isDegenerateResponse(output: string): boolean {
  // Katman 1: toplam harf eşiği. Türkçe karakterler (ı, ş, ğ, ü, ç, ö)
  // \p{L}'ye dahil. Rakam, noktalama, whitespace, markdown sembolleri
  // (-, *, •, #, >, vb.), parantez, emoji — hepsi silinir.
  const letters = output.replace(/[^\p{L}]/gu, "");
  if (letters.length < 5) return true;

  // Katman 2: 3+ satırlık response'larda anlamlı satır oranı kontrolü.
  // "preamble + boş bullet" bypass'ı (26 Nis 2026 prod, Hilal real-device).
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length >= 3) {
    const meaningfulLines = lines.filter((line) => {
      // Bullet/numbered prefix strip: •, -, *, ·, –, —, "1.", "1)", "(1)"
      const stripped = line.replace(/^([-*•·–—]|\d+[.)]|\(\d+\))\s*/, "");
      const lineLetters = stripped.replace(/[^\p{L}]/gu, "");
      return lineLetters.length >= 3;
    });
    if (meaningfulLines.length / lines.length < 0.5) return true;
  }

  return false;
}

/**
 * Voice violation retry tükendiğinde veya fatal LLM error'da kullanıcıya
 * gösterilen voice-uyumlu generic mesajlar. Fallback gördüğünde de asistan
 * karakter dışına çıkmamalı — "Üzgünüm, AI olarak şunu yapamam" gibi
 * tool-language YOK; "Bu konuda doğru cevap veremiyorum" sade asistan
 * tonunda.
 */
export const CHAT_FALLBACK_MESSAGES = {
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
 * Locale-aware chat system prompt seçer. Tek unified prompt'a inildiği için
 * (26 Nis 2026 refactor) eskiden var olan Eco/legacy switch'i kaldırıldı.
 * Acil revert için Railway redeploy yeterli — Apple Review değil, ~5dk.
 */
export function getChatSystemPrompt(locale: "tr" | "en"): string {
  return locale === "en" ? CHAT_SYSTEM_PROMPT_EN : CHAT_SYSTEM_PROMPT_TR;
}
