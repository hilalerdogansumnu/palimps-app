import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
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
      
      // Her kitap için okuma anı sayısını ekle
      const booksWithCounts = await Promise.all(
        books.map(async (book) => {
          const momentCount = await db.getReadingMomentCount(book.id);
          return {
            ...book,
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
      .query(async ({ input }) => {
        return db.getBookById(input.id);
      }),

    /**
     * Yeni kitap oluştur
     */
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(500),
          author: z.string().max(255).optional(),
          coverImageBase64: z.string().optional(), // Base64 encoded image
        })
      )
      .mutation(async ({ ctx, input }) => {
        let coverImageUrl: string | undefined;

        // Eğer kapak fotoğrafı varsa, S3'e yükle
        if (input.coverImageBase64) {
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
        })
      )
      .mutation(async ({ input }) => {
        await db.updateBook(input.id, {
          title: input.title,
          author: input.author,
        });
        return { success: true };
      }),

    /**
     * Kitap sil
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteBook(input.id);
        return { success: true };
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
      .query(async ({ input }) => {
        return db.getReadingMomentsByBook(input.bookId);
      }),

    /**
     * Okuma anı ID'sine göre okuma anı getir
     */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getReadingMomentById(input.id);
      }),

    /**
     * Yeni okuma anı oluştur
     */
    create: protectedProcedure
      .input(
        z.object({
          bookId: z.number(),
          pageImageBase64: z.string(), // Base64 encoded image
          userNote: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 1. Sayfa fotoğrafını S3'e yükle
        const imageBuffer = Buffer.from(input.pageImageBase64, "base64");
        const imageFileName = `pages/${ctx.user.id}/${Date.now()}.jpg`;
        const uploadResult = await storagePut(imageFileName, imageBuffer, "image/jpeg");
        const pageImageUrl = uploadResult.url;

        // 2. OCR işlemi (LLM ile)
        let ocrText: string | null = null;
        try {
          const ocrResponse = await invokeLLM({
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Bu kitap sayfasındaki tüm metni aynen çıkar. Sadece metni ver, başka bir şey ekleme.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: pageImageUrl,
                      detail: "high",
                    },
                  },
                ],
              },
            ],
          });

          const firstChoice = ocrResponse.choices[0];
          if (firstChoice && firstChoice.message) {
            const content = firstChoice.message.content;
            ocrText = typeof content === 'string' ? content : JSON.stringify(content);
          }
        } catch (error) {
          console.error("OCR failed:", error);
          // OCR başarısız olsa bile devam et
        }

        // 3. Okuma anını veritabanına kaydet
        const momentId = await db.createReadingMoment({
          bookId: input.bookId,
          userId: ctx.user.id,
          pageImageUrl,
          ocrText,
          userNote: input.userNote,
        });

        return { id: momentId, ocrText };
      }),

    /**
     * Okuma anı güncelle (sadece not güncellenebilir)
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          userNote: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
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
      .mutation(async ({ input }) => {
        await db.deleteReadingMoment(input.id);
        return { success: true };
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
  // AI CHATBOT
  // ============================================
  chat: router({
    /**
     * Kullanıcının okuma verisi ile sohbet et
     */
    send: protectedProcedure
      .input(
        z.object({
          message: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Kullanıcının tüm kitaplarını ve okuma anlarını al
        const books = await db.getUserBooks(ctx.user.id);
        const allMoments = await Promise.all(
          books.map((book) => db.getReadingMomentsByBook(book.id))
        );
        const moments = allMoments.flat();

        // Kullanıcı verilerini context olarak hazırla
        const userContext = `
Kullanıcının Okuma Verileri:

Kitaplar (${books.length} adet):
${books.map((b) => `- "${b.title}" ${b.author ? `by ${b.author}` : ""}`).join("\n")}

Okuma Anları (${moments.length} adet):
${moments
  .slice(0, 50) // Son 50 okuma anı
  .map((m) => {
    const book = books.find((b) => b.id === m.bookId);
    return `
[Kitap: ${book?.title || "Bilinmeyen"}]
OCR Metni: ${m.ocrText || "Yok"}
Kullanıcı Notu: ${m.userNote || "Yok"}
Tarih: ${m.createdAt}
`;
  })
  .join("\n---\n")}
`;

        // LLM'e gönder
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Sen bir okuma asistanısın. Kullanıcının okuduğu kitaplar ve okuma anları hakkında sorularına cevap veriyorsun. Kullanıcının verilerini analiz edip, özetler çıkarıp, öneriler sunabilirsin. Türkçe konuş.${userContext}`,
            },
            {
              role: "user",
              content: input.message,
            },
          ],
        });

        const firstChoice = response.choices[0];
        const reply =
          firstChoice && firstChoice.message
            ? typeof firstChoice.message.content === "string"
              ? firstChoice.message.content
              : JSON.stringify(firstChoice.message.content)
            : "Üzülürüm, bir hata oluştu.";

        return {
          reply,
          timestamp: new Date().toISOString(),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
