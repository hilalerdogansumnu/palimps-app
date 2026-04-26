# PALIMPS — Static Landing Site

Self-contained static site for [palimps.app](https://palimps.app). Deployed on Netlify.

## Structure

```
website/
├── index.html              Landing page (TR default, EN toggle)
├── privacy/
│   └── index.html          Privacy policy — served at /privacy
├── 404.html                Custom 404
├── netlify.toml            Build config + security headers + redirects
├── robots.txt              Allow all
├── sitemap.xml             /, /privacy
├── icon.png                App icon (1024×1024) — used for favicon + OG image
├── favicon.png             Small favicon
└── assets/
    ├── icon.svg            Master brand icon SVG (reference only)
    └── screenshot-*.png    Placeholder screenshots — REPLACE with fresh captures
                            before prod launch. Filenames stable; landing page
                            will pick them up automatically if re-enabled.
```

## Local preview

```bash
cd website
python3 -m http.server 8080
# Open http://localhost:8080
```

Or Netlify CLI:

```bash
npx netlify dev
```

## Deploy

### Option A — Netlify CLI (first-time setup)

```bash
cd website
npx netlify deploy           # preview
npx netlify deploy --prod    # production
```

Sets `publish = "."` from `netlify.toml`. First run asks to link/create a site.

### Option B — Git-based

1. Either commit `website/` into this repo and set Netlify base = `website/`, OR
2. Create a separate repo just for the website and push `website/` contents to its root.

Netlify will detect `netlify.toml` automatically.

### Domain

Point `palimps.app` DNS to Netlify (A records + CNAME for www). Then uncomment
the www→apex redirect block in `netlify.toml`.

## Editing content

- **Copy edits (TR + EN):** both language versions live side-by-side inside
  `.tr` and `.en` span/div pairs. Keep them in sync — the toggle relies on
  pairs being present.
- **Email:** Turkish UI uses `iletisim@palimps.app`, English UI uses
  `hello@palimps.app`. Both forward to the personal Gmail inbox via ImprovMX.
  To change destination, update the alias in the ImprovMX dashboard — no
  code change needed. Privacy / KVKK pages also follow this TR/EN split.
- **Screenshots:** when fresh screenshots are ready, replace files under
  `assets/screenshot-0N.png` (1290×2796 PNG). The hero is currently minimal
  (icon + wordmark); to re-enable the screenshot gallery, swap the
  `.showcase` block in `index.html` back to the `.shots` version from git
  history, or open this file and follow the comment block near the hero.

## Privacy page

Lives at `/privacy/index.html` so Netlify serves it at the pretty URL
`/privacy` natively — no redirect needed. The uploaded HTML is kept verbatim;
don't edit it here without also updating the source.

## Security headers

Baseline headers set in `netlify.toml`:

- HSTS (1 year, includeSubDomains, preload)
- CSP (self only; inline styles + scripts allowed — inline is used)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()

If you add third-party embeds later (YouTube, analytics, etc.), update the
CSP accordingly.

## Brand tokens (source of truth)

Colors pulled from `design/brand/BRAND.md`:

| Token | Hex |
|---|---|
| Primary violet | `#6B4CDB` |
| Deep violet | `#4A2C9E` |
| Light lavender | `#B39DDD` |
| Paper 1 (top) | `#FBF3DF` |
| Paper 2 (mid) | `#F0E7D1` |
| Paper 3 (back) | `#E4D9BF` |
| Foreground | `#160E2C` |
| Muted | `#5F5678` |

Light and dark themes both covered via `prefers-color-scheme`.
