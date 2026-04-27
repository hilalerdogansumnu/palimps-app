# PALIMPS — Architecture

*A stratographic observation of the system as built.*

> **Companion plate:** [`PALIMPS-architecture-plate.pdf`](./PALIMPS-architecture-plate.pdf)
> **Design philosophy:** [`PHILOSOPHY-stratographic-quiet.md`](./PHILOSOPHY-stratographic-quiet.md)
> **Edition:** 2026 · IV  ·  supersedes the February 2026 root-level `ARCHITECTURE.md`

This document is the legend for the architecture plate. The plate shows the
shape; this document explains the meaning. Read them together — neither is
complete on its own.

---

## I. Strata

PALIMPS is laid out as three horizontal strata, in the same order the plate
reads: surface, mediator, substratum. Every request walks the strata top to
bottom; every response climbs them again.

```
┌────────────────────────────────────────────────────────────────────┐
│  I.  Surface       iOS app — the reader's hand                     │
├────────────────────────────────────────────────────────────────────┤
│  II. Mediator      tRPC API on Railway — the scribe                │
├────────────────────────────────────────────────────────────────────┤
│  III. Substratum   MySQL · R2 · Gemini · Apple ID · RevenueCat     │
└────────────────────────────────────────────────────────────────────┘
```

The strata are not microservices. They are layers of responsibility. The
codebase is one Expo project, one Express server, one MySQL database. The
discipline is in keeping each layer small and the contracts between them
explicit.

---

## II. Stack — *materia*

| Layer       | Choice                                                        |
| ----------- | ------------------------------------------------------------- |
| Client      | React Native, Expo SDK 54, Expo Router, NativeWind v4         |
| API         | Express + tRPC v11 (superjson), Node 20, deployed on Railway  |
| Database    | MySQL on Railway, accessed via Drizzle ORM                    |
| Storage     | Cloudflare R2, presigned PUT/GET URLs                         |
| Language    | Gemini — `flash-lite` for OCR, `flash` for chat + enrichment  |
| Auth        | Apple Sign In (`expo-apple-authentication`), session cookies  |
| Payments    | RevenueCat (iOS) — entitlements as source of truth            |
| Crashes     | Sentry (client + server)                                      |
| Build       | EAS Build + EAS Submit (managed cloud build)                  |
| Tests       | vitest (server unit + integration); manual device QA          |
| Pkg manager | `pnpm` — never `npm` or `yarn`                                |

There is no CI yet. There is no E2E framework. There is one developer.
Every architectural choice in this document was made under those
constraints and should be re-evaluated when they change.

---

## III. Stratum I — Surface

The iOS application. Five working surfaces, in the order they appear in
`app/`:

- **`app/(tabs)/home`** — the reading library. Books, archived books,
  freemium quota indicator.
- **`app/(tabs)/chat`** — the reading assistant. Streams replies from the
  chat router, scoped to the active book context.
- **`app/(tabs)/profile`** — account stack, edit name, sign out, delete
  account (KVKK / GDPR cascade).
- **`app/premium.tsx`** — the paywall. Reads from RevenueCat and the
  `use-subscription` hook.
- **`app/(book)/[id]`** — book detail with moments, highlights, and
  marginalia.

### Three guardrails that hold the surface together

1. **`screen-container.tsx`** owns safe-area + keyboard handling. Do not
   wrap screens in `SafeAreaView` directly.
2. **`use-colors.ts`** is the only source of theme tokens. Do not
   hard-code colors in components.
3. **`use-subscription.ts`** is the only place to read `isPremium`.
   Components that need to gate a feature read this hook; they never
   call RevenueCat directly.

### React Compiler is on

`reactCompiler: true` in `app.config.ts`. Defensive `React.memo`,
`useMemo`, and `useCallback` are unnecessary and discouraged — profile
first. New code that adds them should be rejected on review unless there
is a measured reason.

### State that lives on device

- React Query cache — server state, refetched on focus.
- SecureStore — Apple refresh token, session cookie shadow.
- AsyncStorage — UI preferences (theme, locale, onboarding flags).
- Local React state — everything ephemeral.

There is no Redux, no Zustand, no MobX. This is deliberate. If a piece of
state is hard to model with React Query + local state, the question is
usually "does this belong on the server?" — not "do we need a state
library?".

### i18n contract

`locales/en.json` and `locales/tr.json` must be kept in lockstep. Every
key exists in both files or in neither. CI will not catch a one-sided
key, so the discipline lives in PR review and in the `palimps-product-
designer` skill checklist.

In Turkish, the in-app term for *moment* is **"an"** — never "moment".

---

## IV. Stratum II — Mediator (API)

A single Express process running tRPC v11 with `superjson` transformer.
The HTTP wrapper exists for cookies, CORS, and the RevenueCat webhook;
everything else is tRPC.

### Middleware ribbon

Every request walks this ribbon, in order:

1. **CORS + cookie parsing** — credentials always allowed; origin pinned
   to the app and the local dev URL.
2. **Session context** (`server/_core/context.ts`) — looks up the session
   cookie, attaches `ctx.user` if present.
3. **In-memory rate limit** (`server/_core/rateLimit.ts`) — per-IP buckets
   for auth and OCR, per-user buckets for chat. Memory-only because there
   is one Railway replica today; revisit when we scale horizontally.
4. **Procedure type** — `publicProcedure` requires nothing,
   `protectedProcedure` requires `ctx.user`.
5. **superjson** — serializes Date, Map, Set, undefined, BigInt across
   the wire. The client must use the same transformer.
6. **Premium gate** — feature-specific. `requirePremium()` reads
   `ctx.user.isPremium`, which is fed by RevenueCat webhooks.

### Routers

| Router         | Lives in                          | Owns                                       |
| -------------- | --------------------------------- | ------------------------------------------ |
| `authRouter`   | `server/routers.ts` (`auth`)      | Apple Sign In, session, refresh, revoke    |
| `booksRouter`  | `server/routers.ts` (`books`)     | CRUD, archive, cover upload, freemium      |
| `momentsRouter`| `server/routers.ts` (`moments`)   | OCR, enrichment, highlights, markings      |
| `chatRouter`   | `server/routers.ts` (`chat`)      | Reading assistant, context build, streams  |
| `storage`      | `server/storage.ts`               | Presigned PUT/GET URLs                     |
| `webhooks`     | `server/_core/revenuecat.ts`      | RevenueCat HMAC-verified webhook           |

### Procedure choice — public vs protected

The default is **protected**. A procedure is public only if there is a
specific reason it must be reachable without a session — currently only
the auth procedures themselves and the system health endpoint. When in
doubt, make it protected; promotion is cheaper than demotion.

### Why no GraphQL, no REST

tRPC gives end-to-end types from `server/routers.ts` to
`@trpc/react-query` on the client. With one developer, type drift is the
single biggest source of regressions. tRPC eliminates it. The HTTP
endpoints we keep (webhook, health) exist for parties that don't speak
tRPC.

---

## V. Stratum III — Substratum

The bedrock. Five external systems; each one is a single source of
truth for exactly one thing.

### V.1 MySQL on Railway — *the record*

Drizzle ORM, schema in `drizzle/schema.ts`. Tables, in the order they
were introduced:

```
users                    Apple subject id, email, name, isPremium snapshot
books                    title, author, cover_key (R2), archived flag
moments                  page text, photo_key, created_at, book_id
markings                 user-added marginalia
highlights               selected ranges within a moment's text
freemium_counters        daily / monthly counters per user
subscriptions            RevenueCat snapshot (entitlement, expiration)
apple_refresh_tokens     for Apple's revoke flow
```

Migrations live in `drizzle/0000_*.sql` … `drizzle/0009_*.sql` and are
**hand-applied** with `node scripts/apply-migration.mjs <file>.sql`.

Two specific gotchas, codified in `palimps-database-admin` and
re-stated here so they survive without the skill:

- **`drizzle-kit migrate` will not apply 0004+.** The `_journal.json`
  is stale after 0003. Use the script.
- **`drizzle-kit generate` is dangerous now.** It diffs against the
  stale snapshot 0003 and produces a single huge compound migration.
  Do not run it without a destination plan.

### V.2 Cloudflare R2 — *the photographs*

Used for two object types:

- Book covers — `covers/<user_id>/<book_id>/<hash>.jpg`
- Moment photos — `moments/<user_id>/<moment_id>/<hash>.jpg`

**Bytes never traverse the API tier.** The client asks the server for a
presigned `PUT` URL, then uploads the file directly to R2. On the
plate, this is the *media spine* — the ochre dashed line that bypasses
the API box on the way down.

Why: API tier sees no image bandwidth, no image CPU, no image memory.
The presigned URL has a short TTL and is scoped to the exact object
key, so the client cannot upload to a path it doesn't own.

KVKK / GDPR delete cascades by R2 prefix: deleting a user deletes
`covers/<user_id>/*` and `moments/<user_id>/*` in one prefix sweep.
Owned by `palimps-guardrails`.

### V.3 Gemini — *the language*

Two model routes, deliberate:

| Surface      | Model              | Reason                                     |
| ------------ | ------------------ | ------------------------------------------ |
| OCR          | `flash-lite`       | Cost-sensitive, structured page output     |
| Chat / enrich| `flash`            | Quality-sensitive, brand voice fidelity    |

Both go through `invokeLLM()` in `server/_core/llm.ts`. Prompts are
centralised in `server/_core/prompts.ts` — every prompt lives there,
nowhere else. Adding a prompt elsewhere is a review-blocking issue.

Brand voice for chat: **"sade kütüphaneci"** — a quiet librarian. Calm,
precise, no exclamation marks, no emoji, no startup-bro warmth. The
tone is the product. This is enforced at the prompt level and verified
in vitest model-output tests.

### V.4 Apple ID — *the identity*

`expo-apple-authentication` on the client; Apple JWKS verification on
the server (`server/_core/appleAuth.ts`). Refresh tokens are stored in
`apple_refresh_tokens` for the revoke flow required by Apple's account-
deletion policy.

Two consequences live in code that look strange without context:

- Apple `@privaterelay.appleid.com` emails are **never displayed raw**.
  The local part is a random hash. UI shows
  *"E-postamı Gizle" / "Hide My Email"* instead.
- Turkish locale `toLowerCase()` matters. `"I".toLowerCase()` returns
  `"i"` (dotted) by default; in Turkish, it should be `"ı"` (dotless).
  Use `.toLocaleLowerCase("tr-TR")` for any user-visible normalization.

### V.5 RevenueCat — *the entitlement*

The sole authority on whether a user is premium. The client SDK reports
purchases; the server receives webhooks and updates the
`subscriptions` snapshot. The `isPremium` column on `users` is a
**read-through cache** — useful for fast queries, but the truth lives
in RevenueCat.

The owner-email allowlist in `server/routers.ts` bypasses RevenueCat
for Hilal's dev account. Side effect: the paywall UI cannot be visually
tested on her device unless the allowlist is temporarily removed. Worth
remembering before a paywall design review.

---

## VI. Two spines — *the user-data path & the media path*

The plate marks two ochre dashed lines descending through the strata.
They are the architecture's two critical paths.

### VI.1 User-data spine — tRPC

Client → tRPC over HTTPS → API (with session cookie) → Drizzle → MySQL,
and back. Carries everything that is not an image: book metadata, OCR
text, moments, highlights, chat turns, subscription state.

Latency budget — server: **p95 < 300 ms** for read procedures, **p95 <
800 ms** for write procedures. LLM-backed procedures have their own
budgets in `palimps-llm-engineer`.

### VI.2 Media spine — R2 direct upload

Client → server (request presigned PUT URL) → R2 (direct upload from
client). The image never touches the API tier.

This spine is why a user uploading a 5 MB book cover does not stall a
chat request — they aren't on the same path.

---

## VII. Build & ship — *editio*

Every build:

```bash
# Bump buildNumber in app.config.ts (always, even for the same version)
# Then, from the user's Mac (not the sandbox — needs EAS auth):
eas build   --platform ios --profile production
eas submit  --platform ios --profile production --latest
```

Three rules survive across releases:

1. **`buildNumber` is strictly monotonic.** Apple rejects duplicates with
   a cryptic error. Owned by `palimps-release-manager`.
2. **EAS commands run on the user's Mac.** The Claude sandbox has no EAS
   auth. Never construct an EAS command intended to be run from the
   sandbox.
3. **Submit gate.** Nothing ships until `palimps-qa-tester`,
   `palimps-guardrails`, and `palimps-release-manager` clear it.

---

## VIII. Witness — *observability*

| Signal                | Where it lives             | What it answers                |
| --------------------- | -------------------------- | ------------------------------ |
| Crashes / traces      | Sentry (client + server)   | Why is this user hitting X?    |
| CPU / memory / logs   | Railway dashboard          | Is the server healthy?         |
| Subscriber funnel     | RevenueCat dashboard       | Is paywall converting?         |
| Pre-release perf      | Manual device profiling    | Is this build OK to ship?      |

Owned by `palimps-observability-engineer`. The skill localises a problem
to a stratum — client / API / DB / LLM — then hands off to the domain
expert.

---

## IX. Invariants

These are the rules the plate's legend points to. They survive
refactors. Breaking one is a release-blocking issue, not a code smell.

| #     | Invariant                                                              |
| ----- | ---------------------------------------------------------------------- |
| i.    | Image bytes never traverse the API tier.                              |
| ii.   | `isPremium` has exactly one source of truth: RevenueCat.              |
| iii.  | OCR routes to `flash-lite`. Chat and enrichment route to `flash`.     |
| iv.   | `tr.json` and `en.json` ship with identical key sets, or not at all.  |
| v.    | `buildNumber` is strictly monotonic across all submissions.           |
| vi.   | Apple `@privaterelay.appleid.com` local parts are never displayed.    |
| vii.  | KVKK / GDPR delete cascades by `user_id` and matching R2 prefixes.    |
| viii. | All LLM prompts live in `server/_core/prompts.ts` — nowhere else.     |
| ix.   | `protectedProcedure` is the default; `publicProcedure` is the case.   |

---

## X. What this document is not

It is not exhaustive. It does not describe every screen, every router,
every column. It describes the **shape**: where the layers are, what
they own, where the seams are, which paths matter. For everything else,
the codebase and the skill files are the reference.

It is not aspirational. It describes the system as built in April 2026,
not as imagined. When the system changes, this document changes too —
preferably in the same commit.

---

> *her kitap, başka bir kitabın altında yazılır.*
> *every book is written underneath another.*
