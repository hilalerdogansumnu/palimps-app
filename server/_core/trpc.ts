import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { RateLimiterAbstract } from "rate-limiter-flexible";
import type { TrpcContext } from "./context";
import { chatLimiter, ocrLimiter } from "./rateLimit";

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
 * Per-user rate-limit middleware factory. Composes on top of requireUser so
 * we always have a stable id to bucket against. Aşımda TRPCError
 * TOO_MANY_REQUESTS "RATE_LIMIT_EXCEEDED" döner — client buna göre UI mesajı
 * gösterebilir.
 */
function rateLimitMiddleware(limiter: RateLimiterAbstract) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    // Paired with requireUser via `.use(requireUser).use(rateLimitMiddleware(...))`,
    // but keep a safety net in case someone wires this onto a public procedure.
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: UNAUTHED_ERR_MSG,
      });
    }

    try {
      await limiter.consume(String(ctx.user.id));
    } catch (rejRes: unknown) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "RATE_LIMIT_EXCEEDED",
        cause: rejRes instanceof Error ? rejRes : undefined,
      });
    }

    // Narrow `user` to non-null in downstream handlers — mirrors requireUser
    // so chained procedures keep the same ergonomics as protectedProcedure.
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });
}

// Chat: kullanıcı başına saatte 20 mesaj (rateLimit.ts'te bucket).
export const chatLimitedProcedure = protectedProcedure.use(rateLimitMiddleware(chatLimiter));

// OCR + AI note: kullanıcı başına günde 50 istek. readingMoments.create ve
// ai.generateNote aynı bucket'ı paylaşıyor — ikisi de aynı ucuz LLM tier'a
// gidiyor, tek tavan yeterli.
export const ocrLimitedProcedure = protectedProcedure.use(rateLimitMiddleware(ocrLimiter));

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
