/**
 * server/storage.ts — URL→key extraction unit testleri.
 *
 * `extractStorageKey` account-deletion akışında R2 cleanup'ın temelini
 * oluşturuyor. Yanlış parsing iki yönde de tehlikeli:
 *  - false positive (bizim olmayan URL "ours" sanılıp delete edilirse) →
 *    yabancı bucket'a delete göndermeyiz, ama ENV.r2BucketName altındaki
 *    yanlış key'i silebiliriz, veri kaybı
 *  - false negative (bizim URL skip edilirse) → orphan R2 objesi, KVKK
 *    ihlali (privacy policy "anında silinir" diyor)
 *
 * Bu yüzden parsing davranışını burada kilitliyoruz.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ENV (server/_core/env.ts) module-load'unda dondurulduğu için, env'i set
// ettikten SONRA `vi.resetModules()` ile fresh import zorunlu — yoksa cached
// modül "" base ile dönüp tüm URL match testleri null'a düşer.
const ORIGINAL_BASE = process.env.R2_PUBLIC_BASE_URL;

describe("extractStorageKey", () => {
  beforeEach(() => {
    process.env.R2_PUBLIC_BASE_URL = "https://files.palimps.app";
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_BASE === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = ORIGINAL_BASE;
  });

  it("returns null for null/undefined/empty", async () => {
    const { extractStorageKey } = await import("../storage");
    expect(extractStorageKey(null)).toBe(null);
    expect(extractStorageKey(undefined)).toBe(null);
    expect(extractStorageKey("")).toBe(null);
  });

  it("returns the key as-is for a bare key", async () => {
    const { extractStorageKey } = await import("../storage");
    expect(extractStorageKey("uploads/3/123-abc.jpg")).toBe(
      "uploads/3/123-abc.jpg",
    );
  });

  it("strips leading slashes from a bare key", async () => {
    const { extractStorageKey } = await import("../storage");
    expect(extractStorageKey("/uploads/3/123-abc.jpg")).toBe(
      "uploads/3/123-abc.jpg",
    );
  });

  it("extracts key from a public URL that matches our base", async () => {
    const { extractStorageKey } = await import("../storage");
    expect(
      extractStorageKey("https://files.palimps.app/uploads/3/123-abc.jpg"),
    ).toBe("uploads/3/123-abc.jpg");
  });

  it("returns null for an external URL we don't own", async () => {
    const { extractStorageKey } = await import("../storage");
    expect(extractStorageKey("https://example.com/some-image.jpg")).toBe(null);
    expect(
      extractStorageKey("https://covers.openlibrary.org/b/id/123-L.jpg"),
    ).toBe(null);
  });

  it("returns null when R2_PUBLIC_BASE_URL is not configured", async () => {
    delete process.env.R2_PUBLIC_BASE_URL;
    vi.resetModules(); // beforeEach'in cache'lediği modülü unutturmak şart
    const { extractStorageKey } = await import("../storage");
    // External URL without configured base → null (defensive)
    expect(
      extractStorageKey("https://files.palimps.app/uploads/3/abc.jpg"),
    ).toBe(null);
  });

  it("handles trailing slash in R2_PUBLIC_BASE_URL idempotently", async () => {
    process.env.R2_PUBLIC_BASE_URL = "https://files.palimps.app/";
    vi.resetModules();
    const { extractStorageKey } = await import("../storage");
    expect(
      extractStorageKey("https://files.palimps.app/uploads/3/abc.jpg"),
    ).toBe("uploads/3/abc.jpg");
  });

  it("does NOT match URLs with prefix-only similarity", async () => {
    // "files.palimps.app.evil.com/..." başlangıcı bizim base ile eşleşse de
    // tam path eşleşmesi olmadığı için null dönmeli — security-relevant.
    const { extractStorageKey } = await import("../storage");
    expect(
      extractStorageKey(
        "https://files.palimps.app.evil.com/uploads/3/abc.jpg",
      ),
    ).toBe(null);
  });
});
