# PALIMPS

*Personal reading memory for physical books — fiziksel kitaplar için okuma hafızası.*

PALIMPS, fiziksel kitaplardan kalan izleri toparlayan bir iOS uygulamasıdır.
Kullanıcı sayfayı fotoğraflar; uygulama OCR'lar, anı kaydeder, vurgular ve
marjinalia ekler. Sonradan bunlar üzerinde sade bir kütüphaneci tonunda
sohbet edebilir.

> **Status:** TestFlight aşaması, iOS-only. Türkçe + İngilizce ship ediyor.
> **Owner:** Hilal Erdoğan Sümnü ([@hilalerdogansumnu](https://github.com/hilalerdogansumnu))

---

## Stack

| Katman      | Seçim                                                            |
| ----------- | ---------------------------------------------------------------- |
| Client      | React Native, Expo SDK 54, Expo Router, NativeWind v4            |
| API         | Express + tRPC v11 (superjson), Node 20, Railway                 |
| Database    | MySQL on Railway, Drizzle ORM (hand-applied migrations)          |
| Storage     | Cloudflare R2 — presigned PUT/GET, bytes never hit the API tier  |
| LLM         | Gemini — `flash-lite` (OCR), `flash` (chat + enrichment)         |
| Auth        | Apple Sign In (`expo-apple-authentication`), session cookies     |
| Payments    | RevenueCat (iOS) — entitlement source of truth                   |
| Crashes     | Sentry                                                           |
| Build       | EAS Build + Submit                                               |
| Tests       | vitest (server) + manual device QA                               |
| Pkg manager | **pnpm** (npm/yarn değil)                                        |

Tüm mimari için: [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md).

---

## Running locally

```bash
pnpm install            # bağımlılıklar
pnpm dev                # tsx server + Expo metro paralel
pnpm dev:server         # sadece server
pnpm ios                # iOS simulator
pnpm test               # vitest
pnpm check              # tsc --noEmit
```

`.env` yalnızca `EXPO_PUBLIC_*` client değişkenlerini içerir. `DATABASE_URL`,
`GEMINI_API_KEY`, `R2_*` gibi server değişkenleri Railway'in env panelinde —
yerel script'ler için `railway run node scripts/...` kullan.

Migration uygulamak (drizzle-kit migrate **çalışmıyor**, journal stale):

```bash
node scripts/apply-migration.mjs drizzle/000N_<name>.sql
```

---

## Build & ship

EAS komutları kullanıcının Mac terminal'inden çalışır (sandbox'tan değil):

```bash
eas build  --platform ios --profile production
eas submit --platform ios --profile production --latest
```

`buildNumber`'ı `app.config.ts` içinde **her build'de artır**. Apple
duplicate'leri reddeder. Detay: [`docs/architecture/ARCHITECTURE.md` § VII](./docs/architecture/ARCHITECTURE.md).

---

## Docs

```
docs/
├── architecture/        Mimari plate, ARCHITECTURE.md, design philosophy
├── governance/          Quality framework, KVKK/GDPR data governance
├── product/             Decisions log, premium model, product audits
├── design/              UI/UX tasarım planı (.docx)
├── release/             App Store Connect metadata
├── handoffs/            Session handoff'ları (state taşıyıcılar)
└── _archive/            Eskimiş ama referans için tutulan dokümanlar
```

Yeni bir oturum başlarken **önce** son `docs/handoffs/SESSION-*.md`'yi
oku — context oradan gelir.

---

## License

© 2026 Hilal Erdoğan Sümnü. Proprietary; no contributions accepted.

---

> *her kitap, başka bir kitabın altında yazılır.*
