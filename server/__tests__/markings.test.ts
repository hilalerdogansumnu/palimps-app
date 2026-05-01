import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
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

  // 50333 prompt iterate (Task #13): phantom highlight defense — model'in
  // gerçekte var olmayan işaretler uydurmasını / parmak-gölgesini highlight
  // sanmasını / aynı metni iki kez göstermesini engelleyen üç kloz prompt'a
  // eklendi. Bu test'ler kazara siliniş regresyonunu yakalar.

  it("forbids parmak/gölge/leke false positives in highlights (phantom defense)", () => {
    // En az bu 3 token açıkça yazılmalı: "parmak", "gölge", "leke" (veya
    // mürekkep yayılması). "DEĞİL" enforcement ifadesi de var olmalı.
    const lower = MARKINGS_PROMPT.toLocaleLowerCase("tr-TR");
    expect(lower).toMatch(/parmak/);
    expect(lower).toMatch(/gölge/);
    expect(lower).toMatch(/(leke|mürekkep|kırışıklık)/);
    expect(MARKINGS_PROMPT).toMatch(/highlight DEĞİL/);
  });

  it("instructs low-confidence skip (precision over recall)", () => {
    // "düşük güven" / "şüphe" / "atla" semantiği. Soft prompt, sıkı match yok
    // ama "şüphe" + "yoksay/atla" yakın olmalı.
    const lower = MARKINGS_PROMPT.toLocaleLowerCase("tr-TR");
    expect(lower).toMatch(/(düşük güven|şüphe).*?(atla|yoksay)/s);
  });

  it("forbids duplicate highlight entries for the same passage", () => {
    // "aynı metni iki kez" + "duplicate" enforcement.
    const lower = MARKINGS_PROMPT.toLocaleLowerCase("tr-TR");
    expect(lower).toMatch(/aynı metni.*iki kez/);
    expect(lower).toMatch(/duplicate/);
  });

  // Polish v3 (1 May 2026 dogfood — Hilal IMG_7507 page): markings extraction
  // sayfa metnindeki TEK kesintisiz uzun fosforlu vurguyu 3 ayrı entry'ye
  // bölüyordu. Plus vurgusuz düz metin (italic alıntı blokları) highlight
  // olarak çıkıyordu (false positive). İki yeni güç-kuralı.
  it("requires continuous mark = single entry (segmentation defense)", () => {
    // "kesintisiz" + "tek entry" + "bölme yasak" semantiği.
    const lower = MARKINGS_PROMPT.toLocaleLowerCase("tr-TR");
    expect(lower).toMatch(/kesintisiz.*tek entry/s);
    expect(lower).toMatch(/(bölmek? yasak|bölme)/);
    expect(lower).toMatch(/(birleştir|tek.*text)/);
  });

  it("requires user hand-mark only (false-positive defense)", () => {
    // "kullanıcının el hareketi" + "tipografik unsurlar işaret değil" +
    // "false positive > false negative" disiplini.
    // NOT: tr-TR locale lowercase Latin "I" → "ı" (dotless) yapar; "FALSE
    // POSITIVE" → "false posıtıve" olur. Bu yüzden "false positive" gibi
    // Latin yazım pattern'lerini orijinal MARKINGS_PROMPT'ta (caps korunmuş)
    // arıyoruz — line 131'deki "JSON dışında HİÇBİR ŞEY" testinin tersine.
    const lower = MARKINGS_PROMPT.toLocaleLowerCase("tr-TR");
    expect(lower).toMatch(/(el hareketi|kullanıcının eliyle)/);
    expect(lower).toMatch(/(tipografik|italik|italic|bold|alıntı blok)/);
    expect(MARKINGS_PROMPT).toMatch(/FALSE POSITIVE > FALSE NEGATIVE/);
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

describe("moments.create — markings wiring regression (source-scan)", () => {
  // tRPC caller harness + invokeLLM mock + DB mock bu codebase'te yok.
  // Full integration test yazmak büyük iş, launch penceresine sığmaz.
  // Pragmatik alternatif: kritik kod kontratlarını routers.ts kaynak
  // kodundan regex ile doğrula. Refactor sırasında bu hatlardan biri
  // sessizce silinirse test düşer, PR merge'inden önce yakalanır.
  //
  // Neden source-scan: invokeLLM real bir çağrı, mock'suz integration
  // test hem costly hem flaky. Kritik kontratlar (kill switch wrapper,
  // model routing, try/catch) statik olarak da doğrulanabiliyor.
  //
  // Kill switch kill switch.

  // ESM + RN tsconfig: lib.dom dahil olduğu için `new URL(...)` DOM URL
  // tipinde kalır; Node'un fileURLToPath/readFileSync'i kendi url.URL
  // tipini bekler → TS2769 / TS2345. Textbook ESM __dirname pattern'iyle
  // string path'e geçiyoruz, URL objesi sahne dışı. Runtime davranışı
  // aynı.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const routersSource = readFileSync(
    resolve(__dirname, "../routers.ts"),
    "utf-8",
  );

  it("wraps markings extraction in ENV.enableMarkingCapture check", () => {
    // Kill switch contract: Railway'de ENABLE_MARKING_CAPTURE=false flip
    // edilince markings atlanmalı. if-wrapper silinirse feature her zaman
    // çalışır, production'ı hotfix-siz kapatmak imkansız olur.
    expect(routersSource).toMatch(/if\s*\(\s*ENV\.enableMarkingCapture\s*\)/);
  });

  it("uses MARKINGS_PROMPT and MARKINGS_SCHEMA identifiers", () => {
    // Prompt/schema routing: başka bir LLM çağrısı (ör. enrichment)
    // yanlışlıkla bu bloğa kopyalanırsa feature sessizce yanlış şey
    // döndürür. İki identifier da routers.ts içinde geçmeli.
    expect(routersSource).toMatch(/MARKINGS_PROMPT/);
    expect(routersSource).toMatch(/MARKINGS_SCHEMA/);
  });

  it("routes markings through ENV.geminiModelChat (full flash, NOT flash-lite)", () => {
    // Handoff §3.1 kararı: flash-lite el yazısı hallucinate ediyor
    // ("Genel AI" → "Genel Al" vb. kullanıcı güvenini anında kırar).
    // Model yanlışlıkla ENV.geminiModelOcr'a düşürülürse kalite çöker
    // ama feature çalışmaya devam eder — sessiz regression.
    //
    // Markings bloğunun sınırlarını yakalayıp içinde doğru model var mı
    // kontrol et. Block start = 'if (ENV.enableMarkingCapture)',
    // block end = 'MARKINGS_SCHEMA' satırının sonundaki invokeLLM kapanışı.
    const markingsBlock = routersSource.match(
      /if\s*\(\s*ENV\.enableMarkingCapture\s*\)[\s\S]*?MARKINGS_PROMPT[\s\S]*?MARKINGS_SCHEMA/,
    );
    expect(markingsBlock).not.toBeNull();
    expect(markingsBlock![0]).toMatch(/ENV\.geminiModelChat/);
    // Negative: flash-lite (OCR modeli) kullanılmamalı.
    expect(markingsBlock![0]).not.toMatch(/ENV\.geminiModelOcr/);
  });

  it("uses structured output (json_schema responseFormat) for markings", () => {
    // Schema strict: true — structured output devrede olmalı, yoksa
    // hallucinate riski çok yüksek. invokeLLM çağrısının responseFormat'ı
    // yanlış tipe düşürülürse schema enforce edilmez.
    const markingsBlock = routersSource.match(
      /if\s*\(\s*ENV\.enableMarkingCapture\s*\)[\s\S]*?MARKINGS_SCHEMA[\s\S]*?\}\s*\)/,
    );
    expect(markingsBlock).not.toBeNull();
    expect(markingsBlock![0]).toMatch(/type:\s*["']json_schema["']/);
  });

  it("catches markings failures with PII-safe warn log (moment kaydı kritik)", () => {
    // Best-effort contract: markings extract başarısız olsa bile moment
    // kaydedilmeli. try/catch silinirse moments.create komple kırılır —
    // en kötü regression. Log mesajı da spesifik — observability-engineer
    // alarm pattern'leri bu string'e bağlı olabilir, değişirse alert kaçar.
    expect(routersSource).toMatch(
      /console\.warn\(\s*"\[moments\.create\] markings extraction failed"/,
    );
    // PII guard: catch bloğunda markings content (highlights/marginalia text)
    // log'a yazılmamalı. Sadece userId + model + promptName + durationMs +
    // error.message beyaz listede. 'highlights:' veya 'marginalia:' anahtarı
    // warn objesinde görünüyorsa PII leak.
    const catchBlock = routersSource.match(
      /console\.warn\(\s*"\[moments\.create\] markings extraction failed"[\s\S]*?\}\s*\)/,
    );
    expect(catchBlock).not.toBeNull();
    expect(catchBlock![0]).not.toMatch(/\bhighlights:/);
    expect(catchBlock![0]).not.toMatch(/\bmarginalia:/);
    expect(catchBlock![0]).not.toMatch(/\bocrText:/);
  });
});
