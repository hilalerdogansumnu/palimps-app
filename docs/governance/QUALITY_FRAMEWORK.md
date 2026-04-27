# PALIMPS Quality Framework

**Version:** 1.0.1
**Last updated:** 2026-04-19
**Maintainer:** palimps-retrospective-engineer

---

## Why This Document Exists

PALIMPS is a reading-memory app built by a one-person team with AI assistance. The team cannot afford to rely on any one person's memory, taste, or vigilance — humans forget, get tired, and rationalize shortcuts. This document is the **non-negotiable reference** every skill in the team points to. Skills come and go; this document is the spine.

The framework has two jobs:
1. Define what "quality" means in measurable, falsifiable terms.
2. Define how the definition itself evolves when reality teaches us something new.

---

## The Five Layers

Quality is produced by five stacked layers. A lower layer cannot be substituted by a higher one. If Layer 1 (measurement) is missing, Layer 5 (taste) is blind. If Layer 2 (standards) is missing, Layer 3 (automation) has nothing to enforce. Skills are assigned to the layer they primarily serve. Cross-layer skills (like backend-engineer, which serves both L3 and L1) must declare which layer a given decision belongs to.

### Layer 1 — Measurable Thresholds
*If you can't measure it, you can't protect it.*

The numerical bars below are the **baseline**. A release that crosses any of these bars is blocked until remediated. These numbers come from App Store benchmarks, Apple HIG performance guidance, and consumer app industry norms.

| Metric | Bar | Source | Owner |
|---|---|---|---|
| Crash-free sessions (rolling 7d) | ≥ 99.8% | App Store Connect | observability-engineer |
| Crash-free users (rolling 7d) | ≥ 99.5% | App Store Connect | observability-engineer |
| p95 API latency (all tRPC procedures) | < 400ms | Server logs | backend-engineer |
| p99 API latency | < 1200ms | Server logs | backend-engineer |
| Cold start Time-to-Interactive (iPhone 13 or newer) | < 2.0s | Xcode Instruments | ios-developer |
| Warm start TTI | < 800ms | Xcode Instruments | ios-developer |
| List scroll jank (90+ fps sustained on iPhone 15) | < 1% dropped frames | Instruments | ios-developer |
| Test coverage (critical paths: auth, book add, moment add, sync) | ≥ 80% | Jest + Maestro | qa-tester |
| Test coverage (overall) | ≥ 60% | Jest | qa-tester |
| Bundle size (iOS .ipa, download) | < 40MB | App Store Connect | release-manager |
| Memory footprint (steady state, after 5min active use) | < 180MB | Instruments | ios-developer |
| Battery drain (1hr active use) | < 8% on iPhone 13 | Xcode Energy Log | ios-developer |
| Offline tolerance (add-moment works fully offline) | 100% functional | Maestro offline test | qa-tester |
| Image upload P95 (over 4G) | < 6s | Analytics | backend-engineer |
| Accessibility contrast (text) | ≥ 4.5:1 | Figma + runtime audit | accessibility-specialist |
| Accessibility contrast (large text / UI) | ≥ 3.0:1 | Figma + runtime audit | accessibility-specialist |
| VoiceOver coverage (every interactive element) | 100% labeled | Manual audit | accessibility-specialist |
| Days since last Sentry event (client, server) | ≤ 7 days during active usage; 0 days since the current release | Sentry dashboard | observability-engineer |

**Rule:** A bar is never lowered without a written amendment explaining why, approved in `CHANGELOG.md`. Bars may be **tightened** freely.

### Layer 2 — Authoritative Standards
*Someone smarter than us already wrote down what to do.*

PALIMPS defers to these external authorities. Skills cite specific sections, not vibes. "Apple says so" without a section reference is not acceptable.

- **Apple Human Interface Guidelines** — design, motion, typography, haptics
- **App Store Review Guidelines** — especially 1.1 (objectionable content), 1.2 (user-generated), 2.1 (performance), 2.3.x (accurate metadata), 3.1.1 (in-app purchase), 4.0 (design), 5.1.x (privacy), 5.6.x (developer code of conduct)
- **Apple Privacy Manifest** requirements (`PrivacyInfo.xcprivacy`)
- **WCAG 2.1 Level AA** — accessibility
- **KVKK** (Turkish law 6698) — data protection for TR users
- **GDPR** — data protection for EU users
- **COPPA** — children's privacy (even though we don't target children, the defaults apply)
- **OWASP Mobile Top 10 (2024)** — security
- **Unicode CLDR** — locale formatting
- **RFC 7519** (JWT), **RFC 6749** (OAuth 2.0) — auth
- **Apple Sign In REST API** — token revocation requirement

**Rule:** When two standards conflict, the legal standard (KVKK/GDPR/COPPA) wins over guidelines (HIG/Review). When two guidelines conflict, document the decision in an amendment.

### Layer 3 — Automated Gates
*Human attention is a rationed resource. Spend it only on what robots cannot check.*

Every rule that can be expressed as code must be expressed as code. Manual review is the last line of defense, not the first. The following gates run without human intervention:

- **TypeScript strict mode** — `strict: true`, no `any` without a written justification comment
- **ESLint + Prettier** — enforced on commit via Husky
- **Zod schemas** — every tRPC input/output, every stored data structure
- **Drizzle migrations** — every schema change, no raw SQL in production
- **CI pipeline** (GitHub Actions): type check → lint → unit tests → integration tests → build → bundle size check
- **EAS Build** — reproducible, no local builds in production
- **Maestro smoke test** — every build, 5 critical flows
- **Sentry source maps** — uploaded automatically on release
- **Privacy manifest check** — every release, against the approved tracked-domains list
- **Dependency audit** — `npm audit` on PR, Dependabot weekly
- **Secret scanning** — GitHub's + TruffleHog on pre-push hook
- **No `console.log` in production builds** — ESLint rule

**Rule:** When a bug escapes to production that a gate could have caught, the retrospective protocol *must* add that gate before closing the incident. "We'll remember next time" is an unacceptable remediation.

### Layer 4 — Real User Signal
*The user is the final judge, but only if we listen.*

Assumptions about users are lies we tell ourselves. The following signals are collected and reviewed weekly:

- **Sentry** — errors, performance, user-affected sessions
- **Analytics** (privacy-first, opt-in default off) — activation funnel, retention curves, feature adoption
- **App Store reviews** — monitored daily, responded to within 48hrs
- **TestFlight feedback** — reviewed within 24hrs
- **Support email / in-app feedback** — inbox zero target 72hrs
- **Session replay** (opt-in only, PII-masked) — used for friction investigation

**Rule:** A feature's success is defined *before* it ships (target retention %, target adoption %, target satisfaction signal). If those targets are not hit within the defined window, the feature is revisited — not rationalized.

### Layer 5 — Taste
*Taste is not a substitute for craft. It's the final polish on craft.*

Taste operates *after* the lower four layers are satisfied. A beautiful app that crashes is not well-designed; it's a contradiction. The team's taste references are:

- **Linear** — velocity, keyboard-first, restraint
- **Storytel** — warmth, bookish intimacy
- **Supercell (Clash Royale / Clash of Clans)** — micro-interaction polish, haptic timing, satisfying feedback
- **Arc Browser** — opinionated information architecture
- **Things 3** — gesture elegance, animation timing

**Rule:** A taste reference must be translated into a concrete, measurable design decision (a specific easing curve, a haptic pattern, a color ramp) before it enters the codebase. "Linear-like" is not a specification; "300ms spring animation with damping 0.8, matching Linear's list-reorder feel" is.

---

## The Self-Improvement Loop

The framework is alive. It changes when reality teaches us something. The loop has five steps:

### 1. Signal
Something happened. Examples:
- Sentry alert fires
- App Store review mentions a problem
- A user reports a bug
- A test fails intermittently
- A code review catches something a gate should have caught
- A release metric degrades (crash rate, latency)
- A compliance concern surfaces (KVKK/GDPR complaint, App Store rejection)

### 2. Observation
`palimps-retrospective-engineer` is invoked. It gathers:
- What was the symptom?
- What was the impact (how many users, how severe)?
- What was the timeline?
- What was the root cause (5-whys, blameless)?

### 3. Attribution
Which layer *should* have caught this? Which skill *should* have prevented it? This is not about blame — it's about where to patch.

- If the bug could have been caught by a test → Layer 3, qa-tester owns amendment
- If the bug violated a known standard → Layer 2, relevant skill owns amendment
- If the bug was a metric regression nobody noticed → Layer 1, observability-engineer owns amendment
- If users hated a feature that passed all gates → Layer 4/5, product-manager or product-designer owns amendment

### 4. Amendment
A file is written to `AMENDMENTS/AMND-YYYY-NNN.md` using the template in `AMENDMENTS/README.md`. The amendment:
- Identifies the root-cause layer
- Lists skills to be updated
- Specifies the concrete change (new rule, new threshold, new checklist item)
- Is merged into the relevant skill file(s) and/or this framework
- Increments the framework version if the change is material

### 5. Verification
After the amendment is in place, the next occurrence of a similar signal is tracked. If the amendment worked, it stays. If the signal recurs, the amendment was wrong — a *second* retrospective is triggered, and the amendment itself is revised. The goal is convergence, not infinite patching.

---

## Review Cadences

| Cadence | What happens | Owner |
|---|---|---|
| Per incident (P0/P1) | Retrospective within 48hrs | retrospective-engineer |
| Per release | 72hr post-release metrics review | release-manager + observability |
| Weekly | Sentry triage, review triage, metric dashboard | observability-engineer |
| Monthly | Pattern review across all amendments; framework version bump if needed | retrospective-engineer |
| Quarterly | Full framework audit; obsolete bars removed; new bars added | retrospective-engineer |

---

## How To Use This Document

- **Every skill in `palimps-team/` points to this file.** A skill without a framework reference is incomplete.
- **Every PR description** references the framework layer(s) it affects.
- **Every amendment** updates this file's version number and adds a changelog entry.
- **This file is read-only for humans** except through the amendment process. No drive-by edits.

---

## Version

`1.0.1` — AMND-2026-001 merged (2026-04-19): Sentry-pulse release gate, eas.json env-drift gate, `// TEMP:` marker gate, new Layer 1 threshold for Sentry event freshness.
`1.0.0` — Initial framework (2026-04-19).
See `CHANGELOG.md` for history.
