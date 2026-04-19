import { RateLimiterMemory, type RateLimiterAbstract } from "rate-limiter-flexible";

/**
 * Per-user rate limiter buckets for LLM-backed procedures.
 *
 * Faz 1.4 — abuse koruması: tek bir kullanıcı hesabı veya ele geçirilmiş
 * token sınırsız Gemini çağrısı yapamasın.
 *
 * Hafıza limiter → tek Railway instance'ında çalışıyoruz; horizontal scale
 * noktasına gelirsek Redis'e (RateLimiterRedis) taşırız. O güne kadar
 * memory yeter + tek dependency less. Counter'lar server restart'ta
 * resetlenir — abuser için bir gecikme avantajı ama o da maliyet açısından
 * önemsiz (restart'lar nadir).
 *
 * tRPC middleware gerçekten kendisi `trpc.ts` içinde oluşturulur (aynı
 * `initTRPC` instance'ını paylaşmak için). Bu dosya sadece bucket
 * konfigürasyonlarını tutar.
 */

// Chat: kullanıcı başına saatte 20 mesaj.
// Bir okuma seansında 5-10 mesaj normal; 20 başka bir şeyin işareti.
export const chatLimiter: RateLimiterAbstract = new RateLimiterMemory({
  keyPrefix: "rl_chat",
  points: 20,
  duration: 60 * 60, // saniye
});

// OCR: kullanıcı başına günde 50 sayfa.
// Yoğun okuyan bile günde 50 farklı sayfa fotoğraflamaz; abuse tavanı.
// readingMoments.create ve ai.generateNote aynı bucket'ı paylaşıyor — ikisi
// de flash-lite çağırıyor, maliyetleri eş.
export const ocrLimiter: RateLimiterAbstract = new RateLimiterMemory({
  keyPrefix: "rl_ocr",
  points: 50,
  duration: 24 * 60 * 60,
});
