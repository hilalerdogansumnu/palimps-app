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

  // Apple Sign In server-to-server auth key (for /auth/token exchange and
  // /auth/revoke). Created in Apple Developer Portal → Keys → "Sign in with
  // Apple" enabled key. Both vars MUST be set together — if either is missing,
  // revocation flow disables itself (sign-in still works because identityToken
  // verification doesn't need this key, only revoke does).
  //
  // APPLE_SIGN_IN_KEY_ID: 10-char Key ID (e.g. "ABCD123456")
  // APPLE_SIGN_IN_PRIVATE_KEY: full .p8 file contents, including
  //   "-----BEGIN PRIVATE KEY-----" / "-----END PRIVATE KEY-----" lines.
  //   Railway accepts multi-line values; if pasted as escaped \n string the
  //   helper normalizes at load time.
  appleSignInKeyId: process.env.APPLE_SIGN_IN_KEY_ID ?? "",
  appleSignInPrivateKey: process.env.APPLE_SIGN_IN_PRIVATE_KEY ?? "",

  // ─────────────────────────────────────────────────────────────────────────
  // AI — Google Gemini (direct)
  //
  // Model routing: OCR workload (kitap sayfası foto → metin) ucuz flash-lite
  // modeline gider, chat workload (asistan sohbeti) karmaşık sorularda flash'a
  // yükselir. Faz 2'de context caching açılınca asistan başına %30-50 tasarruf.
  //
  // Back-compat: GEMINI_MODEL set'liyse OCR + CHAT default'u olarak kullanılır,
  // böylece geçiş sırasında Railway'de env çakışırsa uygulama kırılmaz.
  // ─────────────────────────────────────────────────────────────────────────
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiBaseUrl:
    process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai",
  geminiModelOcr:
    process.env.GEMINI_MODEL_OCR ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite",
  geminiModelChat:
    process.env.GEMINI_MODEL_CHAT ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash",

  // Moment enrichment kill switch (Phase A).
  //
  // Default ON. Railway'de ENABLE_MOMENT_ENRICHMENT=false flip edilirse
  // moments.create akışında OCR sonrası summary + tags üretimi atlanır —
  // moment yine kaydedilir, sadece enrichment alanları null kalır. Kullanımı:
  // cost spike, Gemini outage, kalite regression → redeploy beklemeden kapat.
  //
  // Kasıtlı olarak "kapalı" → "!== 'false'". Env set edilmemişse (undefined),
  // boş string ise, veya "true" / "1" ise → true (ON). Sadece explicit "false"
  // stringi kapatır. Yanlış yazım ("False", "0") kazara kapatmaz.
  enableMomentEnrichment: process.env.ENABLE_MOMENT_ENRICHMENT !== "false",

  // Markings extraction kill switch (Phase B).
  //
  // Default ON. Railway'de ENABLE_MARKING_CAPTURE=false flip edilirse
  // moments.create akışında OCR + enrichment'tan sonra highlights/marginalia
  // üretimi atlanır — moment yine kaydedilir, sadece markings alanları null
  // kalır. Kullanım: Gemini full flash cost spike, vision model outage,
  // kalite regression → redeploy beklemeden kapat.
  //
  // Phase A enrichment ile aynı semantik: sadece explicit "false" stringi
  // kapatır. "False", "0", boş string, undefined → ON. Yanlış yazım kazara
  // kapatmaz.
  enableMarkingCapture: process.env.ENABLE_MARKING_CAPTURE !== "false",

  // Eco voice kill switch — DEFAULT OFF (25 Nisan 2026 dogfood feedback).
  //
  // Eco v1 ve v2 prompt iteration'ları cevap kalitesinde regresyon yarattı:
  // 50332'deki legacy CHAT_SYSTEM_PROMPT_TR/EN ("Asistan" versiyonu)
  // kullanıcı için daha iyi sonuç veriyordu. "Sis Mustafa Kutlu" senaryosu
  // gaslighting + kütüphane-dışı öneri sızıntısı + sade-kütüphaneci voice
  // taşırken bilgililik kaybı dogfood'da net görüldü. Eco kodu silinmedi
  // (prompts.ts'te ECO_CHAT_SYSTEM_PROMPT_TR/EN duruyor) — gelecekte v3
  // iterate açılabilir.
  //
  // Default'u OPT-IN'e (=== "true") çevirdik: Railway'de açıkça
  // ENABLE_ECO_VOICE=true set edilmedikçe legacy "Asistan" prompt aktif.
  // Diğer kill switch'lerden (markingCapture, momentEnrichment) farkı:
  // onlar default-on çünkü tek prompt yolu var; Eco alternatif voice ve
  // dogfood'da legacy daha iyi performansla çıktı.
  enableEcoVoice: process.env.ENABLE_ECO_VOICE === "true",

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

  // ─────────────────────────────────────────────────────────────────────────
  // Premium test allowlist
  //
  // Comma-separated emails (case-insensitive) that are treated as premium
  // regardless of the RevenueCat flag. Lets the founder + QA test premium
  // features without running an IAP sandbox purchase every reset.
  //
  // Production note: keep this list TIGHT — every address here skips the paywall.
  // Remove pre-launch or keep to internal @palimps domain only.
  //
  // Aliases: PREMIUM_TEST_EMAILS is canonical; PREMIUM_USER_EMAILS is accepted
  // as a fallback because the 50320 Railway config used the shorter name — we
  // don't want a variable-name typo to silently disable the allowlist.
  // ─────────────────────────────────────────────────────────────────────────
  premiumTestEmails: (
    process.env.PREMIUM_TEST_EMAILS ??
    process.env.PREMIUM_USER_EMAILS ??
    ""
  )
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};
