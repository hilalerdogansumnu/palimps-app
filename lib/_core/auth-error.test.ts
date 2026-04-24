import { describe, it, expect } from "vitest";
import { isSessionExpireError } from "./auth-error";

/**
 * Session expire detection — app/_layout.tsx global onError interceptor'ının
 * dayandığı tek pure function. Bu testler 3 kritik kanalı korur:
 *
 *   1. httpStatus 401 — tRPC server UNAUTHORIZED döndürdüğünde
 *   2. data.code === "UNAUTHORIZED" — tRPC structured error code
 *   3. "Please login" prefix'li message — backend custom "10001" path'i
 *
 * False positive olmamasi kritik: eğer auth ERROR olmayan bir error
 * (network, rate-limit, validation) yanlışlıkla match ederse kullanıcı
 * ortasında login'e atılır → veri kaybı + UX felaketi. Her negative
 * case'i de testle sabitliyoruz.
 */
describe("isSessionExpireError — positive cases (session expire)", () => {
  it("detects tRPC httpStatus 401", () => {
    const err = {
      data: { httpStatus: 401 },
      message: "Unauthorized",
    };
    expect(isSessionExpireError(err)).toBe(true);
  });

  it("detects tRPC code UNAUTHORIZED", () => {
    const err = {
      data: { code: "UNAUTHORIZED" },
      message: "missing auth",
    };
    expect(isSessionExpireError(err)).toBe(true);
  });

  it("detects 'Please login (10001)' backend message", () => {
    const err = { message: "Please login (10001)" };
    expect(isSessionExpireError(err)).toBe(true);
  });

  it("detects 'Please login' message regardless of case", () => {
    const err = { message: "PLEASE LOGIN to continue" };
    expect(isSessionExpireError(err)).toBe(true);
  });

  it("detects 'Please login' with trailing content", () => {
    const err = { message: "Please login again — session expired" };
    expect(isSessionExpireError(err)).toBe(true);
  });

  it("detects 401 even if message is generic", () => {
    const err = { data: { httpStatus: 401 } };
    expect(isSessionExpireError(err)).toBe(true);
  });
});

describe("isSessionExpireError — negative cases (NOT session expire)", () => {
  it("does not match rate-limit errors", () => {
    const err = {
      data: { httpStatus: 429, code: "TOO_MANY_REQUESTS" },
      message: "RATE_LIMIT_EXCEEDED",
    };
    expect(isSessionExpireError(err)).toBe(false);
  });

  it("does not match 500 internal errors", () => {
    const err = {
      data: { httpStatus: 500, code: "INTERNAL_SERVER_ERROR" },
      message: "Something went wrong",
    };
    expect(isSessionExpireError(err)).toBe(false);
  });

  it("does not match 403 FORBIDDEN (premium gates)", () => {
    // FORBIDDEN = permission yok, login var — kullanıcıyı logout etmek yanlış
    const err = {
      data: { httpStatus: 403, code: "FORBIDDEN" },
      message: "MOMENT_LIMIT_REACHED",
    };
    expect(isSessionExpireError(err)).toBe(false);
  });

  it("does not match network / connection errors", () => {
    const err = new Error("Network request failed");
    expect(isSessionExpireError(err)).toBe(false);
  });

  it("does not match validation errors with 'login' substring", () => {
    // "Last login was 3 days ago" gibi benign bir mesaj — "please login"
    // regex'i prefix-anchored olduğu için false positive vermemeli
    const err = { message: "User last login was 3 days ago" };
    expect(isSessionExpireError(err)).toBe(false);
  });

  it("returns false for null / undefined", () => {
    expect(isSessionExpireError(null)).toBe(false);
    expect(isSessionExpireError(undefined)).toBe(false);
  });

  it("returns false for primitive string error", () => {
    expect(isSessionExpireError("just a string")).toBe(false);
  });

  it("returns false for primitive number", () => {
    expect(isSessionExpireError(401)).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(isSessionExpireError({})).toBe(false);
  });

  it("does not match when message is empty string", () => {
    expect(isSessionExpireError({ message: "" })).toBe(false);
  });
});

describe("isSessionExpireError — boundary cases", () => {
  it("handles nested data with httpStatus as string (coerce safe)", () => {
    // Eğer bir gün backend httpStatus'ı string olarak gönderirse strict
    // equality ile eşleşmez — bu beklenen davranış (type safety).
    const err = { data: { httpStatus: "401" as unknown as number } };
    expect(isSessionExpireError(err)).toBe(false);
  });

  it("matches when httpStatus 401 is set even without other fields", () => {
    const err = { data: { httpStatus: 401 } };
    expect(isSessionExpireError(err)).toBe(true);
  });

  it("does not match when message has 'login' but not at start", () => {
    // "Please login" is anchor'ed to start. "Error: please login required"
    // should NOT match because regex is ^please login.
    const err = { message: "Error: please login required" };
    expect(isSessionExpireError(err)).toBe(false);
  });
});
