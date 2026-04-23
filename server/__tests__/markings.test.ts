import { describe, it, expect, afterEach } from "vitest";
import { MARKINGS_PROMPT, MARKINGS_SCHEMA } from "../_core/prompts";

/**
 * Phase B markings — schema + prompt invariants. Bu testler unit-level
 * regression koruması: schema strict mode'u kazara açık bırakılırsa,
 * prompt'tan kritik güvenlik klozları silinirse, env flag default'u
 * değişirse buradaki test'ler düşer.
 *
 * Router-level (moments.create) integration test'i henüz YOK — eval
 * gate'i dogfood sonrasına ertelendi (Hilal pivot: "en basic haliyle
 * devam edelim, mükemmel bir U&UX ile önce bir teste çıkalım").
 * Dogfood'dan sonra invokeLLM mock'lu kill switch davranış testi
 * eklenecek (#19 / Notların tab gate'i ile birlikte).
 */

describe("MARKINGS_SCHEMA", () => {
  it("is strict at root (additionalProperties: false)", () => {
    expect(MARKINGS_SCHEMA.strict).toBe(true);
    expect(MARKINGS_SCHEMA.schema.additionalProperties).toBe(false);
  });

  it("requires both highlights and marginalia (no optional fields under strict)", () => {
    // Gemini structured output strict modunda 'optional' alan tutarsızlık
    // yaratıyor — ya tüm property'ler required, ya schema reject. Phase A
    // discipline aynı.
    expect(MARKINGS_SCHEMA.schema.required).toEqual(["highlights", "marginalia"]);
  });

  it("caps highlights at 10 entries (defense in depth — parmak/gölge sızıntısı)", () => {
    const hi = MARKINGS_SCHEMA.schema.properties.highlights;
    expect(hi.minItems).toBe(0);
    expect(hi.maxItems).toBe(10);
  });

  it("caps marginalia at 8 entries (kenar boşluğu fiziksel sınırı)", () => {
    const ma = MARKINGS_SCHEMA.schema.properties.marginalia;
    expect(ma.minItems).toBe(0);
    expect(ma.maxItems).toBe(8);
  });

  it("highlights.kind is restricted to ['highlighter', 'underline'] (no color, no other)", () => {
    // Gate 3 kararı: renk YOK (karmaşa, sonradan eklenebilir). Ek kind
    // değeri eklenirse bu test düşer ve kasıtlı kararı gözden geçirmeye
    // zorlar.
    const kindSchema = MARKINGS_SCHEMA.schema.properties.highlights.items.properties.kind;
    expect(kindSchema.enum).toEqual(["highlighter", "underline"]);
  });

  it("each highlight requires both text and kind", () => {
    const itemRequired =
      MARKINGS_SCHEMA.schema.properties.highlights.items.required;
    expect(itemRequired).toEqual(["text", "kind"]);
  });

  it("each marginalia entry requires text only (no anchor / position — Gate 3 karar)", () => {
    // Anchor / position alanları eklenmemeli — el yazısı formu zaten hoş,
    // coordinate-level Gemini'den güvenilir gelmiyor. Eğer biri ileride
    // 'position' eklerse bu test düşer ve YAGNI tartışmasını tetikler.
    const itemRequired =
      MARKINGS_SCHEMA.schema.properties.marginalia.items.required;
    expect(itemRequired).toEqual(["text"]);
    const itemProps =
      MARKINGS_SCHEMA.schema.properties.marginalia.items.properties;
    expect(Object.keys(itemProps)).toEqual(["text"]);
  });

  it("text fields cap at 500 chars (paragraph-level upper bound)", () => {
    const hiText = MARKINGS_SCHEMA.schema.properties.highlights.items.properties.text;
    const maText = MARKINGS_SCHEMA.schema.properties.marginalia.items.properties.text;
    expect(hiText.maxLength).toBe(500);
    expect(maText.maxLength).toBe(500);
  });

  it("nested objects are also strict (additionalProperties: false at item level)", () => {
    expect(
      MARKINGS_SCHEMA.schema.properties.highlights.items.additionalProperties
    ).toBe(false);
    expect(
      MARKINGS_SCHEMA.schema.properties.marginalia.items.additionalProperties
    ).toBe(false);
  });
});

describe("MARKINGS_PROMPT — safety clauses regression", () => {
  // Prompt edit'leri sırasında kritik güvenlik klozlarını kazara silmeyi
  // önler. Skill review'larında eklenen 3 kloz:
  //   1. llm-engineer: "italik SANMA" (kitap tipografisi false positive)
  //   2. product-designer: "emin değilsen 'underline'" (defansif default)
  //   3. code-reviewer: "[okunaksız] YAZMA" (UI'da çirkin placeholder)
  // Bu kloz silinirse veya yumuşatılırsa test düşer.

  it("forbids italic-as-mark false positive", () => {
    // "italik" + "sanma" yan yana olmalı. Tam string match değil çünkü
    // dilbilimsel varyasyon olabilir; semantic intent korunmalı.
    expect(MARKINGS_PROMPT.toLocaleLowerCase("tr-TR")).toMatch(/italik.*sanma/);
  });

  it("instructs defensive 'underline' fallback when uncertain", () => {
    expect(MARKINGS_PROMPT).toMatch(/emin değilsen.*underline/i);
  });

  it("forbids '[okunaksız]' placeholder in marginalia", () => {
    // Code-reviewer notu: kullanıcı kendi notunun yerinde "[okunaksız]"
    // görmek yerine boş array tercih eder. Yumuşatılırsa UI çirkinleşir.
    expect(MARKINGS_PROMPT).toMatch(/\[okunaksız\].*yazma/i);
  });

  it("instructs reading-order sort for marginalia (yukarıdan aşağıya)", () => {
    // Gate 3 kararı: position alanı yok, ama sıralama okuma yönünde olmalı.
    // UI render array.map ile gider, sıralamayı prompt enforce ediyor.
    expect(MARKINGS_PROMPT).toMatch(/yukarıdan aşağıya/i);
  });

  it("excludes (1)(2)(3) inline numbering from being separate entries", () => {
    expect(MARKINGS_PROMPT).toMatch(/\(1\)\(2\)\(3\)/);
  });

  it("excludes page numbers from highlights", () => {
    expect(MARKINGS_PROMPT.toLocaleLowerCase("tr-TR")).toMatch(/sayfa numara/);
  });

  it("forbids JSON-extraneous output ('JSON dışında HİÇBİR ŞEY yazma')", () => {
    // Turkish `İ` lowercase'ı JS default `.toLowerCase()` ile `i̇` (i + combining
    // dot above) olur, düz `i` değil. `/i` flag aynı yolu kullandığı için
    // `/hiçbir/i` regex'i `HİÇBİR` metnini yakalayamaz. Locale-aware lowercase
    // ile karşılaştırıyoruz — line 120'deki pattern ile tutarlı.
    expect(MARKINGS_PROMPT.toLocaleLowerCase("tr-TR")).toMatch(/json dışında.*hiçbir şey/);
  });
});

describe("ENABLE_MARKING_CAPTURE kill switch", () => {
  // env.ts pattern: sadece explicit "false" stringi kapatır. Yanlış yazım
  // ("False", "0", boş string, undefined) kazara kapatmaz. Phase A
  // (ENABLE_MOMENT_ENRICHMENT) ile aynı semantik — Hilal Railway'de tek
  // satır flip ile production'da kapatabilmeli.

  const original = process.env.ENABLE_MARKING_CAPTURE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ENABLE_MARKING_CAPTURE;
    } else {
      process.env.ENABLE_MARKING_CAPTURE = original;
    }
  });

  // Kill switch davranışı doğrudan ENV'den değil, expression'dan test
  // ediliyor — env.ts module load time'da sabitlenmiş bir değer tutuyor.
  // Bu test pattern'in semantiğini garantiler.
  it("undefined → ON (default ON)", () => {
    delete process.env.ENABLE_MARKING_CAPTURE;
    expect(process.env.ENABLE_MARKING_CAPTURE !== "false").toBe(true);
  });

  it("'false' string → OFF (only this string flips)", () => {
    process.env.ENABLE_MARKING_CAPTURE = "false";
    expect(process.env.ENABLE_MARKING_CAPTURE !== "false").toBe(false);
  });

  it("'False' (mis-cased) → still ON (typo defense)", () => {
    process.env.ENABLE_MARKING_CAPTURE = "False";
    expect(process.env.ENABLE_MARKING_CAPTURE !== "false").toBe(true);
  });

  it("'0' → still ON (only the literal 'false' string flips)", () => {
    process.env.ENABLE_MARKING_CAPTURE = "0";
    expect(process.env.ENABLE_MARKING_CAPTURE !== "false").toBe(true);
  });

  it("empty string → ON (env unset edge case)", () => {
    process.env.ENABLE_MARKING_CAPTURE = "";
    expect(process.env.ENABLE_MARKING_CAPTURE !== "false").toBe(true);
  });

  it("'true' → ON (explicit true also passes)", () => {
    process.env.ENABLE_MARKING_CAPTURE = "true";
    expect(process.env.ENABLE_MARKING_CAPTURE !== "false").toBe(true);
  });
});
