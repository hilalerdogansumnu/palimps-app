import { describe, it, expect } from "vitest";
import { isTransientLLMError } from "../_core/llm";

describe("isTransientLLMError", () => {
  describe("HTTP statüleri (transient)", () => {
    it("503 Service Unavailable — Gemini high-demand, gerçek prod log", () => {
      // Frame 148 prod log'undan birebir kopya — invokeLLM'in fırlattığı format
      const err = new Error(
        'LLM invoke failed: 503 Service Unavailable – [{\n' +
          '    "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",\n' +
          '    "status": "UNAVAILABLE"\n' +
          '  }\n' +
          ']',
      );
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("429 Too Many Requests — rate limit", () => {
      const err = new Error("LLM invoke failed: 429 Too Many Requests – {\"error\":\"rate_limit\"}");
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("408 Request Timeout", () => {
      const err = new Error("LLM invoke failed: 408 Request Timeout – {}");
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("500 Internal Server Error", () => {
      const err = new Error("LLM invoke failed: 500 Internal Server Error – {}");
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("502 Bad Gateway", () => {
      const err = new Error("LLM invoke failed: 502 Bad Gateway – {}");
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("504 Gateway Timeout", () => {
      const err = new Error("LLM invoke failed: 504 Gateway Timeout – {}");
      expect(isTransientLLMError(err)).toBe(true);
    });
  });

  describe("HTTP statüleri (permanent — retry edilmemeli)", () => {
    it("400 Bad Request", () => {
      const err = new Error('LLM invoke failed: 400 Bad Request – {"error":"invalid_argument"}');
      expect(isTransientLLMError(err)).toBe(false);
    });

    it("401 Unauthorized — auth sorunu, retry sadece quota harcar", () => {
      const err = new Error("LLM invoke failed: 401 Unauthorized – {}");
      expect(isTransientLLMError(err)).toBe(false);
    });

    it("403 Forbidden", () => {
      const err = new Error("LLM invoke failed: 403 Forbidden – {}");
      expect(isTransientLLMError(err)).toBe(false);
    });

    it("404 Not Found — model adı yanlış", () => {
      const err = new Error('LLM invoke failed: 404 Not Found – {"error":"model not found"}');
      expect(isTransientLLMError(err)).toBe(false);
    });

    it("422 Unprocessable Entity — content filter", () => {
      const err = new Error("LLM invoke failed: 422 Unprocessable Entity – {}");
      expect(isTransientLLMError(err)).toBe(false);
    });
  });

  describe("Gemini keyword'leri (transient)", () => {
    it("status: UNAVAILABLE (büyük harf)", () => {
      const err = new Error('something went wrong: { "status": "UNAVAILABLE" }');
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("DEADLINE_EXCEEDED — server-side timeout", () => {
      const err = new Error("DEADLINE_EXCEEDED: model took too long");
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("RESOURCE_EXHAUSTED — per-minute quota, transient'tir", () => {
      const err = new Error("RESOURCE_EXHAUSTED: quota");
      expect(isTransientLLMError(err)).toBe(true);
    });
  });

  describe("network / undici hataları (transient)", () => {
    it("ECONNRESET", () => {
      const err = new Error("fetch failed: ECONNRESET");
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("ETIMEDOUT", () => {
      const err = new Error("connect ETIMEDOUT 142.250.74.42:443");
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("EAI_AGAIN — DNS geçici hata", () => {
      const err = new Error("getaddrinfo EAI_AGAIN generativelanguage.googleapis.com");
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("Node 18+ undici fetch failed (jenerik)", () => {
      const err = new TypeError("fetch failed");
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("socket hang up", () => {
      const err = new Error("request aborted: socket hang up");
      expect(isTransientLLMError(err)).toBe(true);
    });
  });

  describe("edge case'ler", () => {
    it("permanent error — bilinmeyen string", () => {
      const err = new Error("GEMINI_API_KEY is not configured");
      expect(isTransientLLMError(err)).toBe(false);
    });

    it("plain string (Error olmayan throw)", () => {
      expect(isTransientLLMError("LLM invoke failed: 503 Service Unavailable – {}")).toBe(true);
    });

    it("undefined / null güvenli, false döner", () => {
      expect(isTransientLLMError(undefined)).toBe(false);
      expect(isTransientLLMError(null)).toBe(false);
    });

    it("boş Error.message false döner", () => {
      expect(isTransientLLMError(new Error(""))).toBe(false);
    });

    it("status field'ı 503 yazılmış JSON body — keyword path", () => {
      const err = new Error('something: { "code": 503, "status": "UNAVAILABLE" }');
      expect(isTransientLLMError(err)).toBe(true);
    });
  });
});
