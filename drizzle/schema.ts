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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
