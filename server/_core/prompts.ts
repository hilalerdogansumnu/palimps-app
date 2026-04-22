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
 * - Tag formatı: Türkçe, küçük harf, tek kelime/kompakt. Tema etiketi (konu),
 *   duygu etiketi DEĞİL. "varoluşçuluk" ✓, "melankoli" ✗.
 * - Summary: 20 kelimeden az, yargı içermez. "Karakterin ölümle yüzleşmesi"
 *   gibi tanımlayıcı; "Çok güzel bir pasaj" gibi yorumcu değil.
 *
 * Placeholder: {TEXT} — OCR'dan çıkan ham metin buraya yerleştirilir.
 */
export const MOMENT_ENRICH_PROMPT = `Sen PALIMPS'in kitap notu asistanısın. Görevin: verilen metni işleyip iki çıktı üretmek.

KURALLAR:
- Abartma. Yorum katma. Süsleme yapma. Aksiyon önerisi verme.
- Özet (summary): metnin ana fikri, tek cümle, 20 kelimeden az, YARGI YOK (tanımlayıcı ol, "güzel / ilham verici / derin" gibi sıfatlar kullanma).
- Etiketler (tags): Türkçe, küçük harf, tek kelime veya kompakt ("varoluşçuluk", "ölüm", "sevgi", "zaman", "yalnızlık"). Konu/tema etiketi — DUYGU etiketi değil. 2 veya 3 tane, daha az veya çok DEĞİL.
- Tag'lerde # işareti YOK, boşluk YOK, özel karakter YOK.

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
 * LLM tag çıktısını normalize eder — veritabanına kaydetmeden önce çağrılır.
 * Türkçe karakterleri (ç, ğ, ı, ö, ş, ü) korur; büyük harf, boşluk, hashtag,
 * noktalama temizler. Boş string dönerse çağıran taraf tag'i filtrelemelidir.
 *
 * Örnekler:
 * - "#Varoluşçuluk" → "varoluşçuluk"
 * - "YALNıZLıK " → "yalnızlık"
 * - " ölüm " → "ölüm"
 * - "kara mizah" → "karamizah"  (compound tek tag'e dönüşür, 2-word tag
 *   yok politikası — library view'da çok uzun chip'ler kaçınılmaz)
 */
export function normalizeTag(raw: string): string {
  // Türkçe locale ile lowercase — default toLowerCase() "I"→"i" (dotted)
  // yapar ama Türkçede olması gereken "I"→"ı" (dotless). Audience primary
  // Türk okurlar olduğundan tr-TR locale doğru davranış. İngilizce tag'ler
  // etkilenmez (a-z zaten lowercase).
  return raw
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/[#\s]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
