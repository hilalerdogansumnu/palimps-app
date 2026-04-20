import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  protectedProcedure,
  chatLimitedProcedure,
  ocrLimitedProcedure,
  router,
} from "./_core/trpc";
import * as db from "./db";
import { buildPublicUrl, storagePut, toDisplayUrl } from "./storage";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

function getClient(): S3Client {
  if (!ENV.r2AccountId || !ENV.r2AccessKeyId || !ENV.r2SecretAccessKey) {
    throw new Error("R2 not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ENV.r2AccessKeyId,
      secretAccessKey: ENV.r2SecretAccessKey,
    },
  });
}
import { invokeLLM } from "./_core/llm";
import { isUserPremium } from "./_core/premium";

/**
 * Freemium paket limitleri — tek yerden okunur ki pazarlama/UX değiştiğinde
 * hesaplar eşzamanlı güncellensin. Free cap'leri GÖRÜNÜR (upsell copy'de
 * gösterilir), Pro cap'leri GİZLİ (sadece abuse-guard).
 */
export const FREEMIUM_LIMITS = {
  free: {
    activeBooks: 5,
    momentsPerBook: 10,
    assistantQuestionsLifetime: 10,
  },
  pro: {
    booksPerMonth: 100, // rolling 30-day window, gizli
    momentsPerBookSanity: 500, // gizli
  },
} as const;
const PRO_BOOK_WINDOW_DAYS = 30;

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    /**
     * Current signed-in user. Client reads `isPremium` to render gated UI
     * (assistant, AI note, etc.). We MUST resolve that flag through
     * `isUserPremium` here — otherwise the allowlist (PREMIUM_TEST_EMAILS)
     * never reaches the client and founder/QA accounts see the paywall
     * despite being listed. 50320 kullanıcı raporu.
     */
    me: publicProcedure.query((opts) => {
      const user = opts.ctx.user;
      if (!user) return user;
      return {
        ...user,
        isPremium: isUserPremium(user) ? 1 : 0,
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    /**
     * Hesap silme — App Store Guideline 5.1.1.v zorunlu kılıyor.
     * Kullanıcının tüm verilerini (kitaplar, okuma anları) siler ve oturumu kapatır.
     */
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteUserAndAllData(ctx.user.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================
  // PROFILE
  // ============================================
  profile: router({
    /**
     * Kullanıcının adını güncelle.
     *
     * Apple Sign-In `fullName`'i yalnızca ilk girişte verir. Kullanıcı ilk
     * girişte isim paylaşmayı reddettiyse ya da sonra değiştirmek istiyorsa
     * tek yol bu endpoint. Client'ta `app/profile/edit-name.tsx` çağırıyor;
     * başarıdan sonra `auth.me` query'si invalidate edilir.
     *
     * 60 karakter sınırı: DB sütunu text olsa da UI tek satır avatarla kart
     * içinde render ediliyor; daha uzun değerler görsel hasara yol açıyor.
     */
    updateName: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(60),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateUser(ctx.user.id, { name: input.name });
        return { success: true, name: input.name } as const;
      }),
  }),

  // ============================================
  // BOOKS
  // ============================================
  books: router({
    /**
     * Kullanıcının tüm kitaplarını listele
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const books = await db.getUserBooks(ctx.user.id);

      // Her kitap için okuma anı sayısını + signed cover URL ekle.
      // toDisplayUrl signed URL üretir (R2 bucket public olmasa bile çalışır).
      const booksWithCounts = await Promise.all(
        books.map(async (book) => {
          const [momentCount, coverImageUrl] = await Promise.all([
            db.getReadingMomentCount(book.id),
            toDisplayUrl(book.coverImageUrl),
          ]);
          return {
            ...book,
            coverImageUrl,
            momentCount,
          };
        })
      );
      
      return booksWithCounts;
    }),

    /**
     * Kitap ID'sine göre kitap getir
     */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const book = await db.getBookById(input.id);
        if (!book || book.userId !== ctx.user.id) {
          throw new Error("Book not found");
        }
        // Kapak URL'ini signed URL'e çevir — R2 bucket public olmasa bile
        // render edilsin diye. Detay için storage.ts#toDisplayUrl.
        return {
          ...book,
          coverImageUrl: await toDisplayUrl(book.coverImageUrl),
        };
      }),

    /**
     * Yeni kitap oluştur. Freemium enforcement (50325):
     *   Free → max 5 AKTİF kitap (archived sayılmaz, rotasyon serbest)
     *   Pro  → 30-day rolling 100 kitap (abuse-guard, gizli)
     *
     * FORBIDDEN "BOOK_LIMIT_REACHED" client tarafında upsell bottom-sheet
     * açar. Archived kitabı geri döndürerek slot açma path'i yok — manuel
     * kullanıcı-driven. Client zaten pre-flight kontrol ediyor, bu server
     * check yetkisizce denenen edge case'ler için son savunma.
     */
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(500),
          author: z.string().max(255).optional(),
          coverImageBase64: z.string().max(5_000_000, "Image too large (max ~3.8MB)").optional(),
          coverImageUrl: z.string().url().optional(), // Presigned URL upload sonrası
        })
      )
      .mutation(async ({ ctx, input }) => {
        const premium = isUserPremium(ctx.user);
        if (premium) {
          const since = new Date(Date.now() - PRO_BOOK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
          const recentCount = await db.countBooksCreatedSince(ctx.user.id, since);
          if (recentCount >= FREEMIUM_LIMITS.pro.booksPerMonth) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "BOOK_MONTHLY_LIMIT",
            });
          }
        } else {
          const activeCount = await db.countActiveBooks(ctx.user.id);
          if (activeCount >= FREEMIUM_LIMITS.free.activeBooks) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "BOOK_LIMIT_REACHED",
            });
          }
        }

        let coverImageUrl: string | undefined;

        // Presigned URL ile yüklendiyse direkt kullan
        if (input.coverImageUrl) {
          coverImageUrl = input.coverImageUrl;
        } else if (input.coverImageBase64) {
          // Fallback: base64 ile yükle (eski yöntem)
          const buffer = Buffer.from(input.coverImageBase64, "base64");
          const fileName = `covers/${ctx.user.id}/${Date.now()}.jpg`;
          const result = await storagePut(fileName, buffer, "image/jpeg");
          coverImageUrl = result.url;
        }

        const bookId = await db.createBook({
          userId: ctx.user.id,
          title: input.title,
          author: input.author,
          coverImageUrl,
        });

        return { id: bookId };
      }),

    /**
     * Kitap güncelle
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(500).optional(),
          author: z.string().max(255).optional(),
          coverImageBase64: z.string().max(5_000_000, "Image too large (max ~3.8MB)").optional(),
          coverImageUrl: z.string().url().optional(), // Presigned URL upload sonrası
        })
      )
      .mutation(async ({ ctx, input }) => {
        const book = await db.getBookById(input.id);
        if (!book || book.userId !== ctx.user.id) {
          throw new Error("Book not found");
        }
        let coverImageUrl: string | undefined;
        if (input.coverImageUrl) {
          coverImageUrl = input.coverImageUrl;
        } else if (input.coverImageBase64) {
          const buffer = Buffer.from(input.coverImageBase64, "base64");
          const fileName = `covers/${ctx.user.id}/${Date.now()}.jpg`;
          const result = await storagePut(fileName, buffer, "image/jpeg");
          coverImageUrl = result.url;
        }
        await db.updateBook(input.id, {
          title: input.title,
          author: input.author,
          ...(coverImageUrl ? { coverImageUrl } : {}),
        });
        return { success: true };
      }),

    /**
     * Kitap sil
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const book = await db.getBookById(input.id);
        if (!book || book.userId !== ctx.user.id) {
          throw new Error("Book not found");
        }
        await db.deleteBook(input.id);
        return { success: true };
      }),

    /**
     * Kapak fotoğrafından başlık + yazar ayıkla — kullanıcı ekle akışında
     * kropladıktan HEMEN sonra çağrılır, saniyeler içinde form alanlarını
     * doldurur. Kullanıcı döndüreni beğenmezse düzeltip kaydedebilir.
     *
     * Neden base64 + data URL?
     * - Bu aşamada henüz R2'ye yüklenmemiş bir görüntü var. R2'ye "geçici"
     *   yükleyip OCR'dan sonra silmek DQ-02 "sahipsiz kapak" riskini büyütür.
     * - Gemini OpenAI-compat endpoint `data:image/jpeg;base64,...` URL'lerini
     *   image_url alanında kabul eder; ekstra roundtrip yok.
     * - 768×… ~120KB base64 payload, tRPC için sorun değil.
     *
     * OCR rate-limit'ini sayfa OCR'ı ile PAYLAŞIR (50/gün). Kapak OCR'ı da
     * Gemini çağrısı; ayrı sayaç olsaydı abuse yüzeyi açılırdı.
     */
    extractCoverMetadata: ocrLimitedProcedure
      .input(
        z.object({
          imageBase64: z
            .string()
            .min(1)
            .max(3_000_000, "Image too large (max ~2.2MB)"),
        }),
      )
      .mutation(async ({ input }) => {
        const dataUrl = `data:image/jpeg;base64,${input.imageBase64}`;
        const prompt = [
          "Bu bir kitap kapağı fotoğrafı. Kapaktan şu iki bilgiyi çıkar:",
          "1. Kitabın ANA başlığı",
          "2. Yazar adı",
          "",
          "KURALLAR:",
          "- Başlığı olduğu gibi yaz: tırnak, altyazı, slogan ve yayınevi adını DAHİL ETME.",
          "- Birden çok yazar varsa en belirgin olanı döndür. 'Çeviren' / 'Translated by' / 'Editör' satırlarını ATLA.",
          "- Kapakta başlık veya yazar okunmuyorsa ilgili alanı boş string ('') döndür. UYDURMA.",
          "- Çeviri yapma. Başlık Türkçe ise Türkçe, İngilizce ise İngilizce bırak.",
          "",
          "Sadece JSON döndür: { \"title\": \"...\", \"author\": \"...\" }",
        ].join("\n");

        const runExtraction = async (): Promise<{
          title: string | null;
          author: string | null;
        }> => {
          const response = await invokeLLM({
            model: ENV.geminiModelOcr,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
                ],
              },
            ],
            outputSchema: {
              name: "BookCoverMetadata",
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  author: { type: "string" },
                },
                required: ["title", "author"],
                additionalProperties: false,
              },
              strict: true,
            },
          });
          const raw = response.choices[0]?.message?.content;
          const text = typeof raw === "string" ? raw : JSON.stringify(raw);
          if (!text) return { title: null, author: null };
          try {
            const parsed = JSON.parse(text) as { title?: string; author?: string };
            const clean = (v: unknown): string | null => {
              if (typeof v !== "string") return null;
              const trimmed = v.trim();
              return trimmed.length > 0 ? trimmed : null;
            };
            return { title: clean(parsed.title), author: clean(parsed.author) };
          } catch {
            return { title: null, author: null };
          }
        };

        // OCR intermittent olabilir — sessiz başarısızlık yerine bir retry.
        // Sayfa OCR'ında aynı pattern (routers.ts §reading-moment.create).
        try {
          return await runExtraction();
        } catch (error) {
          console.error("[extractCoverMetadata] first attempt failed:", error);
          await new Promise((r) => setTimeout(r, 1200));
          try {
            return await runExtraction();
          } catch (retryError) {
            console.error("[extractCoverMetadata] retry also failed:", retryError);
            // Sessizce null'lar döndür — client kullanıcıdan manuel yazmasını
            // bekleyecek; hata pop-up'ı kapak ekleme akışını bozar.
            return { title: null, author: null };
          }
        }
      }),

    /**
     * Kitabı arşivle — Kitaplarım listesinden gizler ama DB'de saklar.
     * Kullanıcı swipe-left ile "Arşivle" eylemini tetikleyince çağrılır.
     * Geri yükleme için `unarchive` var; arşiv ekranı ileriki bir sürümde.
     */
    archive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const book = await db.getBookById(input.id);
        if (!book || book.userId !== ctx.user.id) {
          throw new Error("Book not found");
        }
        await db.updateBook(input.id, { archived: true });
        return { success: true } as const;
      }),

    unarchive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const book = await db.getBookById(input.id);
        if (!book || book.userId !== ctx.user.id) {
          throw new Error("Book not found");
        }
        await db.updateBook(input.id, { archived: false });
        return { success: true } as const;
      }),
  }),

  // ============================================
  // FILE UPLOAD (Presigned URLs)
  // ============================================
  upload: router({
    /**
     * Get presigned URL for uploading a file to S3
     */
    getPresignedUrl: protectedProcedure
      .input(
        z.object({
          fileName: z.string().min(1),
          fileType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
          fileSize: z.number().min(1).max(50_000_000), // 50MB max
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Generate unique key
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const ext = input.fileName.split(".").pop() || "bin";
        const key = `uploads/${ctx.user.id}/${timestamp}-${randomId}.${ext}`;

        // Create presigned PUT URL
        const client = getClient();
        const presignedUrl = await getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: ENV.r2BucketName,
            Key: key,
            ContentType: input.fileType,
          }),
          { expiresIn: 3600 } // 1 hour
        );

        // Server-side public URL — client no longer needs to know the R2 base.
        // If R2_PUBLIC_BASE_URL isn't configured, fail fast here (with a clear
        // server error) rather than letting the client build a broken URL.
        const publicUrl = buildPublicUrl(key);

        return { presignedUrl, key, publicUrl };
      }),
  }),

  // ============================================
  // READING MOMENTS
  // ============================================
  readingMoments: router({
    /**
     * Kitaba ait tüm okuma anlarını listele
     */
    listByBook: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .query(async ({ ctx, input }) => {
        const book = await db.getBookById(input.bookId);
        if (!book || book.userId !== ctx.user.id) {
          throw new Error("Book not found");
        }
        const moments = await db.getReadingMomentsByBook(input.bookId);
        // Sayfa fotolarını signed URL'e çevir — kapak problemiyle aynı neden.
        return Promise.all(
          moments.map(async (m) => ({
            ...m,
            pageImageUrl: (await toDisplayUrl(m.pageImageUrl)) ?? m.pageImageUrl,
          })),
        );
      }),

    /**
     * Okuma anı ID'sine göre okuma anı getir
     */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const moment = await db.getReadingMomentById(input.id);
        if (!moment || moment.userId !== ctx.user.id) {
          throw new Error("Reading moment not found");
        }
        return {
          ...moment,
          pageImageUrl: (await toDisplayUrl(moment.pageImageUrl)) ?? moment.pageImageUrl,
        };
      }),

    /**
     * Yeni okuma anı oluştur — OCR rate-limited (kullanıcı başına 50/gün).
     */
    create: ocrLimitedProcedure
      .input(
        z.object({
          bookId: z.number(),
          pageImageBase64: z.string().max(5_000_000, "Image too large (max ~3.8MB)").optional(),
          pageImageUrl: z.string().url().optional(), // Presigned URL upload sonrası
          userNote: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!input.pageImageBase64 && !input.pageImageUrl) {
          throw new Error("pageImageBase64 veya pageImageUrl zorunlu");
        }

        // Ownership + freemium cap check. Kitap bu kullanıcınınsa ve cap
        // aşılmadıysa devam; aksi halde FORBIDDEN ile client upsell açar.
        // (50325 freemium enforcement)
        const targetBook = await db.getBookById(input.bookId);
        if (!targetBook || targetBook.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
        }
        const premium = isUserPremium(ctx.user);
        const momentCap = premium
          ? FREEMIUM_LIMITS.pro.momentsPerBookSanity
          : FREEMIUM_LIMITS.free.momentsPerBook;
        const existingCount = await db.getReadingMomentCount(input.bookId);
        if (existingCount >= momentCap) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: premium ? "MOMENT_SANITY_CAP" : "MOMENT_LIMIT_REACHED",
          });
        }

        // 1. Sayfa fotoğrafını S3'e yükle
        let pageImageUrl: string;
        if (input.pageImageUrl) {
          // Presigned URL ile yüklendiyse direkt kullan
          pageImageUrl = input.pageImageUrl;
        } else {
          // Fallback: base64 ile yükle
          const imageBuffer = Buffer.from(input.pageImageBase64!, "base64");
          const imageFileName = `pages/${ctx.user.id}/${Date.now()}.jpg`;
          const uploadResult = await storagePut(imageFileName, imageBuffer, "image/jpeg");
          pageImageUrl = uploadResult.url;
        }

        // 2. OCR işlemi (LLM ile) — ucuz flash-lite tier'ında çalışır (workload
        // routing). Full flash sadece asistan sohbeti için; sayfa OCR'ında
        // kalite farkı hissedilmiyor, maliyet ~20x düşüyor.
        //
        // 50320 bugfix: Gemini'ye HAM public URL yerine SIGNED URL geçiyoruz.
        // R2 bucket public config sırasında propagation/cache/custom-domain
        // hiccup'ları yaşadığımızda eski kitaplarda OCR çalışıp yenilerde
        // çalışmama durumu oluşuyordu. Signed URL bucket public config'den
        // bağımsız çalışır — intermittent failure kapanır.
        //
        // Ayrıca tek retry ekleniyor: ilk çağrı transient (network/rate/
        // temporary model unavailability) hata verirse 1.5s sonra tekrar
        // deneriz. İkinci başarısızlıkta sessizce metni null bırakırız
        // (client onSuccess'te kullanıcıya "OCR yapılamadı" uyarısı gösterir).
        let ocrText: string | null = null;
        const ocrImageUrl = (await toDisplayUrl(pageImageUrl)) ?? pageImageUrl;
        const ocrPrompt = [
          "Bu kitap sayfasındaki metni OKUNABİLİR bir şekilde çıkar.",
          "",
          "KURALLAR:",
          "1. Satır sonunda tire (-) ile bölünmüş kelimeleri BİRLEŞTİR. Örnek: 'di-\\nzim' → 'dizim'.",
          "2. Paragraf içindeki satır sonlarını KALDIR — metni akıcı cümleler halinde yaz. Bir paragraf tek bir satırda akmalı.",
          "3. Paragraflar arasına tek bir boş satır koy.",
          "4. Noktalama işaretlerini, tırnakları ve diyalog tire'lerini (—) koru.",
          "5. Üst/alt bilgi, sayfa numarası, bölüm başlığı ve kitap başlığını ATLA.",
          "6. Çeviri yapma, yorum ekleme, '\"\"\"' veya benzer kod blokları kullanma.",
          "",
          "Sadece düzenlenmiş metni döndür, başka hiçbir şey ekleme.",
        ].join("\n");

        const runOcr = async (): Promise<string | null> => {
          const ocrResponse = await invokeLLM({
            model: ENV.geminiModelOcr,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: ocrPrompt },
                  {
                    type: "image_url",
                    image_url: { url: ocrImageUrl, detail: "high" },
                  },
                ],
              },
            ],
          });
          const firstChoice = ocrResponse.choices[0];
          if (!firstChoice || !firstChoice.message) return null;
          const content = firstChoice.message.content;
          const text = typeof content === "string" ? content : JSON.stringify(content);
          return text && text.trim().length > 0 ? text : null;
        };

        try {
          ocrText = await runOcr();
        } catch (error) {
          console.error("[OCR] first attempt failed:", error);
          await new Promise((r) => setTimeout(r, 1500));
          try {
            ocrText = await runOcr();
          } catch (retryError) {
            console.error("[OCR] retry also failed:", retryError);
            // OCR başarısız olsa bile devam et — client null ocrText görünce
            // kullanıcıya bildirecek.
          }
        }

        // 3. Okuma anını veritabanına kaydet
        const momentId = await db.createReadingMoment({
          bookId: input.bookId,
          userId: ctx.user.id,
          pageImageUrl,
          ocrText,
          userNote: input.userNote,
        });

        // 4. Kitabın kapak fotoğrafı yoksa, bu fotoğrafı kapak olarak ayarla
        const book = await db.getBookById(input.bookId);
        if (book && !book.coverImageUrl) {
          await db.updateBook(input.bookId, { coverImageUrl: pageImageUrl });
        }

        return { id: momentId, ocrText, pageImageUrl };
      }),

    /**
     * Okuma anı güncelle (sadece not güncellenebilir)
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          userNote: z.string().max(10000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const moment = await db.getReadingMomentById(input.id);
        if (!moment || moment.userId !== ctx.user.id) {
          throw new Error("Reading moment not found");
        }
        await db.updateReadingMoment(input.id, {
          userNote: input.userNote,
        });
        return { success: true };
      }),

    /**
     * Okuma anı sil
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const moment = await db.getReadingMomentById(input.id);
        if (!moment || moment.userId !== ctx.user.id) {
          throw new Error("Reading moment not found");
        }
        await db.deleteReadingMoment(input.id);
        return { success: true };
      }),
  }),

  // ============================================
  // AI (PREMIUM)
  // ============================================
  ai: router({
    /**
     * OCR metninden otomatik not oluştur (Premium özelliği).
     * OCR bucket'ını paylaşır — 50/gün tavanı aynı.
     */
    generateNote: ocrLimitedProcedure
      .input(z.object({ ocrText: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        // Premium kontrolü — DB flag VEYA allowlist (test email) premium sayar.
        if (!isUserPremium(ctx.user)) {
          throw new Error("This feature requires premium subscription");
        }

        try {
          // AI note üretimi kısa bir özet — flash-lite fazlasıyla yeterli ve
          // OCR workload'ının yanında aynı ucuz tier'dan gitmesi mantıklı.
          const response = await invokeLLM({
            model: ENV.geminiModelOcr,
            messages: [
              {
                role: "system",
                content: "Sen bir okuma asistanısın. Kullanıcının okuduğu kitap sayfasından çıkarılan metni analiz edip, önemli noktaları vurgulayan kısa ve öz bir not oluştur. Notu 2-3 cümle ile sınırla. Türkçe yaz.",
              },
              {
                role: "user",
                content: `Bu metinden önemli noktaları çıkar ve kısa bir not oluştur:\n\n${input.ocrText}`,
              },
            ],
          });

          const firstChoice = response.choices[0];
          if (firstChoice && firstChoice.message) {
            const content = firstChoice.message.content;
            const generatedNote = typeof content === 'string' ? content : JSON.stringify(content);
            return { note: generatedNote };
          }

          throw new Error("AI response is empty");
        } catch (error) {
          console.error("AI note generation failed:", error);
          throw new Error("Failed to generate note");
        }
      }),
  }),

  // ============================================
  // SEARCH
  // ============================================
  search: router({
    /**
     * Kitap ve okuma anlarında arama yap
     */
    all: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const [books, moments] = await Promise.all([
          db.searchBooks(ctx.user.id, input.query),
          db.searchReadingMoments(ctx.user.id, input.query),
        ]);
        
        return {
          books,
          moments,
        };
      }),
  }),

  // ============================================
  // EXPORT
  // ============================================
  export: router({
    /**
     * Kitabın tüm okuma anlarını export et (PDF veya Markdown)
     */
    book: protectedProcedure
      .input(
        z.object({
          bookId: z.number(),
          format: z.enum(["pdf", "markdown"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Kitap bilgilerini al
        const book = await db.getBookById(input.bookId);
        if (!book || book.userId !== ctx.user.id) {
          throw new Error("Book not found or unauthorized");
        }

        // Okuma anlarını al
        const moments = await db.getReadingMomentsByBook(input.bookId);

        // Markdown formatında içerik oluştur
        let content = `# ${book.title}\n\n`;
        if (book.author) {
          content += `**Author:** ${book.author}\n\n`;
        }
        content += `**Total Moments:** ${moments.length}\n\n`;
        content += `---\n\n`;

        moments.forEach((moment, index) => {
          content += `## Moment ${index + 1}\n\n`;
          content += `**Date:** ${new Date(moment.createdAt).toLocaleDateString()}\n\n`;
          
          if (moment.ocrText) {
            content += `### Extracted Text\n\n`;
            content += `${moment.ocrText}\n\n`;
          }
          
          if (moment.userNote) {
            content += `### Your Note\n\n`;
            content += `${moment.userNote}\n\n`;
          }
          
          content += `---\n\n`;
        });

        if (input.format === "markdown") {
          return {
            content,
            filename: `${book.title.replace(/[^a-z0-9]/gi, "_")}.md`,
            mimeType: "text/markdown",
          };
        } else {
          // PDF format için basit bir HTML'e çevir (tarayıcıda PDF'e dönüştürülecek)
          const htmlContent = content
            .replace(/^# (.+)$/gm, "<h1>$1</h1>")
            .replace(/^## (.+)$/gm, "<h2>$1</h2>")
            .replace(/^### (.+)$/gm, "<h3>$1</h3>")
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n\n/g, "<br><br>")
            .replace(/---/g, "<hr>");
          
          return {
            content: htmlContent,
            filename: `${book.title.replace(/[^a-z0-9]/gi, "_")}.html`,
            mimeType: "text/html",
          };
        }
      }),
  }),

  // ============================================
  // AI CHATBOT
  // ============================================
  chat: router({
    /**
     * Kullanıcının okuma verisi ile sohbet et — chat rate-limited
     * (kullanıcı başına 20/saat).
     */
    send: chatLimitedProcedure
      .input(
        z.object({
          message: z.string().min(1).max(2000),
          // Client sends the active UI language so the assistant replies in
          // the user's language. Defaults to "tr" — primary market.
          locale: z.enum(["tr", "en"]).optional().default("tr"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Freemium paket (50325): Hafıza asistanı free user'a da AÇIK, ama
        // lifetime 10 başarılı cevap ile sınırlı. Pro'da lifetime cap yok;
        // sadece middleware tarafındaki abuse-guard (40/saat + 300/gün)
        // geçerli.
        const premium = isUserPremium(ctx.user);
        let currentQuotaUsed = 0;
        if (!premium) {
          const user = await db.getUserById(ctx.user.id);
          currentQuotaUsed = user?.freeAssistantQuestionsUsed ?? 0;
          if (currentQuotaUsed >= FREEMIUM_LIMITS.free.assistantQuestionsLifetime) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "ASSISTANT_QUOTA_EXHAUSTED",
            });
          }
        }

        const locale = input.locale;

        // Kullanıcının tüm kitaplarını ve okuma anlarını al
        const books = await db.getUserBooks(ctx.user.id);
        const allMoments = await Promise.all(
          books.map((book) => db.getReadingMomentsByBook(book.id))
        );
        const moments = allMoments.flat();

        // Kullanıcı verilerini context olarak hazırla — data labels EN even for
        // TR users; model interprets them either way. Only prose switches on locale.
        const header = locale === "en" ? "User's Reading Data" : "Kullanıcının Okuma Verileri";
        const booksLabel = locale === "en" ? "Books" : "Kitaplar";
        const momentsLabel = locale === "en" ? "Reading Moments" : "Okuma Anları";
        const countSuffix = locale === "en" ? "" : " adet";
        const unknownBook = locale === "en" ? "Unknown" : "Bilinmeyen";
        const ocrLabel = locale === "en" ? "OCR Text" : "OCR Metni";
        const noteLabel = locale === "en" ? "Note" : "Kullanıcı Notu";
        const dateLabel = locale === "en" ? "Date" : "Tarih";
        const none = locale === "en" ? "None" : "Yok";
        const bookTag = locale === "en" ? "Book" : "Kitap";

        const userContext = `
${header}:

${booksLabel} (${books.length}${countSuffix}):
${books.map((b) => `- "${b.title}" ${b.author ? `by ${b.author}` : ""}`).join("\n")}

${momentsLabel} (${moments.length}${countSuffix}):
${moments
  .slice(0, 50) // Son 50 okuma anı
  .map((m) => {
    const book = books.find((b) => b.id === m.bookId);
    return `
[${bookTag}: ${book?.title || unknownBook}]
${ocrLabel}: ${m.ocrText || none}
${noteLabel}: ${m.userNote || none}
${dateLabel}: ${m.createdAt}
`;
  })
  .join("\n---\n")}
`;

        // System prompt switches on the user's UI locale so the model's
        // reply language matches what the user reads in the app.
        const systemPrompt =
          locale === "en"
            ? `You are a reading assistant. You answer the user's questions about the books they read and the reading moments they capture. You can analyze their data, produce summaries, and make recommendations. Reply in English.${userContext}`
            : `Sen bir okuma asistanısın. Kullanıcının okuduğu kitaplar ve okuma anları hakkında sorularına cevap veriyorsun. Kullanıcının verilerini analiz edip, özetler çıkarıp, öneriler sunabilirsin. Türkçe konuş.${userContext}`;

        // Basit router: kısa + tek cümlelik soru → flash-lite (ucuz), uzun /
        // analitik sorular → full flash (kalite). Heuristic her iki dil için
        // keyword taraması yapıyor; false-negative maliyet farkı kabul
        // edilebilir — kötü yönlendirirsek kullanıcı flash-lite'ın kısa
        // cevabını görür, dünyanın sonu değil.
        const msg = input.message.trim();
        const complexityKeywords =
          locale === "en"
            ? /(compare|recommend|recommendation|analy[sz]e|why|how|explain|summar[iy])/i
            : /(karşılaştır|öner|öneri|analiz|neden|nasıl|açıkla|özetle)/i;
        const isSimple = msg.length < 120 && !complexityKeywords.test(msg);
        const chatModel = isSimple ? ENV.geminiModelOcr : ENV.geminiModelChat;

        // LLM'e gönder — wrap to surface actionable error codes instead of
        // leaking stack traces to the client.
        let response;
        try {
          response = await invokeLLM({
            model: chatModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: input.message },
            ],
          });
        } catch (err) {
          console.error("[chat.send] invokeLLM failed", {
            userId: ctx.user.id,
            model: chatModel,
            error: err instanceof Error ? err.message : String(err),
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "LLM_UNAVAILABLE",
            cause: err,
          });
        }

        const firstChoice = response.choices[0];
        if (!firstChoice || !firstChoice.message) {
          console.error("[chat.send] LLM returned empty choices", {
            userId: ctx.user.id,
            finishReason: firstChoice?.finish_reason,
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "LLM_EMPTY_RESPONSE",
          });
        }

        const reply =
          typeof firstChoice.message.content === "string"
            ? firstChoice.message.content
            : JSON.stringify(firstChoice.message.content);

        // Successful LLM response — SADECE bu noktada lifetime sayacı
        // artırılır. Infra hatası (timeout/empty choices/quota) user'ın
        // hakkından düşmez; trust-building move. Increment başarısız olursa
        // response'u bozma — worst case: user bir free soru fazla kullanır,
        // bu bir Apple-quality trade-off.
        let quotaRemaining: number | null = null;
        if (!premium) {
          try {
            await db.incrementFreeAssistantQuestions(ctx.user.id);
          } catch (incErr) {
            console.error("[chat.send] failed to increment quota", {
              userId: ctx.user.id,
              error: incErr instanceof Error ? incErr.message : String(incErr),
            });
          }
          quotaRemaining = Math.max(
            0,
            FREEMIUM_LIMITS.free.assistantQuestionsLifetime - (currentQuotaUsed + 1),
          );
        }

        return {
          reply,
          timestamp: new Date().toISOString(),
          quotaRemaining,
        };
      }),
  }),

  // ============================================
  // SUBSCRIPTIONS (PAYMENT)
  // ============================================
  subscriptions: router({
    /**
     * Premium status — read the current user's flag.
     *
     * The actual source of truth is RevenueCat. The app calls this on launch
     * to render gated UI; RevenueCat's webhook keeps the DB flag in sync.
     */
    status: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      // Allowlist'i burada da uygula ki UI premium yetenekleri açsın —
      // aksi halde client "free" görür, premium ekrana yönlendirir.
      const resolved = user ?? ctx.user;
      return {
        isPremium: isUserPremium(resolved),
        openId: resolved.openId,
      };
    }),

    /**
     * Freemium kullanım sayacları — profil > hesap ekranındaki zarif progress
     * kartı için. Sadece free user için göster (Pro'da `isPremium: true`
     * dönüyor, client kartı gizliyor).
     *
     * Book sayacı AKTİF kitaplar — archive flow ile slot açmak hâlâ mümkün
     * olduğundan rolling bir gösterge olmalı, toplam değil.
     *
     * Assistant sayacı lifetime — limit DEĞİŞMEZ (reset yok); upgrade
     * etmeden geri alınmaz. Copy bu gerçeği açıkça söylemeli.
     */
    usage: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      const resolved = user ?? ctx.user;
      const premium = isUserPremium(resolved);

      if (premium) {
        // Pro user sayaç görmez — client kartı hiç render etmiyor, yine de
        // contract şekli aynı kalsın diye null dönüyoruz.
        return {
          isPremium: true as const,
          books: null,
          assistantQuestions: null,
        };
      }

      const activeBooks = await db.countActiveBooks(ctx.user.id);
      const questionsUsed = user?.freeAssistantQuestionsUsed ?? 0;

      return {
        isPremium: false as const,
        books: {
          used: activeBooks,
          limit: FREEMIUM_LIMITS.free.activeBooks,
        },
        assistantQuestions: {
          used: questionsUsed,
          limit: FREEMIUM_LIMITS.free.assistantQuestionsLifetime,
        },
      };
    }),

    /**
     * Manual premium toggle — for development / admin tooling only.
     * Production purchases flow through Apple IAP → RevenueCat → webhook.
     */
    activatePremium: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Premium activation only available via subscription purchase");
        }
        await db.updateUserPremiumStatus(ctx.user.id, true);
        return { success: true };
      }),

    cancelPremium: protectedProcedure.mutation(async ({ ctx }) => {
      await db.updateUserPremiumStatus(ctx.user.id, false);
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
