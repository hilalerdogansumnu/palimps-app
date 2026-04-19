import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { buildPublicUrl, storagePut } from "./storage";
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
      .query(async ({ ctx, input }) => {
        const book = await db.getBookById(input.id);
        if (!book || book.userId !== ctx.user.id) {
          throw new Error("Book not found");
        }
        return book;
      }),

    /**
     * Yeni kitap oluştur
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
        return db.getReadingMomentsByBook(input.bookId);
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
        return moment;
      }),

    /**
     * Yeni okuma anı oluştur
     */
    create: protectedProcedure
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
     * OCR metninden otomatik not oluştur (Premium özelliği)
     */
    generateNote: protectedProcedure
      .input(z.object({ ocrText: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        // Premium kontrolü
        if (ctx.user.isPremium !== 1) {
          throw new Error("This feature requires premium subscription");
        }

        try {
          const response = await invokeLLM({
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
     * Kullanıcının okuma verisi ile sohbet et
     */
    send: protectedProcedure
      .input(
        z.object({
          message: z.string().min(1).max(2000),
          // Client sends the active UI language so the assistant replies in
          // the user's language. Defaults to "tr" — primary market.
          locale: z.enum(["tr", "en"]).optional().default("tr"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Premium gate — machine-readable code so the client can branch
        // on premium vs. unexpected failure.
        if (ctx.user.isPremium !== 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "PREMIUM_REQUIRED",
          });
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

        // LLM'e gönder — wrap to surface actionable error codes instead of
        // leaking stack traces to the client.
        let response;
        try {
          response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: input.message },
            ],
          });
        } catch (err) {
          console.error("[chat.send] invokeLLM failed", {
            userId: ctx.user.id,
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

        return {
          reply,
          timestamp: new Date().toISOString(),
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
      return {
        isPremium: (user?.isPremium ?? 0) === 1,
        openId: user?.openId ?? ctx.user.openId,
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
