# CLAUDE.md — PALIMPS Project Context

## Önce Handoff'u Oku (her yeni task'ın ilk işi)

Bu task'ta soru sormadan önce şunu yap:

1. `ls ~/.claude/skills/SESSION-*-handoff.md` ile mevcut handoff dosyalarını
   bul.
2. En son tarihli olanı `Read` tool ile oku (tamamı, sadece başı değil).
3. 2-3 cümleyle: "şu an `<feature>` üzerinde çalışıyoruz, son durum
   `<X>`, açık gap'ler `<Y>`" diye özetle.
4. Hilal'in mesajını bekle — sıfırdan plan kurma, handoff zaten state
   taşıyor.

Bu adım atlanırsa Hilal her şeyi tekrar açıklamak zorunda kalır.

Hatırlatıcı: Brand, tasarım ve kod standartları `palimps-ios-developer` ve
`palimps-product-designer` skill'lerinde. Bu dosya operasyonel gerçekler
için — shell komutu yazmadan önce bakılacak şeyler.

## Stack

- **Runtime:** React Native + Expo SDK 54, Expo Router, NativeWind v4
- **Server:** tRPC, deployed on Railway (`palimps-app-production.up.railway.app`)
- **DB:** MySQL on Railway (Drizzle ORM)
- **Storage:** Cloudflare R2 for images (presigned URLs)
- **Auth:** `expo-apple-authentication`, session cookies
- **Payments:** RevenueCat (iOS)
- **Package manager:** `pnpm` (NOT npm or yarn)

## Environment Variables — Where They Actually Live

**Local `.env`** contains ONLY `EXPO_PUBLIC_*` client vars (API base URL,
RevenueCat key). `DATABASE_URL`, `GEMINI_API_KEY`, `R2_*`, etc. are NOT in
local `.env` — they live in Railway's env panel.

**Consequence:** if a script needs a server-side env var, running it with
plain `node scripts/...` will fail with "not defined". Two options:

```bash
# Preferred — Railway CLI injects all server env vars
railway run node scripts/<script>.mjs

# Fallback — copy value from Railway dashboard → Variables, export once
export DATABASE_URL="mysql://..."
node scripts/<script>.mjs
```

**Never** write shell commands with `<placeholder>` syntax — zsh interprets
`<` as stdin redirection. Use actual values or env vars.

## Migrations

- Schema: `drizzle/schema.ts`
- Files: `drizzle/0000_*.sql` … `drizzle/000N_*.sql` (hand-written after
  0003 — the `_journal.json` is stale, don't rely on it)
- Apply: `node scripts/apply-migration.mjs drizzle/<file>.sql`
  - Reads `DATABASE_URL` from env
  - Splits on `;`, runs each statement
  - NOT idempotent — don't run twice (duplicate-column error)
- Do NOT run `drizzle-kit migrate` expecting 0004+ to apply; it won't.
- `drizzle-kit generate` diffs schema against snapshot 0003 — would produce
  a huge compound migration. Avoid.

## Key Commands

```bash
pnpm dev                # concurrent: tsx server + Expo metro
pnpm dev:server         # server only (tsx watch)
pnpm test               # vitest run
pnpm check              # tsc --noEmit
pnpm ios                # open in iOS simulator
npx drizzle-kit studio  # browser DB inspector (uses DATABASE_URL)
```

## Build & Ship

- Version bumps: `buildNumber` in `app.config.ts` — must increment every
  EAS build, even if same version. Duplicate build numbers = Apple rejects
  with cryptic error.
- Build: `eas build --platform ios --profile production` (runs on EAS
  servers, not local Mac — needs EAS login on the user's machine, not
  sandbox)
- Submit: `eas submit --platform ios --profile production --latest`
- Both commands MUST run from the user's Mac terminal. Claude sandbox has
  no EAS auth.

## Directory Layout

```
app/              Expo Router screens
  (tabs)/         Tab group — home, chat, profile
  profile/        Profile stack (account, edit-name)
  premium.tsx     Paywall
components/       Reusable UI
  screen-container.tsx   ← handles safe area, do NOT wrap in SafeAreaView
hooks/
  use-colors.ts          ← theme tokens
  use-subscription.ts    ← isPremium source of truth
lib/
  _core/                 theme.ts, trpc client
  i18n/                  en/tr resource maps
server/
  routers.ts             tRPC routes (OCR + moment creation here)
  db.ts                  Drizzle query helpers
  _core/
    llm.ts               invokeLLM() — OpenAI-compatible Gemini call
    prompts.ts           centralized LLM prompts (MOMENT_ENRICH_PROMPT, etc.)
    env.ts               process.env wrappers
drizzle/
  schema.ts              source of truth for DB shape
  000N_*.sql             hand-applied migrations
scripts/
  apply-migration.mjs    runs a .sql file against DATABASE_URL
  load-env.js            reads .env into process.env
locales/
  en.json + tr.json      BOTH must be kept in sync — never ship a key in
                         one language only
```

## Non-Obvious Gotchas

- **React Compiler is ON** (`reactCompiler: true` in `app.config.ts`).
  Don't add `React.memo` / `useMemo` / `useCallback` defensively — the
  compiler handles it. Profile first if you think there's a perf issue.
- **OCR goes to Gemini flash-lite** (`ENV.geminiModelOcr`), chat goes to
  full flash (`ENV.geminiModelChat`). Routing is deliberate — don't
  unify them.
- **Apple Sign In users often have `@privaterelay.appleid.com` emails.**
  The local part is a random hash — do not show it raw in UI. Show
  "E-postamı Gizle" / "Hide My Email" instead.
- **`isPremium` allowlist in `server/routers.ts`** bypasses RevenueCat for
  the dev email — side effect: paywall UI can't be visually tested on the
  owner's device unless temporarily removed.
- **Turkish locale matters for `toLowerCase()`.** Default JS
  `"I".toLowerCase()` returns `"i"` (dotted); Turkish expects `"ı"`
  (dotless). Use `.toLocaleLowerCase("tr-TR")` for any user-visible
  normalization.
- **Terminology:** "Moment" in code + English, **"An" in Turkish**. Never
  use "Moment" in `tr.json`.

## When Writing Shell Commands for the User

1. Check `.env` first — what's actually there?
2. Check if a command needs Railway-side env vars.
3. Use real values or `railway run` — never `<placeholder>` syntax.
4. For multi-step flows, give copy-paste-ready commands, not narrative
   instructions.
