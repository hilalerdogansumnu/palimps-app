import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, books, readingMoments, InsertBook, InsertReadingMoment } from "../drizzle/schema";
import { ENV } from "./_core/env";

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
 * Kullanıcının tüm kitaplarını listele
 */
export async function getUserBooks(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(books)
    .where(eq(books.userId, userId))
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
