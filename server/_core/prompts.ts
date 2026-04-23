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
