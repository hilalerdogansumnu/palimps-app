import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /**
   * Stable, namespaced auth identifier returned by the native sign-in flow.
   * Format: "apple:<apple sub>" or "google:<google sub>". Unique per user.
   */
  openId: varchar("openId", { length: 128 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /**
   * Apple Sign In refresh token. Capture: `/api/auth/apple` endpoint exchanges
   * `authorizationCode` (gelmesi opsiyonel) at Apple's `/auth/token` endpoint
   * and persists the resulting refresh_token here. Used at delete-account time
   * to call Apple's `/auth/revoke` (App Store 5.1.1(v) since iOS 16).
   *
   * NULLABLE — and stays NULL for "legacy" users (signed in before this column
   * was added, or before client started sending authorizationCode). On delete
   * for those users, revoke step is skipped with a warning log + Sentry
   * breadcrumb; DB + R2 cleanup still proceeds (KVKK Md. 7 yine yerine
   * geliyor, sadece Apple OAuth linkage iOS Settings'te user'a kalıyor).
   *
   * Length 512: Apple refresh tokens are typically ~150-200 chars but the spec
   * doesn't pin a max — generous margin. Not indexed (read once per
   * delete-account, not a hot path).
   */
  appleRefreshToken: varchar("appleRefreshToken", { length: 512 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isPremium: int("isPremium").default(0).notNull(), // 0 = free, 1 = premium
  /**
   * Freemium lifetime counter: number of SUCCESSFUL Hafıza assistant
   * responses this user has consumed. Free tier cap = 10. Never decremented;
   * upgrading to Pro bypasses the gate entirely (Pro path doesn't read it).
   * Increment ONLY after a successful LLM response — user shouldn't lose
   * a question to our infrastructure errors.
   */
  freeAssistantQuestionsUsed: int("freeAssistantQuestionsUsed").default(0).notNull(),
  /**
   * RevenueCat product identifier of the currently active entitlement.
   * Set by the webhook on activation events, cleared on cancellation.
   */
  revenuecatProductId: varchar("revenuecatProductId", { length: 255 }),
  /**
   * Unix epoch (ms) when the current entitlement expires. Used to short-circuit
   * premium gates without having to call RevenueCat on every request.
   */
  revenuecatExpiresAt: timestamp("revenuecatExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Books table - Kullanıcının eklediği kitaplar
 */
export const books = mysqlTable("books", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  author: varchar("author", { length: 255 }),
  coverImageUrl: text("coverImageUrl"), // S3 URL
  /**
   * Archived books are hidden from the default library list (swipe-to-archive
   * flow). They're preserved in the DB so the user can restore them later
   * from a dedicated "Arşiv" screen (roadmap).
   */
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Reading Moments table - Kullanıcının okuma anları
 */
export const readingMoments = mysqlTable("reading_moments", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull(),
  userId: int("userId").notNull(),
  pageImageUrl: text("pageImageUrl").notNull(), // S3 URL - sayfa fotoğrafı
  ocrText: text("ocrText"), // OCR ile çıkarılan metin
  userNote: text("userNote"), // Kullanıcının notu (opsiyonel)
  /**
   * Gemini enrichment — ana fikri tek cümlede özetler. Library scroll'unda
   * moment kartının altında scan-edilebilir bir alt satır olarak gösterilir.
   * 280 karakter = Twitter sınırına denk gelir, LLM doğal olarak kısa kalır
   * ve DB'de varchar kolon indekslenebilir. LLM null/boş dönerse null kalır —
   * UI fallback olarak ocrText'in ilk cümlesini gösterir.
   */
  summary: varchar("summary", { length: 280 }),
  /**
   * Gemini enrichment — 2-3 tematik etiket (örn: ["varoluşçuluk", "ölüm"]).
   * Türkçe, küçük harf, normalize edilmiş (tag chip UI ve cross-book theme
   * browser için). JSON kolon çünkü sayı düşük (≤3) ve sorgular basit —
   * ayrı bir moment_tags relation tablosu şu an overkill. Null = enrichment
   * fail oldu ya da metin çok kısaydı; [] değil null tercih ediyoruz çünkü
   * "denedik ama çıkmadı" ile "boş sonuç" aynı şey değil.
   */
  tags: json("tags").$type<string[]>(),
  /**
   * Phase B markings — Gemini full flash (handwriting kalitesi gerektiriyor).
   * highlights = sayfada altı çizili / fosforlu işaretlenmiş METİN parçaları.
   * Her entry: { text, kind: "highlighter" | "underline" }.
   * Maks 10 entry — uzun pasajlardan parmak/gölge sızıntısı yiyebileceğimiz
   * için schema-level cap. JSON kolon: ilişkisel ayrı tablo overkill (ortalama
   * ≤3 entry beklentisi, sorgu basit).
   *
   * null vs [] semantik AYRI: null = "henüz markings extraction çalıştırılmadı"
   * (ENV.enableMarkingCapture=false veya retroactive backfill yok), [] = "
   * çalıştırıldı, sayfada işaret bulunamadı". UI iki state'i farklı
   * göstermeli — null'da "henüz inceleme yapılmadı", []'de hiç gösterme.
   */
  highlights: json("highlights").$type<HighlightEntry[]>(),
  /**
   * Phase B marginalia — el yazısı kenar notları.
   * Her entry: { text }. Sıralama = okuma yönü (yukarıdan aşağıya).
   * Anchor / position alanı YOK (Gate 3 kararı): el yazısı formu zaten
   * hoş, konumu metinle ilişkilendirmek için coordinate-level data
   * Gemini'den güvenilir gelmiyor. v1.x'te AN detay ekranında "kenar
   * notları" başlığı altında liste olarak gösterilecek.
   *
   * null/[] ayrımı highlights ile aynı.
   */
  marginalia: json("marginalia").$type<MarginaliaEntry[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Phase B markings shapes. JSON column type guards — Drizzle infer'lar
 * otomatik kullanır, server tarafında parse sonrası bu tiplere narrow.
 *
 * kind alanı:
 * - "highlighter": fosforlu kalem (sarı/turuncu/yeşil)
 * - "underline":  altı çizili (kalem / tükenmez)
 * Renk YOK (Gate 3 kararı — karmaşa, sonradan eklenebilir).
 */
export type HighlightEntry = {
  text: string;
  kind: "highlighter" | "underline";
};

export type MarginaliaEntry = {
  text: string;
};

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;

export type ReadingMoment = typeof readingMoments.$inferSelect;
export type InsertReadingMoment = typeof readingMoments.$inferInsert;

/**
 * Subscriptions table - Premium abonelik bilgileri
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  plan: mysqlEnum("plan", ["free", "premium"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "expired", "cancelled"]).default("active").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // null = lifetime premium
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;
