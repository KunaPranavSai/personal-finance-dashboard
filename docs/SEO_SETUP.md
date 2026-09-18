# SEO, Discovery & AI-Discovery Setup — Penny Pilot

Production domain: **https://www.pennypilot.pro**

> **Deployment history note:** Vercel's Domains config redirects the apex
> `pennypilot.pro` → `www.pennypilot.pro` (confirmed via `curl -I`, a `308
> Permanent Redirect`), so `www` is the real canonical domain — not the
> apex. All references below were corrected to `www.pennypilot.pro` to
> match. Separately, the first pass of this SEO work (og-image.png,
> llms.txt, the split `(app)`/`(admin)` layouts, etc.) caused live 404s
> because those files were created locally but never `git commit`+`push`ed
> — Vercel deploys from the GitHub commit, so it never saw them. That has
> been fixed: everything is now committed and pushed to `origin/main`.

## Architecture

Penny Pilot's frontend is a Next.js 15 App Router app. `/` immediately redirects to `/dashboard`, which is authenticated — unauthenticated visitors end up at `/login`. There is currently no dedicated marketing landing page; `/login` is the real public entry point and carries full metadata + structured data.

### Metadata (`frontend/src/app/layout.tsx`)

Root metadata sets `metadataBase`, title/template, description, keywords, authors/creator/publisher, `applicationName`, `category`, default `robots` (index, follow), Open Graph, Twitter card, icons, manifest, and `verification` (Google/Bing, both env-driven and only emitted if the corresponding env var is set — no fake tokens are hardcoded).

`SITE_URL` lives in `frontend/src/lib/siteUrl.ts` and is reused by `layout.tsx`, `robots.ts`, `sitemap.ts`, and the JSON-LD component — one source of truth, no hardcoded domain duplicated across files.

### Public routes (indexed)

- `/` — redirects to `/dashboard` (see note above)
- `/login` — page-specific metadata + canonical + `SoftwareApplication`/`Organization` JSON-LD
- `/signup` — page-specific metadata + canonical
- `/forgot-password`
- `/terms` — pre-existing page-specific metadata (unchanged)
- `/privacy-policy` — pre-existing page-specific metadata (unchanged)

### Private routes (noindex, excluded from sitemap)

Everything under the `(app)` and `(admin)` route groups — dashboard, expenses, income, budget, bills, savings, goals, investments, analytics, reports, notifications, customizations, profile, settings, all `/admin/*` — plus `connect-drive`, `setup-2fa`, `admin-login`, `403`.

Because `(app)/layout.tsx` and `(admin)/layout.tsx` were client components (`"use client"`), they could not export `metadata` directly. Each was split:

- `(app)/AppShellLayoutClient.tsx` / `(admin)/AdminShellLayoutClient.tsx` — the original client component, unchanged behavior.
- `(app)/layout.tsx` / `(admin)/layout.tsx` — new thin server components that export `metadata: { robots: { index: false, follow: false } }` and render the client component.

This adds a page-level `<meta name="robots" content="noindex, nofollow">` on every authenticated route, on top of the existing `robots.txt` disallow rules — verified in production build output (`curl /dashboard` → `noindex, nofollow` present).

No authentication or authorization logic was touched.

## Sitemap (`frontend/src/app/sitemap.ts`)

Dynamic `MetadataRoute.Sitemap` at `/sitemap.xml`, listing only the public routes above. Verified valid XML via `curl http://localhost:3000/sitemap.xml`.

## robots.txt (`frontend/src/app/robots.ts`)

Dynamic `MetadataRoute.Robots` at `/robots.txt`. Allows the public routes, disallows every authenticated/admin/internal route, and points `Sitemap:` at `https://www.pennypilot.pro/sitemap.xml`. Pre-existing file — only the hardcoded domain fallback was corrected (see Environment variables).

## Open Graph / Twitter image

`frontend/public/og-image.png` — 1200×630 PNG generated from the app's real branding (the existing `public/logo.png` composited onto a dark navy/teal panel with the product name and a one-line description, matching the app's actual dark theme colors). No stock imagery. Served at `https://www.pennypilot.pro/og-image.png` once deployed; verified locally returns `200 image/png`.

Twitter card uses `summary_large_image` with the same image (no separate asset needed).

## JSON-LD structured data

`frontend/src/components/seo/SoftwareApplicationJsonLd.tsx`, rendered on `/login`. Emits `Organization` and `SoftwareApplication` (`@graph`). Only real, verifiable facts are included (name, URL, logo, description, category, platforms). No fabricated ratings, reviews, pricing, or awards, per the task constraints.

## llms.txt (`frontend/public/llms.txt`)

Plain-text explainer for AI crawlers/agents: what Penny Pilot is, its major public-facing features, its public pages, and an explicit note that authenticated routes/private financial data/admin tooling are out of scope and excluded from indexing. Contains no secrets, credentials, internal endpoints, or architecture details beyond what's already public (Next.js + Node/Express + PostgreSQL, Google Drive as an optional sync backend).

## Environment variables

Added to `frontend/.env.example`:

| Variable | Purpose | Required |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Canonical site URL for metadata/canonical/sitemap/robots/OG/JSON-LD. Defaults to `https://www.pennypilot.pro` if unset. Override for local/staging. | No (has a safe default) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Google Search Console HTML-tag verification token. Only emits the meta tag when set. | No |
| `NEXT_PUBLIC_BING_SITE_VERIFICATION` | Bing Webmaster Tools verification token. Only emits the meta tag when set. | No |

**Production must set `NEXT_PUBLIC_APP_URL=https://www.pennypilot.pro`** (or leave it unset, since that's now the default) — do not let it resolve to a Vercel preview URL or `localhost`.

## Google Search Console — manual steps (not yet performed)

1. Open Google Search Console → Add property → `https://www.pennypilot.pro`.
2. Prefer **Domain property** verification (covers `http`/`https` and any subdomain) via a DNS TXT record at your domain registrar — no code changes needed.
3. Alternatively, use **HTML tag** verification: Search Console gives you a `content` value; set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` to that value in the production environment and redeploy, then click "Verify".
4. Once verified, submit `https://www.pennypilot.pro/sitemap.xml` under Sitemaps.
5. Use URL Inspection on `https://www.pennypilot.pro/` (and `/login`) and request indexing if needed.

*Verification has not been performed as part of this change — no token exists yet, and none was invented.*

## Bing Webmaster Tools — manual steps (not yet performed)

1. Add `https://www.pennypilot.pro` at https://www.bing.com/webmasters.
2. Verify via the XML/meta-tag method: set `NEXT_PUBLIC_BING_SITE_VERIFICATION` to the token Bing provides and redeploy — or import verified ownership directly from Google Search Console if offered.
3. Submit `https://www.pennypilot.pro/sitemap.xml` under Sitemaps.
4. Check crawl/index status under Site Explorer / Search Performance.

*Verification has not been performed as part of this change — no token exists yet, and none was invented.*

## Production verification checklist

- [ ] `NEXT_PUBLIC_APP_URL` is unset or explicitly `https://www.pennypilot.pro` in the production environment (not a Vercel preview URL).
- [x] `https://www.pennypilot.pro/robots.txt` allows public routes, disallows authenticated/admin routes, references the sitemap. *(verified locally against the built output; re-verify against the live domain after deploy.)*
- [x] `https://www.pennypilot.pro/sitemap.xml` is valid XML with only public routes. *(verified locally; re-verify against the live domain after deploy.)*
- [x] `https://www.pennypilot.pro/llms.txt` is reachable and contains no private information. *(verified locally.)*
- [x] `https://www.pennypilot.pro/og-image.png` returns `200` with `image/png`. *(verified locally.)*
- [ ] View source / inspect element on `https://www.pennypilot.pro/login` in production and confirm `og:title`, `og:description`, `og:image`, `twitter:card`, and canonical all resolve to the `pennypilot.pro` domain (not `www.` or a preview URL).
- [x] `/dashboard` (and other authenticated routes) render `<meta name="robots" content="noindex, nofollow">`. *(verified locally via `curl`.)*
- [x] Authentication/authorization behavior unchanged — no middleware, guard, or route-protection logic was modified.
- [x] `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass with no new errors introduced by this change.

## Files created

- `frontend/public/og-image.png`
- `frontend/public/llms.txt`
- `frontend/src/lib/siteUrl.ts`
- `frontend/src/components/seo/SoftwareApplicationJsonLd.tsx`
- `frontend/src/app/(app)/layout.tsx` (new server layout; old client logic moved to `AppShellLayoutClient.tsx`)
- `frontend/src/app/(admin)/layout.tsx` (new server layout; old client logic moved to `AdminShellLayoutClient.tsx`)
- `frontend/src/app/login/page.tsx` (new server page; old client logic moved to `LoginPageClient.tsx`)
- `frontend/src/app/signup/page.tsx` (new server page; old client logic moved to `SignupPageClient.tsx`)
- `docs/SEO_SETUP.md` (this file)

## Files modified

- `frontend/src/app/layout.tsx` — richer metadata, correct production domain, verification hooks
- `frontend/src/app/robots.ts` / `frontend/src/app/sitemap.ts` — corrected domain fallback, shared `SITE_URL`
- `frontend/.env.example` — documented `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION`

## Routes excluded from indexing (recap)

`/dashboard`, `/expenses`, `/income`, `/budget`, `/bills`, `/investments`, `/savings`, `/goals`, `/analytics`, `/reports`, `/notifications`, `/customizations`, `/profile`, `/settings*`, `/connect-drive`, `/setup-2fa`, `/admin*`, `/admin-login`, `/403`, and all `/api/*` (backend, separate origin — not part of the frontend sitemap/robots surface at all).

## Anything still requiring manual action

- Actually performing Google Search Console and Bing Webmaster Tools verification (see steps above) — needs access to DNS or the live deployed environment variables, which this change does not have.
- Setting `NEXT_PUBLIC_APP_URL` (or confirming its default) in the real Vercel production environment.
- Optionally building a dedicated public marketing/landing page at `/` instead of an immediate redirect to `/dashboard` — out of scope here as a feature change, but worth knowing: today, a bare fetch of `https://www.pennypilot.pro/` returns an HTTP redirect with no rendered body, so social-media unfurlers/crawlers that don't follow redirects will see nothing at the bare domain. Crawlers that do follow redirects land on `/login`, which has full metadata.
