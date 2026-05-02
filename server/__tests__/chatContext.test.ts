import { describe, it, expect } from "vitest";
import { buildChatUserContext } from "../_core/chatContext";

/**
 * chatContext.ts unit tests. Bug #4 (2 May 2026, TestFlight 50336) fix sonrası
 * eklendi: önceki versiyonda markings (highlights + marginalia) chat
 * context'ine hiç gömülmüyordu, model "vurguladıklarımı getir" sorusuna
 * SENİN NOTUN kartlarını döndürüyordu çünkü elinde "quote" kaynağı yoktu.
 *
 * Bu suite üç şeyi koruma altına alır:
 *   1. Tags satırı doğru render (mevcut Bug B fix regression).
 *   2. Highlights satırı doğru render (Bug #4 fix).
 *   3. Marginalia satırı doğru render (Bug #4 fix).
 *
 * Test fixtures kasıtlı minimum tutuldu — DB row'larına Drizzle-uyumlu
 * shape, JSON kolonları için unknown defense path'leri test edildi.
 */

const FIXED_DATE = new Date("2026-05-02T14:00:00.000Z");

const book1 = { id: 1, title: "Atlas Silkindi", author: "Ayn Rand" };
const book2 = { id: 2, title: "Bugünün Cadıları", author: "Mona Chollet" };

describe("buildChatUserContext", () => {
  it("renders empty state cleanly when no books or moments", () => {
    const ctx = buildChatUserContext([], [], "tr");
    expect(ctx).toContain("Kullanıcının Okuma Verileri");
    expect(ctx).toContain("Kitaplar (0 adet)");
    expect(ctx).toContain("Okuma Anları (0 adet)");
    // Empty case'te "Tüm Etiketler" satırı yazılmamalı (boş bullet sinyali).
    expect(ctx).not.toContain("Tüm Etiketler");
  });

  it("renders book list with title + author", () => {
    const ctx = buildChatUserContext([book1, book2], [], "tr");
    expect(ctx).toContain('"Atlas Silkindi" by Ayn Rand');
    expect(ctx).toContain('"Bugünün Cadıları" by Mona Chollet');
  });

  it("renders moment with OCR + note + tags + date", () => {
    const ctx = buildChatUserContext(
      [book1],
      [
        {
          id: 10,
          bookId: 1,
          ocrText: "Akıl, insanın temel kapasitesidir.",
          userNote: "Sf 45",
          tags: ["felsefe", "akıl"],
          createdAt: FIXED_DATE,
        },
      ],
      "tr",
    );
    expect(ctx).toContain("[Kitap: Atlas Silkindi]");
    expect(ctx).toContain("OCR Metni: Akıl, insanın temel kapasitesidir.");
    expect(ctx).toContain("Kullanıcı Notu: Sf 45");
    expect(ctx).toContain("Etiketler: felsefe, akıl");
    expect(ctx).toContain("Tarih: 2026-05-02T14:00:00.000Z");
  });

  it("aggregates 'Tüm Etiketler' frequency-sorted", () => {
    const ctx = buildChatUserContext(
      [book1],
      [
        { id: 1, bookId: 1, tags: ["felsefe", "akıl"], createdAt: FIXED_DATE },
        { id: 2, bookId: 1, tags: ["felsefe"], createdAt: FIXED_DATE },
        { id: 3, bookId: 1, tags: ["bilgi", "akıl"], createdAt: FIXED_DATE },
      ],
      "tr",
    );
    // felsefe: 2, akıl: 2, bilgi: 1 — ikiye eşit olanlar alphabetical
    expect(ctx).toContain("Tüm Etiketler (3 adet): akıl (2), felsefe (2), bilgi (1)");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bug #4 fix (2 May 2026): markings serialization
  // ─────────────────────────────────────────────────────────────────────────

  it("Bug #4 fix: renders highlights when present", () => {
    const ctx = buildChatUserContext(
      [book1],
      [
        {
          id: 10,
          bookId: 1,
          ocrText: "Sayfanın tamamı.",
          userNote: "Sf 95",
          tags: ["felsefe"],
          highlights: [
            { text: "Akıl, kişinin temel kapasitesidir.", kind: "highlighter" },
            { text: "Üretkenlik bir erdemdir.", kind: "underline" },
          ],
          marginalia: [],
          createdAt: FIXED_DATE,
        },
      ],
      "tr",
    );
    expect(ctx).toContain("Vurguladıkların:");
    expect(ctx).toContain('  - "Akıl, kişinin temel kapasitesidir."');
    expect(ctx).toContain('  - "Üretkenlik bir erdemdir."');
    // Marginalia boş → satır yazılmamalı.
    expect(ctx).not.toContain("Kenar Notların:");
  });

  it("Bug #4 fix: renders marginalia when present", () => {
    const ctx = buildChatUserContext(
      [book1],
      [
        {
          id: 11,
          bookId: 1,
          ocrText: "Sayfanın tamamı.",
          userNote: null,
          tags: [],
          highlights: [],
          marginalia: [{ text: "Bu kısım çok önemli." }, { text: "Tekrar oku." }],
          createdAt: FIXED_DATE,
        },
      ],
      "tr",
    );
    expect(ctx).toContain("Kenar Notların:");
    expect(ctx).toContain('  - "Bu kısım çok önemli."');
    expect(ctx).toContain('  - "Tekrar oku."');
    // Highlights boş → satır yazılmamalı.
    expect(ctx).not.toContain("Vurguladıkların:");
  });

  it("Bug #4 fix: renders BOTH highlights and marginalia when present", () => {
    const ctx = buildChatUserContext(
      [book1],
      [
        {
          id: 12,
          bookId: 1,
          highlights: [{ text: "Vurgu 1", kind: "highlighter" }],
          marginalia: [{ text: "Not 1" }],
          createdAt: FIXED_DATE,
        },
      ],
      "tr",
    );
    expect(ctx).toContain("Vurguladıkların:");
    expect(ctx).toContain('  - "Vurgu 1"');
    expect(ctx).toContain("Kenar Notların:");
    expect(ctx).toContain('  - "Not 1"');
  });

  it("Bug #4 fix: omits highlight/marginalia lines when null (not yet extracted)", () => {
    // null vs []: schema'da farklı semantic — null = "henüz extraction
    // çalıştırılmadı", [] = "çalıştırıldı, bulunamadı". Chat context'te
    // ikisi de boş satır yazmamalı (model boş bullet sinyali alma).
    const ctx = buildChatUserContext(
      [book1],
      [
        {
          id: 13,
          bookId: 1,
          ocrText: "Sayfanın tamamı.",
          userNote: "Sf 1",
          tags: ["test"],
          highlights: null,
          marginalia: null,
          createdAt: FIXED_DATE,
        },
      ],
      "tr",
    );
    expect(ctx).not.toContain("Vurguladıkların:");
    expect(ctx).not.toContain("Kenar Notların:");
    // Diğer alanlar normal render olmalı.
    expect(ctx).toContain("Kullanıcı Notu: Sf 1");
    expect(ctx).toContain("Etiketler: test");
  });

  it("Bug #4 fix: silently drops non-array highlights (runtime defense)", () => {
    // Drizzle JSON kolonu corrupt ise (örn. eski migration row'unda string
    // olarak yazılmış) extractHighlightTexts boş array döner — context
    // kırılmamalı, sadece satır yazılmaz.
    const ctx = buildChatUserContext(
      [book1],
      [
        {
          id: 14,
          bookId: 1,
          highlights: "bozuk-string-değer" as unknown,
          marginalia: 42 as unknown,
          createdAt: FIXED_DATE,
        },
      ],
      "tr",
    );
    expect(ctx).not.toContain("Vurguladıkların:");
    expect(ctx).not.toContain("Kenar Notların:");
    // Diğer alanlar normal render olmalı (tek satır kötü context'i kırmasın).
    expect(ctx).toContain("[Kitap: Atlas Silkindi]");
  });

  it("Bug #4 fix: silently drops highlight entries missing text field", () => {
    // Schema-dışı entry (text yok, garip key'ler) silently atlanır;
    // sadece valid text'ler render edilir.
    const ctx = buildChatUserContext(
      [book1],
      [
        {
          id: 15,
          bookId: 1,
          highlights: [
            { text: "Geçerli vurgu", kind: "highlighter" },
            { wrongKey: "siz", kind: "underline" }, // text yok → atlanır
            { text: "", kind: "underline" }, // boş text → atlanır
            { text: "İkinci geçerli", kind: "underline" },
          ] as unknown,
          createdAt: FIXED_DATE,
        },
      ],
      "tr",
    );
    expect(ctx).toContain('  - "Geçerli vurgu"');
    expect(ctx).toContain('  - "İkinci geçerli"');
    expect(ctx).not.toContain("wrongKey");
  });

  it("Bug #4 fix: EN locale uses 'Highlights' / 'Margin Notes' labels", () => {
    const ctx = buildChatUserContext(
      [book1],
      [
        {
          id: 16,
          bookId: 1,
          highlights: [{ text: "Reason is the basic capacity.", kind: "highlighter" }],
          marginalia: [{ text: "Important." }],
          createdAt: FIXED_DATE,
        },
      ],
      "en",
    );
    expect(ctx).toContain("Highlights:");
    expect(ctx).toContain('  - "Reason is the basic capacity."');
    expect(ctx).toContain("Margin Notes:");
    expect(ctx).toContain('  - "Important."');
    // TR labels EN context'te görünmemeli.
    expect(ctx).not.toContain("Vurguladıkların");
    expect(ctx).not.toContain("Kenar Notların");
  });
});
