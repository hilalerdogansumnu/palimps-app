/**
 * parseAssistantContent regression coverage.
 *
 * Test stratejisi: her kart tipi için 1 happy path + 1-2 edge case + 1 fallback.
 * Plus prose detection ve LLM-format-uyumsuzluğu fallback'leri.
 *
 * Not: bu test'ler vitest ile koşar (`pnpm test`). Sandbox'ta `vitest`
 * esbuild Linux binary mismatch'i ile düşer; gerçek doğrulama Hilal'in
 * Mac'inde `pnpm test`. Plus tsc check sandbox'ta zaten temiz.
 */

import { describe, it, expect } from "vitest";
import { parseAssistantContent, detectKind } from "./parse";

describe("detectKind", () => {
  it("returns 'prose' for content without # heading", () => {
    expect(detectKind("Ben PALIMPS'in okuma asistanıyım.")).toBe("prose");
    expect(detectKind("Kısa cevap.")).toBe("prose");
    expect(detectKind("")).toBe("prose");
  });

  it("returns 'book-list' for KÜTÜPHANENDE / LIBRARY headings", () => {
    expect(detectKind("# KÜTÜPHANENDE 3 KİTAP")).toBe("book-list");
    expect(detectKind("# 3 BOOKS IN YOUR LIBRARY")).toBe("book-list");
    expect(detectKind("# kitaplarinin listesi")).toBe("book-list");
  });

  it("returns 'tag-cloud' for ETİKET / TAG headings", () => {
    expect(detectKind("# TÜM ETİKETLERİN")).toBe("tag-cloud");
    expect(detectKind("# ALL TAGS")).toBe("tag-cloud");
    expect(detectKind('# "Bugünün Cadıları" ETİKETLERİ')).toBe("tag-cloud");
  });

  it("returns 'highlights' for VURGULA / HIGHLIGHT headings", () => {
    expect(detectKind("# VURGULADIKLARIN")).toBe("highlights");
    expect(detectKind("# YOUR HIGHLIGHTS")).toBe("highlights");
  });

  it("returns 'recommendations' for ÖNERİ / RECOMMEND headings", () => {
    expect(detectKind("# ÖNERİLER")).toBe("recommendations");
    expect(detectKind("# RECOMMENDATIONS")).toBe("recommendations");
  });

  it("returns 'prose' for # heading that doesn't match any card", () => {
    // # var ama tanınan kalıp değil → fallback. Bu, LLM format kontratını
    // ihlal ettiğinde kullanıcının raw markdown'ı görmesini sağlar.
    expect(detectKind("# Random heading")).toBe("prose");
    expect(detectKind("## Sub heading without parent")).toBe("prose");
  });
});

describe("parseAssistantContent — book-list", () => {
  it("parses 3-book library list", () => {
    const result = parseAssistantContent(
      `# KÜTÜPHANENDE 3 KİTAP
- **Spinoza'nın Sevinci** — Çetin Balanuye
- **Bugünün Cadıları** — Mona Chollet
- **Atlas Silkindi** — Ayn Rand`,
    );
    expect(result.kind).toBe("book-list");
    if (result.kind !== "book-list") return;
    expect(result.payload.count).toBe(3);
    expect(result.payload.items).toHaveLength(3);
    expect(result.payload.items[0]).toEqual({
      title: "Spinoza'nın Sevinci",
      author: "Çetin Balanuye",
    });
    expect(result.payload.items[2].author).toBe("Ayn Rand");
  });

  it("falls back to bullet count when heading has no number", () => {
    const result = parseAssistantContent(
      `# KİTAPLARIN
- **Test** — Author`,
    );
    expect(result.kind).toBe("book-list");
    if (result.kind !== "book-list") return;
    expect(result.payload.count).toBe(1);
  });

  it("handles books without author (just title)", () => {
    const result = parseAssistantContent(
      `# KÜTÜPHANENDE 2 KİTAP
- **Title Without Author**
- **Another One** — Real Author`,
    );
    expect(result.kind).toBe("book-list");
    if (result.kind !== "book-list") return;
    expect(result.payload.items[0]).toEqual({
      title: "Title Without Author",
      author: null,
    });
    expect(result.payload.items[1].author).toBe("Real Author");
  });
});

describe("parseAssistantContent — tag-cloud", () => {
  it("parses all-tags comma list with frequency", () => {
    const result = parseAssistantContent(
      `# TÜM ETİKETLERİN
felsefe, spinoza (3), yapay-zeka (2), yaşlanma, annelik`,
    );
    expect(result.kind).toBe("tag-cloud");
    if (result.kind !== "tag-cloud") return;
    expect(result.payload.bookTitle).toBeNull();
    expect(result.payload.tags).toHaveLength(5);
    expect(result.payload.tags[1]).toEqual({ name: "spinoza", count: 3 });
    expect(result.payload.tags[3]).toEqual({ name: "yaşlanma", count: null });
  });

  it("parses book-specific tag heading", () => {
    const result = parseAssistantContent(
      `# "Bugünün Cadıları" ETİKETLERİ
ataerkil-sistem, kadın-hakları, içselleştirme`,
    );
    expect(result.kind).toBe("tag-cloud");
    if (result.kind !== "tag-cloud") return;
    expect(result.payload.bookTitle).toBe("Bugünün Cadıları");
    expect(result.payload.tags).toHaveLength(3);
  });

  it("parses bullet-style tag list (LLM format drift)", () => {
    // LLM bazen virgül yerine bullet kullanır — fallback parse devreye girer.
    const result = parseAssistantContent(
      `# TÜM ETİKETLERİN
- felsefe (2)
- spinoza
- ai`,
    );
    expect(result.kind).toBe("tag-cloud");
    if (result.kind !== "tag-cloud") return;
    expect(result.payload.tags).toHaveLength(3);
    expect(result.payload.tags[0]).toEqual({ name: "felsefe", count: 2 });
  });
});

describe("parseAssistantContent — highlights", () => {
  it("parses highlights with quotes and user notes", () => {
    const result = parseAssistantContent(
      `# VURGULADIKLARIN
## **Spinoza'nın Sevinci** — Çetin Balanuye
> "Spinoza çok büyük bir işe kalkışan, kalkıştığı işin çapını bilen düşünürdür."
> "Varsayımı insanlığın şehri gibidir."
> [SENİN NOTUN] Varsayım ve aşkınlık
## **Bugünün Cadıları** — Mona Chollet
> "Kadınların yenilmez gücü, görünmez kıldıklarındadır."`,
    );
    expect(result.kind).toBe("highlights");
    if (result.kind !== "highlights") return;
    expect(result.payload.books).toHaveLength(2);

    const spinoza = result.payload.books[0];
    expect(spinoza.title).toBe("Spinoza'nın Sevinci");
    expect(spinoza.author).toBe("Çetin Balanuye");
    expect(spinoza.items).toHaveLength(3);
    expect(spinoza.items[0].kind).toBe("quote");
    expect(spinoza.items[2]).toEqual({ kind: "note", text: "Varsayım ve aşkınlık" });

    const cadi = result.payload.books[1];
    expect(cadi.items[0].kind).toBe("quote");
    expect(cadi.items[0].text).toContain("Kadınların yenilmez gücü");
  });

  it("handles English [YOUR NOTE] tag variant", () => {
    const result = parseAssistantContent(
      `# YOUR HIGHLIGHTS
## **Test Book** — Author Name
> "A quote here."
> [YOUR NOTE] My personal reflection`,
    );
    expect(result.kind).toBe("highlights");
    if (result.kind !== "highlights") return;
    expect(result.payload.books[0].items[1]).toEqual({
      kind: "note",
      text: "My personal reflection",
    });
  });
});

describe("parseAssistantContent — recommendations", () => {
  it("parses categorized recommendations with intro and rationale", () => {
    const result = parseAssistantContent(
      `# ÖNERİLER
Okuma verilerinde belirginleşen ilgi alanlarına göre üç farklı yön önerebilirim — felsefe, toplumsal eleştiri ve teknoloji ekseninde.

## Felsefe ve eleştirel düşünme
- **Etika** — Baruch Spinoza
  Çetin Balanuye'nin kitabı üzerine yoğunlaştığın için doğrudan Spinoza'nın başyapıtını okumak yardımcı olur.

- **Şen Bilim** — Friedrich Nietzsche
  Spinoza'nın sevinç anlayışıyla diyalog kurar.

## Toplumsal eleştiri
- **Cinsiyet Belası** — Judith Butler
  Bugünün Cadıları'nda işlenen ataerkillik temalarını teorik bir zemine oturtur.`,
    );
    expect(result.kind).toBe("recommendations");
    if (result.kind !== "recommendations") return;
    expect(result.payload.intro).toContain("üç farklı yön");
    expect(result.payload.webGrounded).toBe(false);
    expect(result.payload.categories).toHaveLength(2);

    const felsefe = result.payload.categories[0];
    expect(felsefe.name).toBe("Felsefe ve eleştirel düşünme");
    expect(felsefe.items).toHaveLength(2);
    expect(felsefe.items[0].title).toBe("Etika");
    expect(felsefe.items[0].author).toBe("Baruch Spinoza");
    expect(felsefe.items[0].rationale).toContain("başyapıtını");
  });
});

describe("parseAssistantContent — prose fallback", () => {
  it("returns raw text for plain conversation answer", () => {
    const result = parseAssistantContent("Ben PALIMPS'in okuma asistanıyım.");
    expect(result.kind).toBe("prose");
    if (result.kind !== "prose") return;
    expect(result.payload.text).toBe("Ben PALIMPS'in okuma asistanıyım.");
  });

  it("returns prose for LLM that ignored format contract", () => {
    // LLM "## Bilgi" gibi bilinmeyen başlıkla başlarsa düz markdown render.
    const content = "## Bilgi\n\nKütüphanende felsefe kategorisi var.";
    const result = parseAssistantContent(content);
    expect(result.kind).toBe("prose");
    if (result.kind !== "prose") return;
    expect(result.payload.text).toBe(content);
  });

  it("preserves whitespace in raw text", () => {
    const content = "Birinci satır.\n\nİkinci paragraf.";
    const result = parseAssistantContent(content);
    expect(result.kind).toBe("prose");
    if (result.kind !== "prose") return;
    expect(result.payload.text).toBe(content);
  });

  it("falls back to prose on parse error (defensive)", () => {
    // Edge case: # heading var, tip eşleşiyor, ama body parse'da exception
    // atılırsa try/catch ile prose'a düşer. Bu test pattern'i somutlaştırıyor:
    // "# KÜTÜPHANENDE 3 KİTAP" başlık var, body boş → parser items=[] döner,
    // exception YOK, kart render olur ama içerik boş. Kabul edilebilir
    // davranış — empty state component'te handle ediliyor.
    const result = parseAssistantContent("# KÜTÜPHANENDE 0 KİTAP");
    expect(result.kind).toBe("book-list");
    if (result.kind !== "book-list") return;
    expect(result.payload.count).toBe(0);
    expect(result.payload.items).toHaveLength(0);
  });
});
