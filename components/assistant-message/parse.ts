/**
 * Asistan cevabını markdown-from-LLM'den structured kart payload'ına çevirir.
 * Server prompt'unda "— KART YAPISI —" bölümü ile LLM'e format kontratı
 * dayatılır (CHAT_SYSTEM_PROMPT_TR/EN, 26 Nis 2026 refactor sonrası); bu
 * dosya client-side detection katmanıdır.
 *
 * Yaklaşım B (markdown contract):
 * - LLM markdown string döndürür
 * - Client'ta ilk satırın `# KART_BAŞLIĞI` pattern'ine bak → kind tespit
 * - Pattern eşleşmezse fallback "prose" → düz Markdown render
 *
 * C'ye geçişte (structured JSON server response): bu dosya `parseAssistantContent`
 * fonksiyonunu input olarak `string | StructuredResponse` alır şeklinde
 * genişletilir; component layer'da hiçbir değişiklik gerekmez.
 */

export type AssistantKind =
  | "prose"
  | "book-list"
  | "tag-cloud"
  | "highlights"
  | "recommendations";

export type ProsePayload = {
  text: string;
};

export type BookListPayload = {
  count: number;
  items: Array<{ title: string; author: string | null }>;
};

export type TagCloudPayload = {
  bookTitle: string | null; // null → tüm etiketler; string → tek kitabın etiketleri
  tags: Array<{ name: string; count: number | null }>;
};

export type HighlightsPayload = {
  books: Array<{
    title: string;
    author: string | null;
    items: Array<{ kind: "quote" | "note"; text: string }>;
  }>;
};

export type RecommendationsPayload = {
  intro: string;
  webGrounded: boolean; // v1.0'da daima false; v1.1 Gemini grounding eklenince true olur
  categories: Array<{
    name: string;
    items: Array<{ title: string; author: string | null; rationale: string }>;
  }>;
};

export type ParsedAssistantContent =
  | { kind: "prose"; payload: ProsePayload }
  | { kind: "book-list"; payload: BookListPayload }
  | { kind: "tag-cloud"; payload: TagCloudPayload }
  | { kind: "highlights"; payload: HighlightsPayload }
  | { kind: "recommendations"; payload: RecommendationsPayload };

/**
 * Ana giriş noktası. Markdown string'ini structured payload'a çevirir.
 * LLM format kontratını ihlal ederse fallback prose'a düşer.
 */
export function parseAssistantContent(content: string): ParsedAssistantContent {
  const trimmed = content.trim();
  if (!trimmed) {
    return { kind: "prose", payload: { text: content } };
  }

  const kind = detectKind(trimmed);

  try {
    switch (kind) {
      case "book-list":
        return { kind, payload: parseBookList(trimmed) };
      case "tag-cloud":
        return { kind, payload: parseTagCloud(trimmed) };
      case "highlights":
        return { kind, payload: parseHighlights(trimmed) };
      case "recommendations":
        return { kind, payload: parseRecommendations(trimmed) };
      case "prose":
      default:
        return { kind: "prose", payload: { text: content } };
    }
  } catch {
    // Parse fail → fallback prose, kullanıcı en azından raw markdown görür.
    return { kind: "prose", payload: { text: content } };
  }
}

/**
 * İlk satırdaki # başlığına bakarak kart tipini tespit et.
 * # yoksa veya başlık tanınan kalıba uymuyorsa → prose.
 */
export function detectKind(content: string): AssistantKind {
  const firstLine = content.split("\n")[0]?.trim() ?? "";
  if (!firstLine.startsWith("#")) return "prose";

  // # veya ## prefix'i + opsiyonel space'ten sonraki başlığı al
  const heading = firstLine.replace(/^#+\s*/, "").toUpperCase();
  if (!heading) return "prose";

  // Kitap: "KÜTÜPHANE", "KİTAP", "LIBRARY", "BOOKS"
  if (/KÜTÜPHANE|KITAPLAR|KİTAP|LIBRARY|BOOKS/i.test(heading)) return "book-list";
  // Etiket: "ETİKET", "TAG"
  if (/ETİKET|TAG/i.test(heading)) return "tag-cloud";
  // Vurgulama: "VURGULA", "HIGHLIGHT"
  if (/VURGULA|HIGHLIGHT/i.test(heading)) return "highlights";
  // Öneri: "ÖNERİ", "RECOMMEND"
  if (/ÖNERİ|RECOMMEND/i.test(heading)) return "recommendations";

  // # var ama tanınan kalıp değil → fallback prose (raw markdown render)
  return "prose";
}

// ──────────────────────────────────────────────────────────────────────────
// Kart-spesifik parser'lar
// ──────────────────────────────────────────────────────────────────────────

/**
 * Format kontratı:
 *   # KÜTÜPHANENDE 3 KİTAP
 *   - **Spinoza'nın Sevinci** — Çetin Balanuye
 *   - **Bugünün Cadıları** — Mona Chollet
 *
 * Başlıktan count çıkar; bullet'lardan title + author. "**" boldları strip et.
 */
function parseBookList(content: string): BookListPayload {
  const lines = content.split("\n");
  const headingLine = lines[0]?.trim() ?? "";
  const countMatch = headingLine.match(/(\d+)/);
  const headingCount = countMatch ? parseInt(countMatch[1], 10) : 0;

  const items: BookListPayload["items"] = [];
  for (const line of lines.slice(1)) {
    const bullet = line.trim().match(/^[-*•]\s+(.+)$/);
    if (!bullet) continue;
    const inner = bullet[1];
    // "**Title** — Author" veya "**Title** — Author Name" veya sadece "Title"
    const titleAuthor = inner.match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
    if (titleAuthor) {
      items.push({ title: titleAuthor[1].trim(), author: titleAuthor[2].trim() });
      continue;
    }
    // Bold yoksa düz metin: "Title — Author"
    const plain = inner.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    if (plain) {
      items.push({ title: plain[1].trim(), author: plain[2].trim() });
      continue;
    }
    // Sadece title (yazar bilinmiyor)
    items.push({ title: inner.replace(/\*\*/g, "").trim(), author: null });
  }

  return { count: headingCount || items.length, items };
}

/**
 * Format kontratı:
 *   # TÜM ETİKETLERİN
 *   felsefe, spinoza (3), yapay-zeka (2), yaşlanma, ...
 *
 * Veya:
 *   # "Bugünün Cadıları" ETİKETLERİ
 *   ataerkil-sistem, kadın-hakları, içselleştirme, ...
 *
 * Başlıktan kitap adı çıkar (varsa); body'den virgüllü tag listesi.
 */
function parseTagCloud(content: string): TagCloudPayload {
  const lines = content.split("\n");
  const headingLine = lines[0]?.trim() ?? "";

  // Kitap-spesifik tag başlığı: ÇİFT tırnak (düz/kıvrık) içindeki kitap adını
  // yakala. Apostrof izin verilir kitap adı içinde ("Today's Witches", "Hilal'in
  // Kitabı"). Tek tırnak ile başlık zarfı kullanılmaz — Gemini default davranışı.
  // "# "Bugünün Cadıları" ETİKETLERİ" → bookTitle="Bugünün Cadıları"
  // "# TÜM ETİKETLERİN" → tırnak yok → null
  // "# TAGS FOR "Today's Witches"" → bookTitle="Today's Witches"
  const QUOTE_OPEN = /["""]/;
  const QUOTE_CLOSE = /["""]/;
  const quotedTr = headingLine.match(
    new RegExp(`^#+\\s*${QUOTE_OPEN.source}\\s*(.+?)\\s*${QUOTE_CLOSE.source}\\s+ETİKET`, "i"),
  );
  const quotedEn = headingLine.match(
    new RegExp(`TAGS\\s+FOR\\s+${QUOTE_OPEN.source}\\s*(.+?)\\s*${QUOTE_CLOSE.source}`, "i"),
  );
  const bookTitle = quotedTr ? quotedTr[1].trim() : quotedEn ? quotedEn[1].trim() : null;

  // Body: virgülle ayrılmış tag'ler. Çok satırlı olabilir, hepsini birleştir.
  const body = lines.slice(1).join(" ").trim();
  // Bullet stiliyle de gelebilir: "- felsefe (3)\n- spinoza" — onu da parse et.
  const tags: TagCloudPayload["tags"] = [];

  // Bullet stilinde mi geldi?
  const bulletLines = lines
    .slice(1)
    .map((l) => l.trim().match(/^[-*•]\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m);

  if (bulletLines.length > 0) {
    for (const m of bulletLines) {
      const tag = parseTagToken(m[1]);
      if (tag) tags.push(tag);
    }
  } else {
    // Virgülle ayrılmış stil
    for (const token of body.split(/[,;]/)) {
      const tag = parseTagToken(token.trim());
      if (tag) tags.push(tag);
    }
  }

  return { bookTitle, tags };
}

function parseTagToken(token: string): { name: string; count: number | null } | null {
  if (!token) return null;
  // "felsefe (3)" veya "felsefe"
  const m = token.match(/^(.+?)(?:\s*\((\d+)\))?\s*$/);
  if (!m) return null;
  const name = m[1].trim().replace(/^\*+|\*+$/g, "").replace(/^["']|["']$/g, "");
  if (!name) return null;
  const count = m[2] ? parseInt(m[2], 10) : null;
  return { name, count };
}

/**
 * Format kontratı:
 *   # VURGULADIKLARIN
 *   ## **Spinoza'nın Sevinci** — Çetin Balanuye
 *   > "Spinoza çok büyük bir işe kalkışan..."
 *   > "Varsayımı insanlığın şehri gibidir."
 *   > [SENİN NOTUN] Varsayım ve aşkınlık
 *   ## **Bugünün Cadıları** — Mona Chollet
 *   > "Kadınların yenilmez gücü..."
 */
function parseHighlights(content: string): HighlightsPayload {
  const lines = content.split("\n");
  // İlk # başlığını atla (ana kart başlığı)
  const books: HighlightsPayload["books"] = [];
  let currentBook: HighlightsPayload["books"][0] | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // ## ile başlayan satır → yeni kitap başlığı
    if (line.startsWith("##")) {
      if (currentBook) books.push(currentBook);
      const heading = line.replace(/^#+\s*/, "");
      // "**Title** — Author" pattern'i
      const m = heading.match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
      if (m) {
        currentBook = { title: m[1].trim(), author: m[2].trim(), items: [] };
      } else {
        const plain = heading.match(/^(.+?)\s+[—–-]\s+(.+)$/);
        if (plain) {
          currentBook = { title: plain[1].trim(), author: plain[2].trim(), items: [] };
        } else {
          currentBook = {
            title: heading.replace(/\*\*/g, "").trim(),
            author: null,
            items: [],
          };
        }
      }
      continue;
    }

    // > [SENİN NOTUN] / [YOUR NOTE] → kullanıcı notu
    if (line.startsWith(">")) {
      const inner = line.replace(/^>\s*/, "").trim();
      const noteMatch = inner.match(/^\[(SENİN\s+NOTUN|YOUR\s+NOTE)\]\s*(.*)$/i);
      if (noteMatch && currentBook) {
        currentBook.items.push({ kind: "note", text: noteMatch[2].trim() });
      } else if (currentBook) {
        // Quote — başında/sonunda " ya da " olabilir, strip et
        const text = inner.replace(/^["""]|["""]$/g, "").trim();
        if (text) currentBook.items.push({ kind: "quote", text });
      }
    }
  }

  if (currentBook) books.push(currentBook);
  return { books };
}

/**
 * Format kontratı:
 *   # ÖNERİLER
 *   Okuma verilerinde belirginleşen ilgi alanlarına göre üç farklı yön önerebilirim...
 *
 *   ## Felsefe ve eleştirel düşünme
 *   - **Etika** — Baruch Spinoza
 *     Çetin Balanuye'nin kitabı üzerine yoğunlaştığın için doğrudan...
 *
 *   - **Şen Bilim** — Friedrich Nietzsche
 *     Spinoza'nın sevinç anlayışıyla diyalog kurar...
 */
function parseRecommendations(content: string): RecommendationsPayload {
  const lines = content.split("\n");
  // İlk # başlığını atla
  const intro: string[] = [];
  const categories: RecommendationsPayload["categories"] = [];
  let currentCategory: RecommendationsPayload["categories"][0] | null = null;
  let currentItem: RecommendationsPayload["categories"][0]["items"][0] | null = null;
  let inIntro = true;

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      if (inIntro) inIntro = intro.length === 0; // intro'yu boş line bitirir
      continue;
    }

    // ## ile başlayan satır → yeni kategori
    if (line.startsWith("##")) {
      inIntro = false;
      if (currentItem && currentCategory) {
        currentCategory.items.push(currentItem);
        currentItem = null;
      }
      if (currentCategory) categories.push(currentCategory);
      currentCategory = {
        name: line.replace(/^#+\s*/, "").trim(),
        items: [],
      };
      continue;
    }

    // - **Title** — Author → yeni öneri item'ı
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet && currentCategory) {
      inIntro = false;
      // Önceki item varsa kategoriye ekle
      if (currentItem) currentCategory.items.push(currentItem);
      const inner = bullet[1];
      const m = inner.match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
      if (m) {
        currentItem = { title: m[1].trim(), author: m[2].trim(), rationale: "" };
      } else {
        const plain = inner.match(/^(.+?)\s+[—–-]\s+(.+)$/);
        currentItem = plain
          ? { title: plain[1].trim(), author: plain[2].trim(), rationale: "" }
          : { title: inner.replace(/\*\*/g, "").trim(), author: null, rationale: "" };
      }
      continue;
    }

    // Diğer satırlar → ya intro ya rationale
    if (inIntro && !currentCategory) {
      intro.push(line);
    } else if (currentItem) {
      currentItem.rationale = currentItem.rationale
        ? `${currentItem.rationale} ${line}`
        : line;
    }
  }

  if (currentItem && currentCategory) currentCategory.items.push(currentItem);
  if (currentCategory) categories.push(currentCategory);

  return {
    intro: intro.join(" ").trim(),
    webGrounded: false, // v1.0'da daima false; A kararı (Hilal 26 Nis)
    categories,
  };
}
