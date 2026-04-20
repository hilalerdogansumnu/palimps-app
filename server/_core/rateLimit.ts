import { RateLimiterMemory, type RateLimiterAbstract } from "rate-limiter-flexible";

/**
 * Per-user rate limiter buckets for LLM-backed procedures.
 *
 * Faz 1.4 — abuse koruması: tek bir kullanıcı hesabı veya ele geçirilmiş
 * token sınırsız Gemini çağrısı yapamasın.
 *
 * 50325 — freemium paketiyle tiered limitler: free kullanıcı zaten content
 * cap'leriyle (10 lifetime Hafıza sorusu, 5 kitap × 10 an) sınırlı, rate-
 * limit bucket'ı onlar için sadece abuse-guard. Pro kullanıcı rahat nefes
 * alsın diye daha yüksek tavan; gizli, pazarlama "sınırsız" der.
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

// --- FREE TIER (abuse-guard, content cap'leriyle çifte korumalı) ---

// Chat: kullanıcı başına saatte 20 mesaj. Free user zaten 10 lifetime
// cap'inde; bu bucket gerçekten abuse-guard (tek saat içinde scripted 20+
// deneme = bot sinyali, hesap ömür boyu toplam 10'un üstüne çıkamaz).
export const chatLimiterFree: RateLimiterAbstract = new RateLimiterMemory({
  keyPrefix: "rl_chat_free",
  points: 20,
  duration: 60 * 60, // saniye
});

// OCR: kullanıcı başına günde 50 sayfa.
// Yoğun okuyan bile günde 50 farklı sayfa fotoğraflamaz; abuse tavanı.
// readingMoments.create, ai.generateNote, books.extractCoverMetadata aynı
// bucket'ı paylaşır — hepsi flash-lite çağrısı, maliyetleri eş.
export const ocrLimiterFree: RateLimiterAbstract = new RateLimiterMemory({
  keyPrefix: "rl_ocr_free",
  points: 50,
  duration: 24 * 60 * 60,
});

// --- PRO TIER (pazarlama "sınırsız", gerçekte iki katmanlı abuse-guard) ---

// Pro chat hour: dakikada ~1 mesaj. Yoğun seansta bile yetiyor, scripted
// abuser saatte 40 mesajı hızlı geçer.
export const chatLimiterProHour: RateLimiterAbstract = new RateLimiterMemory({
  keyPrefix: "rl_chat_pro_hr",
  points: 40,
  duration: 60 * 60,
});

// Pro chat day: 7/24 sustained abuse'a karşı ikinci çember. 300/gün = saatte
// ort. 12.5 — honest power user rahat geçer, abuser durur.
export const chatLimiterProDay: RateLimiterAbstract = new RateLimiterMemory({
  keyPrefix: "rl_chat_pro_day",
  points: 300,
  duration: 24 * 60 * 60,
});

// Pro OCR: free'nin 2 katı. Bir kitabı bir seansta tarayan honest kullanıcı
// rahatça 50+ fotoğraf çekebilir; 100/gün bu kullanıcıya kapıyı aralıyor
// ama farmer'a engel.
export const ocrLimiterPro: RateLimiterAbstract = new RateLimiterMemory({
  keyPrefix: "rl_ocr_pro",
  points: 100,
  duration: 24 * 60 * 60,
});
