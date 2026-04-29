/**
 * Chat asistan cevabının structured schema'sı (Plan C — JSON mode).
 *
 * Tek kaynak gerçeği:
 *  - Server: Gemini'ye `response_format: json_schema` ile dayatılır
 *    (server/routers.ts chat.send handler).
 *  - Client: AssistantMessage component'i bu type'ları doğrudan render eder
 *    (components/assistant-message/index.tsx).
 *
 * Plan B (markdown contract + client-side parse) 27 Nis 2026 dogfood'da
 * %35-40 miss-rate verdi: LLM `# KART_BAŞLIĞI` heading sentaksını ihmal edip
 * `**KART_BAŞLIĞI**` veya çıplak CAPS üretiyordu → parse miss → prose
 * fallback. Plan C'de Gemini schema'ya uymak ZORUNDA, format kayma olasılığı
 * sıfır. Bkz. SESSION-2026-04-26-submit-readiness-handoff.md.
 *
 * Geriye uyumluluk: payload type isimleri parse.ts (Plan B) ile aynı,
 * tek değişiklik `book-list.items` → `book-list.books` (highlights'ta da
 * `books` field'ı var, naming tutarlı).
 */

import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────────
// Ortak alt-şemalar
// ──────────────────────────────────────────────────────────────────────────

const bookRefSchema = z.object({
  title: z.string().min(1),
  author: z.string().nullable(),
});

const highlightItemSchema = z.object({
  kind: z.enum(["quote", "note"]),
  text: z.string().min(1),
});

const recommendationItemSchema = z.object({
  title: z.string().min(1),
  author: z.string().nullable(),
  rationale: z.string(), // boş olabilir, model bazen rationale vermeyebilir
});

// ──────────────────────────────────────────────────────────────────────────
// Kart-başına şemalar (discriminator: kind)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Kısa konuşma cevabı — "Sen kimsin?", "Spinoza'yı kim yazdı?" gibi.
 * Markdown DEĞİL, düz metin (NL paragraflara izinli ama kart yapısı yok).
 */
const proseSchema = z.object({
  kind: z.literal("prose"),
  text: z.string().min(1),
});

/**
 * Kullanıcının kütüphanesindeki kitapların listesi.
 * "Okuduğum kitapları listele" preset'i için.
 */
const bookListSchema = z.object({
  kind: z.literal("book-list"),
  count: z.number().int().nonnegative(),
  books: z.array(bookRefSchema),
});

/**
 * Etiket bulutu — ya tüm etiketler (bookTitle: null) ya tek kitabın
 * etiketleri (bookTitle: string). Tags frekans desc sıralı gelmeli;
 * count: 1 ise null gönderilir (UI'da rakam gösterilmez).
 */
const tagCloudSchema = z.object({
  kind: z.literal("tag-cloud"),
  bookTitle: z.string().nullable(),
  tags: z.array(
    z.object({
      name: z.string().min(1),
      count: z.number().int().positive().nullable(),
    }),
  ),
});

/**
 * Kullanıcının vurguladığı pasajlar + notları, kitap-bazlı gruplanmış.
 * Her item ya bir alıntı (kind: quote) ya kullanıcı notu (kind: note).
 * Sıralama: en son kaydedilen kitap üstte (chat handler `getReadingMomentsByBook`
 * çıktısı zaten createdAt desc).
 */
const highlightsSchema = z.object({
  kind: z.literal("highlights"),
  books: z.array(
    z.object({
      title: z.string().min(1),
      author: z.string().nullable(),
      items: z.array(highlightItemSchema),
    }),
  ),
});

/**
 * Kategorize kitap önerileri.
 * - intro: kategorilerden önce 1-2 cümle giriş metni.
 * - webGrounded: cevap web aramasından mı geldi. v1.0'da DAİMA false (Gemini
 *   grounding tool aktif değil); v1.1'de aktif olunca true dönebilir, UI'da
 *   "İNTERNETTEN" badge çıkar (tasarım sistemi hazır).
 * - categories: her kategoride 2-4 kitap öneri tipik.
 */
const recommendationsSchema = z.object({
  kind: z.literal("recommendations"),
  intro: z.string(),
  webGrounded: z.boolean(),
  categories: z.array(
    z.object({
      name: z.string().min(1),
      items: z.array(recommendationItemSchema),
    }),
  ),
});

// ──────────────────────────────────────────────────────────────────────────
// Discriminated union — tek tip, kind ile dallanır
// ──────────────────────────────────────────────────────────────────────────

export const assistantResponseSchema = z.discriminatedUnion("kind", [
  proseSchema,
  bookListSchema,
  tagCloudSchema,
  highlightsSchema,
  recommendationsSchema,
]);

export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
export type AssistantKind = AssistantResponse["kind"];

// Spesifik kart payload'ları için type alias'ları — component prop'larında
// "type narrow" almak için kullanılır.
export type ProseResponse = z.infer<typeof proseSchema>;
export type BookListResponse = z.infer<typeof bookListSchema>;
export type TagCloudResponse = z.infer<typeof tagCloudSchema>;
export type HighlightsResponse = z.infer<typeof highlightsSchema>;
export type RecommendationsResponse = z.infer<typeof recommendationsSchema>;

// ──────────────────────────────────────────────────────────────────────────
// Gemini OpenAPI-subset JSON Schema (response_format: json_schema)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Gemini OpenAI-compatible endpoint'in `response_format: json_schema` opsiyonu
 * OpenAPI 3.0 subset'ini bekler. `oneOf` desteği tutarsız olduğu için flat
 * yapı kullanıyoruz: `kind` discriminator + tüm alanlar opsiyonel + server
 * tarafında Zod ile validate. Schema dışı output zaten Gemini tarafında
 * reddedilir, Zod sadece "her field var mı" kontrolü yapar.
 *
 * Alternatif olarak zod-to-json-schema package'ı eklenebilir, ama bu schema
 * yıllık 1-2 kez değişir, manuel tutması kolay.
 */
export const assistantResponseJsonSchema = {
  type: "object",
  required: ["kind"],
  properties: {
    kind: {
      type: "string",
      enum: ["prose", "book-list", "tag-cloud", "highlights", "recommendations"],
      description:
        "Cevap tipi. 'prose' kısa konuşma cevabı; diğerleri yapısal kart. " +
        "Kullanıcının sorusu ve kütüphanedeki veriye göre seç.",
    },
    // ────────── prose ──────────
    text: {
      type: "string",
      description:
        "kind='prose' için cevap metni. Düz metin (markdown DEĞİL), 1-3 " +
        "paragraf. Kart layout uygun değilse buraya yaz.",
    },
    // ────────── book-list ──────────
    count: {
      type: "integer",
      description:
        "kind='book-list' için kullanıcının kütüphane kitap sayısı (gerçek " +
        "veriden, halüsinasyon yapma).",
    },
    // ────────── tag-cloud ──────────
    bookTitle: {
      type: "string",
      nullable: true,
      description:
        "kind='tag-cloud' için: tek kitap etiketi soruluyorsa kitap adı; " +
        "tüm etiketler soruluyorsa null.",
    },
    tags: {
      type: "array",
      description:
        "kind='tag-cloud' için etiket listesi, frekans azalan sıralı. " +
        "Her etiket {name, count}; count 1 ise null gönder.",
      items: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          count: { type: "integer", nullable: true },
        },
      },
    },
    // ────────── highlights ──────────
    // (book-list ve highlights ikisi de "books" array kullanır — kind ile ayrılır)
    books: {
      type: "array",
      description:
        "kind='book-list' için: {title, author} listesi (en son okunan üstte). " +
        "kind='highlights' için: {title, author, items: [{kind: quote|note, text}]} " +
        "kitap-bazlı vurgu grupları (createdAt desc).",
      items: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          author: { type: "string", nullable: true },
          items: {
            type: "array",
            description:
              "highlights kartında: bu kitabın alıntıları + kullanıcı notları.",
            items: {
              type: "object",
              required: ["kind", "text"],
              properties: {
                kind: { type: "string", enum: ["quote", "note"] },
                text: { type: "string" },
              },
            },
          },
        },
      },
    },
    // ────────── recommendations ──────────
    intro: {
      type: "string",
      description:
        "kind='recommendations' için: kategorilerden önce 1-2 cümle giriş.",
    },
    webGrounded: {
      type: "boolean",
      description:
        "kind='recommendations' için: v1.0'da DAİMA false. Web grounding " +
        "tool aktif değil; modelin training data'sından geliyor.",
    },
    categories: {
      type: "array",
      description:
        "kind='recommendations' için: kategorize öneri listesi. Her kategori " +
        "{name, items: [{title, author, rationale}]}.",
      items: {
        type: "object",
        required: ["name", "items"],
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["title", "rationale"],
              properties: {
                title: { type: "string" },
                author: { type: "string", nullable: true },
                rationale: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Bozuk JSON / schema-dışı output / boş response için fallback.
 * AssistantMessage.prose path'i bunu render eder (kullanıcı boş kart görmez).
 */
export const buildProseFallback = (text: string): ProseResponse => ({
  kind: "prose",
  text,
});

/**
 * Server'da invokeLLM'den dönen ham JSON string'i parse eder.
 * Bozuk JSON veya Zod fail → null döner, caller fallback'e geçer.
 */
export function parseAssistantJson(raw: string): AssistantResponse | null {
  try {
    const obj = JSON.parse(raw);
    const result = assistantResponseSchema.safeParse(obj);
    if (result.success) return result.data;
    return null;
  } catch {
    return null;
  }
}
