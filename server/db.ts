import { and, eq, desc, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, books, readingMoments, InsertBook, InsertReadingMoment } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { extractStorageKey, storageDeleteMany } from "./storage";
import { isAppleRevocationConfigured, revokeAppleRefreshToken } from "./_core/apple-auth-revoke";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// BOOKS
// ============================================

/**
 * Kullanıcının tüm kitaplarını listele.
 *
 * Varsayılan olarak arşivlenmiş kitaplar HARİÇ tutulur — Kitaplarım ekranı
 * arşivi göstermiyor. `includeArchived` ile arşiv ekranı (gelecek) için
 * aynı query'yi kullanabiliriz.
 *
 * Not: 0005 migration'ı henüz çalışmamış production ortamlarda `archived`
 * sütunu yok. Bu durumda `.where(archived=false)` "Unknown column"
 * patlatmasın diye önce sütunun varlığını şüpheye düşmeden
 * `includeArchived=true` ise filtresiz, aksi halde
 * `archived != true` koşulu kullanıyoruz. DEFAULT false olduğu için
 * mevcut kayıtlar otomatik "aktif" kalır.
 */
export async function getUserBooks(
  userId: number,
  opts: { includeArchived?: boolean } = {},
) {
  const db = await getDb();
  if (!db) return [];

  const where = opts.includeArchived
    ? eq(books.userId, userId)
    : and(eq(books.userId, userId), eq(books.archived, false));

  return db
    .select()
    .from(books)
    .where(where)
    .orderBy(desc(books.createdAt));
}

/**
 * Kitap ID'sine göre kitap getir
 */
export async function getBookById(bookId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
  return result[0] || null;
}

/**
 * Yeni kitap oluştur
 */
export async function createBook(data: InsertBook) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(books).values(data);
  return Number(result[0].insertId);
}

/**
 * Kitap güncelle
 */
export async function updateBook(bookId: number, data: Partial<InsertBook>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(books).set(data).where(eq(books.id, bookId));
}

/**
 * Kitap sil
 */
export async function deleteBook(bookId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Önce kitaba ait tüm okuma anlarını sil
  await db.delete(readingMoments).where(eq(readingMoments.bookId, bookId));
  
  // Sonra kitabı sil
  await db.delete(books).where(eq(books.id, bookId));
}

// ============================================
// READING MOMENTS
// ============================================

/**
 * Kitaba ait tüm okuma anlarını listele (zaman çizgisi)
 */
export async function getReadingMomentsByBook(bookId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(readingMoments)
    .where(eq(readingMoments.bookId, bookId))
    .orderBy(desc(readingMoments.createdAt));
}

/**
 * Bir tema etiketine (tag) sahip TÜM an'lar — cross-book tema browser.
 * AN detay'daki tag chip'ine basınca bu sorgu çalışır.
 *
 * MySQL JSON_CONTAINS + JSON_QUOTE: `tags` JSON array ("["aşk","ölüm"]"
 * gibi). JSON_QUOTE ile parametre `"aşk"` formatına çevrilir — bu tam
 * elemanla (exact match) eşleşir, substring değil. Büyük/küçük harf
 * eşleşmesi için etiket DB'ye yazılırken normalizeTag() ile küçük harfe
 * indiriliyor (prompts.ts); tRPC prosedürü de aynı normalize'dan geçirir.
 *
 * Book title join: tag detay ekranı cross-book olduğu için kullanıcının
 * "hangi kitaptan" olduğunu bilmesi lazım. Tek sorguda left join yapıyoruz
 * — N+1 almamak için.
 */
export async function getReadingMomentsByTag(userId: number, tag: string) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      moment: readingMoments,
      bookTitle: books.title,
    })
    .from(readingMoments)
    .leftJoin(books, eq(readingMoments.bookId, books.id))
    .where(
      and(
        eq(readingMoments.userId, userId),
        sql`JSON_CONTAINS(${readingMoments.tags}, JSON_QUOTE(${tag}))`,
      ),
    )
    .orderBy(desc(readingMoments.createdAt));

  return rows.map((r) => ({ ...r.moment, bookTitle: r.bookTitle }));
}

/**
 * Okuma anı ID'sine göre okuma anı getir
 */
export async function getReadingMomentById(momentId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(readingMoments).where(eq(readingMoments.id, momentId)).limit(1);
  return result[0] || null;
}

/**
 * Yeni okuma anı oluştur
 */
export async function createReadingMoment(data: InsertReadingMoment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(readingMoments).values(data);
  return Number(result[0].insertId);
}

/**
 * Okuma anı güncelle
 */
export async function updateReadingMoment(momentId: number, data: Partial<InsertReadingMoment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(readingMoments).set(data).where(eq(readingMoments.id, momentId));
}

/**
 * Okuma anı sil
 */
export async function deleteReadingMoment(momentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(readingMoments).where(eq(readingMoments.id, momentId));
}

/**
 * Kitaba ait okuma anı sayısını getir
 */
export async function getReadingMomentCount(bookId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const moments = await db
    .select()
    .from(readingMoments)
    .where(eq(readingMoments.bookId, bookId));

  return moments.length;
}

// ============================================
// SEARCH
// ============================================

/**
 * Kitaplarda arama yap (başlık ve yazar)
 */
export async function searchBooks(userId: number, query: string) {
  const db = await getDb();
  if (!db) return [];

  const allBooks = await db
    .select()
    .from(books)
    .where(eq(books.userId, userId));

  const lowerQuery = query.toLowerCase();
  
  return allBooks.filter((book) => {
    const titleMatch = book.title.toLowerCase().includes(lowerQuery);
    const authorMatch = book.author?.toLowerCase().includes(lowerQuery) ?? false;
    return titleMatch || authorMatch;
  });
}

/**
 * Okuma anlarında arama yap (OCR metni ve kullanıcı notu)
 */
export async function searchReadingMoments(userId: number, query: string) {
  const db = await getDb();
  if (!db) return [];

  // Önce kullanıcının kitaplarını al
  const userBooks = await getUserBooks(userId);
  const bookIds = userBooks.map((b) => b.id);

  if (bookIds.length === 0) return [];

  // Tüm okuma anlarını al
  const allMoments = await Promise.all(
    bookIds.map((bookId) => getReadingMomentsByBook(bookId))
  );
  const moments = allMoments.flat();

  const lowerQuery = query.toLowerCase();
  
  return moments.filter((moment) => {
    const ocrMatch = moment.ocrText?.toLowerCase().includes(lowerQuery) ?? false;
    const noteMatch = moment.userNote?.toLowerCase().includes(lowerQuery) ?? false;
    return ocrMatch || noteMatch;
  });
}

/**
 * Kullanıcının premium durumunu güncelle
 */
export async function updateUserPremiumStatus(userId: number, isPremium: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ isPremium: isPremium ? 1 : 0 })
    .where(eq(users.id, userId));
}

/**
 * Kullanıcı bilgilerini güncelle (partial update)
 */
export async function updateUser(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set(data)
    .where(eq(users.id, userId));
}

/**
 * Kullanıcıyı ve tüm verilerini sil (App Store Guideline 5.1.1.v + KVKK Md. 7).
 *
 * Sıra:
 *  0. Apple Sign In refresh token'ı revoke et (best-effort) — App Store
 *     5.1.1(v): iOS 16+ delete-account akışı Apple OAuth linkage'ı koparmak
 *     zorunda. User row'u henüz duruyor, token oradan okunabilir.
 *  1. Photo URL'leri topla (silmeden önce, satırlar gittikten sonra erişim yok)
 *  2. R2'den fotoğrafları toplu sil — best-effort, KVKK "teknik retention
 *     kabul edilmez" gereği ve privacy policy'deki açık taahhüt:
 *       "Fotoğraflar (R2): Hesap silindiği anda kalıcı olarak silinir"
 *  3. DB cascade — moments → books → user
 *
 * Apple revoke hatası DB+R2 silmeyi BLOKLAMAZ — KVKK Md. 7 yine yerine
 * getirilir, sadece Apple OAuth linkage iOS Settings'te kullanıcıya kalır
 * (manuel "Stop Using Apple ID" gerekebilir). R2 silme hatası da DB silmeyi
 * bloklamaz; orphan R2 objeleri sweeper job (TODO) tarafından sonradan
 * toplanır.
 *
 * Legacy user kısıtı: refresh token sadece bu fix DEPLOY edildikten sonraki
 * ilk sign-in'de yakalanır. Önceden sign in olmuş kullanıcılarda token
 * yoktur → revoke skip + warning log; KVKK silme yine tam çalışır.
 */
export async function deleteUserAndAllData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 0. Apple Sign In revocation (best-effort) — App Store 5.1.1(v).
  //    User row'u henüz duruyor, token oradan okunabilir. Hata DB+R2
  //    silmeyi BLOKLAMAZ — KVKK Md. 7 yine yerine getirilir, sadece
  //    Apple OAuth linkage iOS Settings'te kullanıcıya kalır.
  if (isAppleRevocationConfigured()) {
    const [row] = await db
      .select({ token: users.appleRefreshToken })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (row?.token) {
      try {
        await revokeAppleRefreshToken(row.token);
        console.log("[deleteAccount] Apple token revoked", { userId });
      } catch (err) {
        // TODO(observability): Sentry.captureMessage("apple_revoke_failed", "warning")
        console.warn("[deleteAccount] Apple revoke failed (non-blocking)", {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      console.warn("[deleteAccount] Apple revoke skipped — no refresh token (legacy user)", { userId });
    }
  }

  // 1. Photo URL'leri topla — book covers + reading_moments page images.
  //    DB silindikten sonra erişim yok, bu yüzden ÖNCE topluyoruz.
  const userBooks = await db
    .select({ id: books.id, coverImageUrl: books.coverImageUrl })
    .from(books)
    .where(eq(books.userId, userId));

  const userMoments = await db
    .select({ pageImageUrl: readingMoments.pageImageUrl })
    .from(readingMoments)
    .where(eq(readingMoments.userId, userId));

  const photoKeys: string[] = [];
  for (const book of userBooks) {
    const k = extractStorageKey(book.coverImageUrl);
    if (k) photoKeys.push(k);
  }
  for (const m of userMoments) {
    const k = extractStorageKey(m.pageImageUrl);
    if (k) photoKeys.push(k);
  }

  // 2. R2 cleanup — best-effort, KVKK Md. 7 hard-delete + privacy policy
  //    promise. Hata olsa bile DB silmeye devam ediyoruz.
  const r2Result = await storageDeleteMany(photoKeys);
  console.log("[deleteAccount] R2 photo cleanup", {
    userId,
    requested: photoKeys.length,
    deleted: r2Result.deleted,
    failed: r2Result.failed,
  });

  // 3. DB cascade. Moments'i userId üstünden topluca siliyoruz —
  //    book.id loop'u yerine — orphan moment'lere karşı (book silinip
  //    moment kalmış pre-existing edge case) defansif.
  await db.delete(readingMoments).where(eq(readingMoments.userId, userId));
  await db.delete(books).where(eq(books.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

/**
 * ID ile kullanıcı bul
 */
export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user || null;
}

// ============================================
// FREEMIUM COUNTERS
// ============================================

/**
 * Kullanıcının aktif (arşivlenmemiş) kitap sayısını döndür.
 * Ücretsiz tier 5 aktif kitap cap'inde kullanılır — arşivleyince slot açılır.
 */
export async function countActiveBooks(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const rows = await db
    .select({ id: books.id })
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.archived, false)));

  return rows.length;
}

/**
 * Son N gün içinde (rolling window) bu kullanıcı tarafından oluşturulmuş
 * kitap sayısını döndür. Pro tier 100/ay (30 gün) sanity cap'i için.
 * Archived olsa bile sayılır — bu bir yaratım sayacı, stok değil.
 */
export async function countBooksCreatedSince(
  userId: number,
  since: Date,
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const rows = await db
    .select({ id: books.id })
    .from(books)
    .where(and(eq(books.userId, userId), gte(books.createdAt, since)));

  return rows.length;
}

/**
 * `freeAssistantQuestionsUsed` sayacını atomik olarak bir artır.
 * SUCCESSFUL LLM cevabından sonra çağrılır — user shouldn't lose a question
 * to infrastructure errors. Pro kullanıcıda hiç çağrılmaz.
 */
export async function incrementFreeAssistantQuestions(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({
      freeAssistantQuestionsUsed: sql`${users.freeAssistantQuestionsUsed} + 1`,
    })
    .where(eq(users.id, userId));
}
