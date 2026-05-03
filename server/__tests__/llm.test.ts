import { describe, it, expect } from "vitest";
import { isTransientLLMError, detectOcrRepetition } from "../_core/llm";

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

  describe("AbortSignal.timeout (transient — Bug #5 May 2026 fix)", () => {
    it("TimeoutError name → transient (AbortSignal.timeout fırlatır)", () => {
      // AbortSignal.timeout() Node 20+ DOMException name "TimeoutError"
      // fırlatır. Mesaj genelde boş olabilir; name path retry tetiklemeli.
      const err = new Error("");
      err.name = "TimeoutError";
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("AbortError name → transient (manuel abort)", () => {
      // controller.abort() ile fırlatılan DOMException name "AbortError".
      // Test/manuel cancel senaryosunda da transient sayılır.
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      expect(isTransientLLMError(err)).toBe(true);
    });

    it("name farklı, mesaj 'aborted' içerse bile name path tetiklemiyorsa keyword path bakar", () => {
      // Generic Error name "Error", mesajda "aborted" yok → permanent
      const err = new Error("something else broke");
      expect(isTransientLLMError(err)).toBe(false);
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

/**
 * Bug #5 (May 2026) regression suite. OCR repetition loop:
 * - May 1 21:30: Sf 110 fotoğrafı için Gemini OCR aynı 70-char cümleyi
 *   ~500 kez tekrar üretti (~35 KB ham text), readingMoments INSERT 1m36s
 *   asılı kaldıktan sonra 500 fırlattı, client "Hazırlanıyor..." stuck.
 * - Sentry PALIMPS-IOS-6'da yakalandı (1 user, 1 event), Sf 110 second-an
 *   tekrarda May 2'de yine görüldü (kill restart, log alınamadı).
 *
 * Bu testler regression: detectOcrRepetition true döndüğünde caller
 * (server/routers.ts > runOcr) throw eder, outer try/catch retry tetikler.
 */
describe("detectOcrRepetition", () => {
  describe("repetition tespit edilir", () => {
    it("Bug #5 prod kanıtı: aynı 70-char cümle 100 kez tekrar", () => {
      // Sentry breadcrumb'tan birebir cümle (PII koruma için kelime
      // değiştirildi ama uzunluk + tekrar pattern aynı).
      const sentence = "Senin gerçeklik olanın dünyasında hareket etmeyi bütünüyle yitirirler.\n";
      const text = sentence.repeat(100);
      expect(detectOcrRepetition(text)).toBe(true);
    });

    it("aynı 50-char window 6 kez geçince true (threshold sınırında)", () => {
      // Window 50 char × 6 occurrence = threshold (>5) tetikler. Edge case.
      const chunk = "Bu cümle elli karakter uzunluğunda bir test girişidir.\n";
      // chunk = 56 char, 8 kez tekrar = 448 char, 50-char window'lar
      // threshold'u rahat aşar.
      expect(detectOcrRepetition(chunk.repeat(8))).toBe(true);
    });

    it("repetition metnin sonunda olsa bile yakalanır (sliding window)", () => {
      const intro =
        "Birinci paragraf normal, kitap içeriği gibi. İkinci paragraf yine normal.\n\n";
      const repeated = "Aynı cümle defalarca üst üste yazılıyor.\n".repeat(20);
      expect(detectOcrRepetition(intro + repeated)).toBe(true);
    });
  });

  describe("repetition YOK — false döner (false-positive olmamalı)", () => {
    it("normal kitap sayfası metni — paragraflar farklı içerikte", () => {
      // ~500 char gerçek metin tarzı, hiçbir 50-char substring tekrarlamıyor.
      const text =
        "Yazlığa giderken yolda hep aynı tabela vardı. Babam okurdu, ben gözüm" +
        " kapalı tekrarlardım. Şimdi otoyola çıktığımızda tabela yok artık.\n\n" +
        "Eski yolda durağanlık vardı, şimdiki yolda ise hız. İkisi aynı yere" +
        " götürüyor ama farklı şeyler hatırlatıyor. Anılar tabelaya yapışıktı.\n\n" +
        "Bazen düşünüyorum: tabelayı kim kaldırdı? Belki yıkıldı, belki" +
        " kasıtlı söküldü. Cevabını bilmemek de bir tür hatırlama biçimi.";
      expect(detectOcrRepetition(text)).toBe(false);
    });

    it("kısa metin (<250 char) → false (threshold reach edilemez)", () => {
      const short = "Kısa bir paragraf.\n".repeat(5);
      expect(short.length).toBeLessThan(250);
      expect(detectOcrRepetition(short)).toBe(false);
    });

    it("boş string → false", () => {
      expect(detectOcrRepetition("")).toBe(false);
    });

    it("tek cümle, çok uzun ama tekrarsız → false", () => {
      // 500 char tek paragraf, hiçbir substring tekrarı yok.
      const long =
        "Annem o kış bana bir defter aldı, kapağı koyu yeşil, içinde çizgili" +
        " yapraklar vardı. Defterin ilk sayfasına 'her gün üç cümle yaz'" +
        " yazmıştı; ikinci sayfasında benim çocuksu bir cümlem vardı," +
        " üçüncüsünde annemin nazik düzeltmesi. O defteri yıllar sonra bir" +
        " kutudan çıkardım, kalemiyle yazdığı 'aferin' kelimesini gördüm" +
        " ve uzun bir süre eve ulaşamadım, sokakta öyle durdum.";
      expect(detectOcrRepetition(long)).toBe(false);
    });

    it("aynı cümle 4 kez → false (threshold >5)", () => {
      const sentence = "Bu cümle dört kez tekrar ediyor sadece, threshold'un altında.\n";
      // 4 kez = 256 char, threshold reach edilmez
      expect(detectOcrRepetition(sentence.repeat(4))).toBe(false);
    });
  });
});
