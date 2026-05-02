/**
 * Chat USER_CONTEXT builder — kullanıcının kitap kütüphanesini ve okuma
 * anlarını sistem prompt'una gömülecek serbest formatlı text bloğuna
 * dönüştürür.
 *
 * Tarihçe: 26 Nis 2026'a kadar bu builder routers.ts'te chat.send mutation'ı
 * içinde inline template literal olarak duruyordu. Bug B (kullanıcı "tag"
 * istiyor, sistem moment OCR text'leri dönüyor) root cause'u: context'te
 * tag verisi hiç gömülmüyordu, prompt ise "tag'ler verinde" varsayıyordu.
 * Refactor:
 *   - Helper'a çıkarıldı (test-edilebilir).
 *   - Her moment'ın `tags` listesi artık kendi satırında gömülüyor.
 *   - Tüm benzersiz tag'lerin frekans-sıralı agregate listesi context'in
 *     sonuna eklendi ("Tüm Etiketler: ..."), model "hangi tag'ler var?"
 *     sorusuna moment-by-moment tarama yapmadan kestirme cevap verebilsin.
 *
 * 2 May 2026 (Bug #4 fix): markings'in iki branch'i (`highlights` = altı
 * çizili / fosforlu METİN parçaları, `marginalia` = el yazısı kenar notları)
 * artık her moment satırında gömülüyor. Önceki versiyonda tip darlandırması
 * eksikti → DB'den gelen kolonlar buradan geçerken silinmiş oluyordu, model
 * elinde "vurguladıklarım = quote" üretmek için kaynak yoktu (sadece
 * userNote vardı), dolayısıyla "Vurguladıklarımı getir" sorusuna SENİN NOTUN
 * kartlarını döndürüyordu. Fix: type'a HighlightEntry[]/MarginaliaEntry[]
 * field'ları ekle, render block'ları ekle. Boş array veya null → satır
 * yazılmaz (boş bullet sinyali yok).
 *
 * Bağımlılık disiplini: bu modül DB modülü import etmiyor — minimum yapı
 * type'lar ile çalışıyor. Test'lerde mock kolay, runtime'da Drizzle row'ları
 * doğal duck-type olarak uyuyor. HighlightEntry/MarginaliaEntry shape'leri
 * prompts.ts'ten geliyor (tek kaynak gerçeği — schema.ts ile birebir aynı
 * runtime tip).
 */

import type { HighlightEntry, MarginaliaEntry } from "./prompts";

type Locale = "tr" | "en";

type BookForContext = {
  id: number;
  title: string;
  author?: string | null;
};

type MomentForContext = {
  id: number;
  bookId: number;
  ocrText?: string | null;
  userNote?: string | null;
  tags?: unknown; // Drizzle JSON kolonu — runtime'da Array.isArray ile kontrol
  highlights?: HighlightEntry[] | null | unknown; // null = henüz extraction yok
  marginalia?: MarginaliaEntry[] | null | unknown;
  createdAt: string | Date;
};

const STRINGS = {
  tr: {
    header: "Kullanıcının Okuma Verileri",
    booksLabel: "Kitaplar",
    momentsLabel: "Okuma Anları",
    tagsLabel: "Etiketler",
    allTagsLabel: "Tüm Etiketler",
    countSuffix: " adet",
    bookTag: "Kitap",
    ocrLabel: "OCR Metni",
    noteLabel: "Kullanıcı Notu",
    highlightsLabel: "Vurguladıkların",
    marginaliaLabel: "Kenar Notların",
    dateLabel: "Tarih",
    unknownBook: "Bilinmeyen",
    none: "Yok",
  },
  en: {
    header: "User's Reading Data",
    booksLabel: "Books",
    momentsLabel: "Reading Moments",
    tagsLabel: "Tags",
    allTagsLabel: "All Tags",
    countSuffix: "",
    bookTag: "Book",
    ocrLabel: "OCR Text",
    noteLabel: "Note",
    highlightsLabel: "Highlights",
    marginaliaLabel: "Margin Notes",
    dateLabel: "Date",
    unknownBook: "Unknown",
    none: "None",
  },
} as const;

/**
 * `tags` JSON kolonundan güvenli string[] çıkarır. null/undefined/non-array
 * input'ta boş array döner; non-string item'ları siler. Drizzle'ın JSON
 * kolonları için runtime defense — schema TypeScript düzeyinde garanti
 * vermiyor, prod'da tek bir bozuk satır context'i kırmasın.
 */
function extractTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string" && t.length > 0);
}

/**
 * `highlights` JSON kolonundan güvenli string[] çıkarır — sadece `text` field.
 * Schema-level shape: { text, kind: "highlighter" | "underline" }; chat
 * context için kind ayrımı (fosforlu vs altı çizili) faydasız, sadece metni
 * okuyoruz. null/non-array/bozuk entry savunması extractTags ile aynı motif.
 */
function extractHighlightTexts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h) => {
      if (h && typeof h === "object" && "text" in h) {
        const t = (h as { text: unknown }).text;
        return typeof t === "string" ? t : "";
      }
      return "";
    })
    .filter((t) => t.length > 0);
}

/**
 * `marginalia` JSON kolonundan güvenli string[] çıkarır — sadece `text`.
 * Shape: { text }. Sıralama yukarıdan aşağıya (DB'den geldiği gibi).
 */
function extractMarginaliaTexts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => {
      if (m && typeof m === "object" && "text" in m) {
        const t = (m as { text: unknown }).text;
        return typeof t === "string" ? t : "";
      }
      return "";
    })
    .filter((t) => t.length > 0);
}

/**
 * Kullanıcının okuma verisini chat sistem prompt'una gömülmek üzere
 * formatlar. Output, CHAT_SYSTEM_PROMPT_TR/EN'in `{USER_CONTEXT}`
 * placeholder'ına `.replace(...)` ile yerleştirilir.
 *
 * Format kararları:
 *   - Moment listesi son 50 ile sınırlı (eski davranış korundu) — token
 *     bütçesi disiplini, en yeni anlar daha bağlamsal.
 *   - Tags satırı sadece doluysa render edilir; boşsa satır hiç yazılmaz
 *     (model'e "boş bullet" sinyali vermemek için, Bug A felsefesiyle).
 *   - "Tüm Etiketler" agregate listesi frekans sırasında ("tag (count)").
 *     Boşsa bütün satır atlanır.
 */
export function buildChatUserContext(
  books: BookForContext[],
  moments: MomentForContext[],
  locale: Locale,
): string {
  const s = STRINGS[locale];

  const booksList = books
    .map((b) => `- "${b.title}" ${b.author ? `by ${b.author}` : ""}`)
    .join("\n");

  const momentsList = moments
    .slice(0, 50)
    .map((m) => {
      const book = books.find((b) => b.id === m.bookId);
      const tags = extractTags(m.tags);
      const tagLine =
        tags.length > 0 ? `\n${s.tagsLabel}: ${tags.join(", ")}` : "";
      // Bug #4 fix (2 May 2026): markings'in iki branch'i context'e ekleniyor.
      // Boş array veya null → satır hiç render edilmez (model'e "boş bullet"
      // sinyali verme — Bug A felsefesi). Indent (2 boşluk) deliberately
      // tutuldu: model multi-item listesini ayrı entry olarak görsün, sadece
      // tek satır blob değil.
      const highlightTexts = extractHighlightTexts(m.highlights);
      const highlightsLine =
        highlightTexts.length > 0
          ? `\n${s.highlightsLabel}:\n${highlightTexts.map((h) => `  - "${h}"`).join("\n")}`
          : "";
      const marginaliaTexts = extractMarginaliaTexts(m.marginalia);
      const marginaliaLine =
        marginaliaTexts.length > 0
          ? `\n${s.marginaliaLabel}:\n${marginaliaTexts.map((mg) => `  - "${mg}"`).join("\n")}`
          : "";
      return `
[${s.bookTag}: ${book?.title || s.unknownBook}]
${s.ocrLabel}: ${m.ocrText || s.none}
${s.noteLabel}: ${m.userNote || s.none}${tagLine}${highlightsLine}${marginaliaLine}
${s.dateLabel}: ${m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt}
`;
    })
    .join("\n---\n");

  // Agregate tüm tag'ler — frekans sıralı, model hızlı erişim için.
  const tagFrequency = new Map<string, number>();
  for (const m of moments) {
    for (const t of extractTags(m.tags)) {
      tagFrequency.set(t, (tagFrequency.get(t) ?? 0) + 1);
    }
  }
  const sortedTags = [...tagFrequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t, c]) => `${t} (${c})`);
  const allTagsSection =
    sortedTags.length > 0
      ? `\n\n${s.allTagsLabel} (${sortedTags.length}${s.countSuffix}): ${sortedTags.join(", ")}`
      : "";

  return `
${s.header}:

${s.booksLabel} (${books.length}${s.countSuffix}):
${booksList}

${s.momentsLabel} (${moments.length}${s.countSuffix}):
${momentsList}${allTagsSection}
`;
}
