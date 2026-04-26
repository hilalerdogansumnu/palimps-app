/**
 * server/_core/apple-auth-revoke.ts — unit testleri.
 *
 * Apple sandbox = prod (ayrı test env yok), o yüzden gerçek HTTP atılmaz —
 * `globalThis.fetch` mock'lanır. Apple `/auth/token` ve `/auth/revoke`
 * endpoint'lerinin contract'ı (URL, content-type, form fields, response
 * shape, error semantics) burada kilitlenir.
 *
 * Kapsam:
 *  - `isAppleRevocationConfigured()` → 4 env var kombinasyonu
 *  - `generateAppleClientSecret()` → ES256 JWT, claim doğrulama (jwtVerify
 *    ile gerçek imza kontrolü, sadece decode değil)
 *  - `exchangeAppleAuthorizationCode()` → fetch body assert, 200/400/missing
 *    field branch'leri
 *  - `revokeAppleRefreshToken()` → fetch body assert, 200/4xx branch'leri
 *
 * Loglama disiplini test'lerde de geçerli — assertion'lar kesinlikle
 * refresh_token / authorizationCode değerlerinin string'ini test çıktısına
 * basmamalı (yalnızca varlığını / eşitliğini kontrol).
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import {
  generateKeyPair,
  exportPKCS8,
  jwtVerify,
  decodeProtectedHeader,
} from "jose";

// ─────────────────────────────────────────────────────────────────────────
// Test fixtures — gerçek ES256 keypair generate ediliyor (jose üstünden,
// node:crypto manual çağırmaktan daha az yüzey). Public key claim
// doğrulamasında kullanılır, private key .p8 PEM olarak env'e basılır.
// ─────────────────────────────────────────────────────────────────────────

const TEST_BUNDLE_ID = "test.bundle.id";
const TEST_TEAM_ID = "TESTTEAM01";
const TEST_KEY_ID = "TESTKEYID1";

let publicKey: CryptoKey;
let mod: typeof import("../_core/apple-auth-revoke");

const ORIGINAL_ENV = {
  APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID,
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
  APPLE_SIGN_IN_KEY_ID: process.env.APPLE_SIGN_IN_KEY_ID,
  APPLE_SIGN_IN_PRIVATE_KEY: process.env.APPLE_SIGN_IN_PRIVATE_KEY,
};

beforeAll(async () => {
  // jose v6 default'u extractable=false → exportPKCS8 throw eder ("CryptoKey
  // is not extractable"). Test'te .p8 PEM'i env'e basacağımız için
  // extractable: true zorunlu.
  const kp = await generateKeyPair("ES256", { extractable: true });
  publicKey = kp.publicKey;
  const pem = await exportPKCS8(kp.privateKey);

  process.env.APPLE_BUNDLE_ID = TEST_BUNDLE_ID;
  process.env.APPLE_TEAM_ID = TEST_TEAM_ID;
  process.env.APPLE_SIGN_IN_KEY_ID = TEST_KEY_ID;
  process.env.APPLE_SIGN_IN_PRIVATE_KEY = pem;

  // ENV nesnesi modül load'unda dondurulduğu için (server/_core/env.ts:8)
  // `apple-auth-revoke` import'unu env set'i SONRASINDA yapıyoruz.
  vi.resetModules();
  mod = await import("../_core/apple-auth-revoke");
});

afterAll(() => {
  // Vitest worker'ı diğer dosyalara process.env sızıntısı yapmasın diye
  // restore. Undefined idiyse delete, değilse geri yaz.
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// ─────────────────────────────────────────────────────────────────────────
// fetch mock helper
// ─────────────────────────────────────────────────────────────────────────

interface MockFetchCall {
  url: string;
  init: RequestInit;
  body: URLSearchParams;
}

function mockFetchOnce(response: {
  status: number;
  json?: unknown;
  text?: string;
}): { calls: MockFetchCall[] } {
  const calls: MockFetchCall[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const body = new URLSearchParams((init?.body as string) ?? "");
      calls.push({ url, init: init ?? {}, body });
      return new Response(
        response.json !== undefined
          ? JSON.stringify(response.json)
          : (response.text ?? ""),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  );
  return { calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────
// isAppleRevocationConfigured
// ─────────────────────────────────────────────────────────────────────────

describe("isAppleRevocationConfigured", () => {
  it("returns true when all four env vars are set", () => {
    expect(mod.isAppleRevocationConfigured()).toBe(true);
  });

  it("returns false when key id is missing", async () => {
    const original = process.env.APPLE_SIGN_IN_KEY_ID;
    process.env.APPLE_SIGN_IN_KEY_ID = "";
    vi.resetModules();
    const fresh = await import("../_core/apple-auth-revoke");
    expect(fresh.isAppleRevocationConfigured()).toBe(false);
    process.env.APPLE_SIGN_IN_KEY_ID = original;
  });

  it("returns false when private key is missing", async () => {
    const original = process.env.APPLE_SIGN_IN_PRIVATE_KEY;
    process.env.APPLE_SIGN_IN_PRIVATE_KEY = "";
    vi.resetModules();
    const fresh = await import("../_core/apple-auth-revoke");
    expect(fresh.isAppleRevocationConfigured()).toBe(false);
    process.env.APPLE_SIGN_IN_PRIVATE_KEY = original;
  });
});

// ─────────────────────────────────────────────────────────────────────────
// generateAppleClientSecret
// ─────────────────────────────────────────────────────────────────────────

describe("generateAppleClientSecret", () => {
  it("returns an ES256-signed JWT with correct header (alg + kid)", async () => {
    const jwt = await mod.generateAppleClientSecret();
    const header = decodeProtectedHeader(jwt);
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe(TEST_KEY_ID);
  });

  it("issues claims that match Apple's spec", async () => {
    const before = Math.floor(Date.now() / 1000);
    const jwt = await mod.generateAppleClientSecret();
    const after = Math.floor(Date.now() / 1000);

    const { payload } = await jwtVerify(jwt, publicKey, {
      audience: "https://appleid.apple.com",
      issuer: TEST_TEAM_ID,
      subject: TEST_BUNDLE_ID,
    });

    expect(payload.iat).toBeTypeOf("number");
    expect(payload.exp).toBeTypeOf("number");
    // exp - iat tam olarak 5 dakika (300 saniye) — defence-in-depth
    expect(payload.exp! - payload.iat!).toBe(300);
    // iat şu ana yakın olmalı (saat çalıyor olabilir, ±2s marj)
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after + 1);
  });

  it("verifies with the matching public key (signature integrity)", async () => {
    const jwt = await mod.generateAppleClientSecret();
    // jwtVerify default'u signature check yapar; throw etmiyorsa imza geçerli
    await expect(jwtVerify(jwt, publicKey)).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// exchangeAppleAuthorizationCode
// ─────────────────────────────────────────────────────────────────────────

describe("exchangeAppleAuthorizationCode", () => {
  it("POSTs the correct body to /auth/token", async () => {
    const { calls } = mockFetchOnce({
      status: 200,
      json: {
        access_token: "AT.fake",
        refresh_token: "RT.fake",
        id_token: "IT.fake",
      },
    });

    await mod.exchangeAppleAuthorizationCode("AUTH_CODE_FIXTURE");

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.url).toBe("https://appleid.apple.com/auth/token");
    expect((call.init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(call.body.get("client_id")).toBe(TEST_BUNDLE_ID);
    expect(call.body.get("code")).toBe("AUTH_CODE_FIXTURE");
    expect(call.body.get("grant_type")).toBe("authorization_code");
    // client_secret bir JWT; içeriğini değil sadece varlığını kontrol et
    // (test çıktısına token-shaped string basılmasın diye `toBeTruthy`)
    expect(call.body.get("client_secret")).toBeTruthy();
  });

  it("returns the parsed token triple on 200", async () => {
    mockFetchOnce({
      status: 200,
      json: {
        access_token: "AT.fake",
        refresh_token: "RT.fake",
        id_token: "IT.fake",
      },
    });

    const result = await mod.exchangeAppleAuthorizationCode("CODE");
    expect(result).toEqual({
      accessToken: "AT.fake",
      refreshToken: "RT.fake",
      idToken: "IT.fake",
    });
  });

  it("throws with status + apple error code on non-2xx", async () => {
    mockFetchOnce({
      status: 400,
      json: { error: "invalid_grant", error_description: "bad code" },
    });

    await expect(mod.exchangeAppleAuthorizationCode("BAD")).rejects.toThrow(
      /400.*invalid_grant/,
    );
  });

  it("throws on 200 with missing required fields", async () => {
    mockFetchOnce({
      status: 200,
      json: { access_token: "AT", id_token: "IT" }, // refresh_token YOK
    });

    await expect(mod.exchangeAppleAuthorizationCode("CODE")).rejects.toThrow(
      /missing required fields/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// revokeAppleRefreshToken
// ─────────────────────────────────────────────────────────────────────────

describe("revokeAppleRefreshToken", () => {
  it("POSTs the correct body to /auth/revoke", async () => {
    const { calls } = mockFetchOnce({ status: 200, text: "" });

    await mod.revokeAppleRefreshToken("REFRESH_TOKEN_FIXTURE");

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.url).toBe("https://appleid.apple.com/auth/revoke");
    expect(call.body.get("client_id")).toBe(TEST_BUNDLE_ID);
    expect(call.body.get("token")).toBe("REFRESH_TOKEN_FIXTURE");
    expect(call.body.get("token_type_hint")).toBe("refresh_token");
    expect(call.body.get("client_secret")).toBeTruthy();
  });

  it("resolves void on 200 with empty body", async () => {
    mockFetchOnce({ status: 200, text: "" });
    await expect(mod.revokeAppleRefreshToken("RT")).resolves.toBeUndefined();
  });

  it("throws with status + apple error code on 4xx", async () => {
    mockFetchOnce({
      status: 400,
      json: { error: "invalid_request" },
    });

    await expect(mod.revokeAppleRefreshToken("RT")).rejects.toThrow(
      /400.*invalid_request/,
    );
  });

  it("throws with 'unknown' when error body is unparseable", async () => {
    mockFetchOnce({ status: 500, text: "<html>500 Internal Server Error</html>" });

    await expect(mod.revokeAppleRefreshToken("RT")).rejects.toThrow(
      /500.*unknown/,
    );
  });
});
