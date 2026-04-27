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
 * Bağımlılık disiplini: bu modül DB modülü import etmiyor — minimum yapı
 * type'lar ile çalışıyor. Test'lerde mock kolay, runtime'da Drizzle row'ları
 * doğal duck-type olarak uyuyor.
 */

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
      return `
[${s.bookTag}: ${book?.title || s.unknownBook}]
${s.ocrLabel}: ${m.ocrText || s.none}
${s.noteLabel}: ${m.userNote || s.none}${tagLine}
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
