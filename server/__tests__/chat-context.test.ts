import { describe, it, expect } from "vitest";
import { buildChatUserContext } from "../_core/chatContext";

// Helper'a fixture'lar — Drizzle row shape'ini minimum reproduce ediyor.
// `tags` kolon type'ı `unknown` (Drizzle JSON), runtime'da Array.isArray
// guard'ı korur — fixture'larda `unknown` cast'i kasıtlı. id/bookId number
// (Drizzle auto-increment).
const book = (id: number, title: string, author: string | null = null) => ({
  id,
  title,
  author,
});

const moment = (overrides: {
  id?: number;
  bookId?: number;
  ocrText?: string | null;
  userNote?: string | null;
  tags?: unknown;
  createdAt?: string | Date;
}) => ({
  id: overrides.id ?? 1,
  bookId: overrides.bookId ?? 1,
  ocrText: overrides.ocrText ?? null,
  userNote: overrides.userNote ?? null,
  tags: overrides.tags ?? null,
  createdAt: overrides.createdAt ?? new Date("2026-04-26T12:00:00Z"),
});

describe("buildChatUserContext (Bug B regression)", () => {
  describe("tags inclusion in moment block", () => {
    it("includes tags line when moment has tags", () => {
      const ctx = buildChatUserContext(
        [book(1, "Suç ve Ceza", "Dostoyevski")],
        [moment({ ocrText: "Raskolnikov...", tags: ["varoluşçuluk", "suçluluk"] })],
        "tr",
      );
      expect(ctx).toContain("Etiketler: varoluşçuluk, suçluluk");
    });

    it("omits tags line when moment has null tags", () => {
      const ctx = buildChatUserContext(
        [book(1, "Suç ve Ceza")],
        [moment({ tags: null })],
        "tr",
      );
      expect(ctx).not.toContain("Etiketler:");
    });

    it("omits tags line when moment has empty array tags", () => {
      const ctx = buildChatUserContext(
        [book(1, "Suç ve Ceza")],
        [moment({ tags: [] })],
        "tr",
      );
      expect(ctx).not.toContain("Etiketler:");
    });

    it("EN locale uses 'Tags:' label", () => {
      const ctx = buildChatUserContext(
        [book(1, "Crime and Punishment", "Dostoyevsky")],
        [moment({ tags: ["existentialism"] })],
        "en",
      );
      expect(ctx).toContain("Tags: existentialism");
    });

    it("gracefully handles non-array tags (Drizzle bozuk JSON)", () => {
      // m.tags `unknown` — DB'de JSON kolonu, type-system garanti vermiyor.
      // Bozuk satır context'i kırmasın.
      const ctx = buildChatUserContext(
        [book(1, "Test")],
        [moment({ tags: "tek-string-yanlışlıkla" as unknown })],
        "tr",
      );
      expect(ctx).not.toContain("Etiketler:");
      expect(ctx).toContain("[Kitap: Test]"); // moment yine render
    });

    it("filters out non-string items in tags array", () => {
      const ctx = buildChatUserContext(
        [book(1, "Test")],
        [moment({ tags: ["good", 42, null, "also-good"] as unknown })],
        "tr",
      );
      expect(ctx).toContain("Etiketler: good, also-good");
    });
  });

  describe("aggregate 'Tüm Etiketler' / 'All Tags' section", () => {
    it("aggregates tags across moments with frequency, sorted desc", () => {
      const ctx = buildChatUserContext(
        [book(1, "X")],
        [
          moment({ id: 1, tags: ["a", "b"] }),
          moment({ id: 2, tags: ["b", "c"] }),
          moment({ id: 3, tags: ["b"] }),
        ],
        "tr",
      );
      // Frekans: b=3, a=1, c=1. Eşitlikte alfabetik (a < c).
      expect(ctx).toMatch(/Tüm Etiketler.*b \(3\), a \(1\), c \(1\)/);
    });

    it("includes count in aggregate header (3 unique tags)", () => {
      const ctx = buildChatUserContext(
        [book(1, "X")],
        [moment({ tags: ["a", "b", "c"] })],
        "tr",
      );
      expect(ctx).toMatch(/Tüm Etiketler \(3 adet\):/);
    });

    it("EN locale uses 'All Tags' label without 'adet' suffix", () => {
      const ctx = buildChatUserContext(
        [book(1, "X")],
        [moment({ tags: ["a", "b"] })],
        "en",
      );
      expect(ctx).toMatch(/All Tags \(2\):/);
    });

    it("omits aggregate section when no tags anywhere", () => {
      const ctx = buildChatUserContext(
        [book(1, "X")],
        [moment({ tags: null })],
        "tr",
      );
      expect(ctx).not.toContain("Tüm Etiketler");
      expect(ctx).not.toContain("All Tags");
    });
  });

  describe("structural invariants", () => {
    it("limits moments rendered to 50 (most recent)", () => {
      const moments = Array.from({ length: 60 }, (_, i) =>
        moment({ id: i + 1, ocrText: `text-${i}` }),
      );
      const ctx = buildChatUserContext([book(1, "X")], moments, "tr");
      // İlk 50 render edilir (slice davranışı), 51+ kesilir.
      expect(ctx).toContain("text-0");
      expect(ctx).toContain("text-49");
      expect(ctx).not.toContain("text-50");
      expect(ctx).not.toContain("text-59");
    });

    it("renders book count and label in TR with 'adet' suffix", () => {
      const ctx = buildChatUserContext(
        [book(1, "X"), book(2, "Y")],
        [],
        "tr",
      );
      expect(ctx).toContain("Kitaplar (2 adet):");
    });

    it("renders book count without 'adet' in EN", () => {
      const ctx = buildChatUserContext(
        [book(1, "X"), book(2, "Y")],
        [],
        "en",
      );
      expect(ctx).toContain("Books (2):");
    });

    it("uses 'Bilinmeyen' / 'Unknown' for moments with missing book", () => {
      const tr = buildChatUserContext(
        [],
        [moment({ bookId: 999 })],
        "tr",
      );
      expect(tr).toContain("[Kitap: Bilinmeyen]");

      const en = buildChatUserContext(
        [],
        [moment({ bookId: 999 })],
        "en",
      );
      expect(en).toContain("[Book: Unknown]");
    });

    it("uses 'Yok' / 'None' for empty ocrText / userNote", () => {
      const tr = buildChatUserContext(
        [book(1, "X")],
        [moment({ ocrText: null, userNote: null })],
        "tr",
      );
      expect(tr).toContain("OCR Metni: Yok");
      expect(tr).toContain("Kullanıcı Notu: Yok");

      const en = buildChatUserContext(
        [book(1, "X")],
        [moment({ ocrText: null, userNote: null })],
        "en",
      );
      expect(en).toContain("OCR Text: None");
      expect(en).toContain("Note: None");
    });

    it("converts Date createdAt to ISO string", () => {
      const ctx = buildChatUserContext(
        [book(1, "X")],
        [moment({ createdAt: new Date("2026-04-26T12:00:00Z") })],
        "tr",
      );
      expect(ctx).toContain("Tarih: 2026-04-26T12:00:00.000Z");
    });
  });
});
