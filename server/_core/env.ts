/**
 * Centralized environment variable access.
 * All server-side env vars must be read through this object.
 *
 * Manus dependencies removed (post-1.0): we now talk directly to
 * Google Gemini, Cloudflare R2, Apple, and RevenueCat.
 */
export const ENV = {
  // ─────────────────────────────────────────────────────────────────────────
  // Core
  // ─────────────────────────────────────────────────────────────────────────
  isProduction: process.env.NODE_ENV === "production",
  appId: process.env.APP_ID ?? "palimps",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "", // e.g. https://api.palimps.app

  // Back-compat alias kept until callers are migrated
  cookieSecret: process.env.JWT_SECRET ?? "",

  // Owner / admin promotion. The user with this openId is auto-tagged as
  // role="admin" on first sign-in. For native auth the openId format is
  // "apple:<sub>".
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",

  // ─────────────────────────────────────────────────────────────────────────
  // Auth — native Apple Sign In (only auth method; Apple-ecosystem app)
  // ─────────────────────────────────────────────────────────────────────────
  appleBundleId:
    process.env.APPLE_BUNDLE_ID ?? "space.manus.okuma.hafizasi.mvp.t20260130232125",
  appleTeamId: process.env.APPLE_TEAM_ID ?? "S456GRHXU8",

  // ─────────────────────────────────────────────────────────────────────────
  // AI — Google Gemini (direct)
  // ─────────────────────────────────────────────────────────────────────────
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiBaseUrl:
    process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",

  // ─────────────────────────────────────────────────────────────────────────
  // Storage — Cloudflare R2 (S3-compatible)
  // ─────────────────────────────────────────────────────────────────────────
  r2AccountId: process.env.R2_ACCOUNT_ID ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2BucketName: process.env.R2_BUCKET_NAME ?? "palimps",
  // Public URL prefix where uploaded objects are served from
  // (configure a custom domain or use the r2.dev URL)
  r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? "",

  // ─────────────────────────────────────────────────────────────────────────
  // Subscriptions — RevenueCat (Apple IAP)
  // ─────────────────────────────────────────────────────────────────────────
  revenuecatWebhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET ?? "",
  revenuecatPublicSdkKey: process.env.REVENUECAT_PUBLIC_SDK_KEY ?? "",
};
