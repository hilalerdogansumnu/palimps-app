import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { RateLimiterAbstract } from "rate-limiter-flexible";
import type { TrpcContext } from "./context";
import {
  chatLimiterFree,
  chatLimiterProHour,
  chatLimiterProDay,
  ocrLimiterFree,
  ocrLimiterPro,
} from "./rateLimit";
import { isUserPremium } from "./premium";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * Tier-aware rate-limit middleware. Composes on top of requireUser so we
 * always have a stable id to bucket against.
 *
 * - Free kullanıcı → `freeLimiter` (tek bucket)
 * - Premium kullanıcı → `proLimiters` (birden çok bucket, hepsi geçilmeli)
 *
 * Aşımda TRPCError TOO_MANY_REQUESTS "RATE_LIMIT_EXCEEDED" döner — client
 * buna göre UI mesajı gösterir. Premium için çift katmanlı limit ("saatlik"
 * burst + "günlük" sustained) abuse farklı şekillerde engellenir; honest
 * power user ikisini de kolay geçer.
 */
function tieredRateLimitMiddleware(
  freeLimiter: RateLimiterAbstract,
  proLimiters: RateLimiterAbstract[],
) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    // Paired with requireUser upstream, but keep a safety net.
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: UNAUTHED_ERR_MSG,
      });
    }

    const premium = isUserPremium(ctx.user);
    const key = String(ctx.user.id);

    try {
      if (premium) {
        // Premium: tüm pro bucket'lardan geçmeli — herhangi biri dolarsa
        // zaten abuse, block. Paralel yerine sıralı çünkü consume() idempotent
        // değil; paralel olsa tek bucket'ta ilerlese bile diğerinde quota
        // yakılmış olur.
        for (const limiter of proLimiters) {
          await limiter.consume(key);
        }
      } else {
        await freeLimiter.consume(key);
      }
    } catch (rejRes: unknown) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "RATE_LIMIT_EXCEEDED",
        cause: rejRes instanceof Error ? rejRes : undefined,
      });
    }

    // Narrow `user` to non-null in downstream handlers.
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });
}

// Chat: free 20/saat abuse-guard, pro 40/saat + 300/gün gizli tavan.
// Free user zaten 10 lifetime Hafıza sorusu cap'inde; bu bucket sadece
// scripted probing'e karşı.
export const chatLimitedProcedure = protectedProcedure.use(
  tieredRateLimitMiddleware(chatLimiterFree, [chatLimiterProHour, chatLimiterProDay]),
);

// OCR + AI note: free 50/gün, pro 100/gün. readingMoments.create,
// ai.generateNote ve books.extractCoverMetadata aynı bucket'ı paylaşıyor —
// üçü de aynı ucuz LLM tier'a gidiyor, tek tavan yeterli.
export const ocrLimitedProcedure = protectedProcedure.use(
  tieredRateLimitMiddleware(ocrLimiterFree, [ocrLimiterPro]),
);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
