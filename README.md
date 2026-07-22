# Penny Pilot

A modern personal finance management web app: Next.js 15 + TypeScript frontend,
Express + Prisma + PostgreSQL backend. Built to replace the Excel-based
personal finance workbook with a real SaaS-style application.

## What's implemented in this pass

- **Dashboard** — 17 live KPI cards (income, expenses, savings, net worth, cash
  flow, budget utilization, savings rate, financial health score, emergency
  fund progress, investment growth, highest category, largest expense,
  averages, transaction count) + Income vs Expense trend chart, Category
  donut chart, and a Financial Health gauge. All computed live from the
  database — nothing hardcoded.
- **Transactions** — full CRUD, search, type filter, pagination, empty state.
- **Budget Planner** — set a monthly budget per category; actual spend,
  remaining, utilization %, variance, and status (Under Budget / Near Limit /
  Over Budget) are all computed live from transactions.
- No demo/seed transactions. The seed script only creates the category /
  subcategory / account taxonomy so dropdowns aren't empty — every screen
  starts with a proper empty state ("No Transactions Yet", "Create Your First
  Budget", "No Data Available" on charts) per the spec.
- All currency is ₹ INR formatted with the Indian numbering system
  (`en-IN` locale, e.g. ₹12,50,000), dates are DD-MM-YYYY.

## Not implemented in this pass (see PROJECT_STATUS.md)

Auth, Income/Expenses/Savings/Investments/Bills/Goals/Analytics/Reports/
Notifications/Settings/Profile pages, CSV/Excel/PDF import-export, and the
exotic chart types (treemap/sunburst/waterfall) are not built yet. The nav
sidebar links to all of them, but only Dashboard, Transactions, and Budget
have real pages right now — the rest will 404 until built in a follow-up
pass. This was scoped deliberately (see your last answer: "full-stack core
… Dashboard + Transactions + Budget … no auth yet").

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (for Postgres, or install Postgres locally)

## Quick start

```bash
# 1. Start Postgres (or point DATABASE_URL at your own instance)
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma generate      # downloads Prisma's query engine — needs network access
npx prisma migrate dev --name init
npm run seed              # creates categories/subcategories/accounts only, no transactions
npm run dev                # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                # http://localhost:3000
```

Open http://localhost:3000 — you'll land on the Dashboard with an honest
empty state until you add your first transaction and budget.

## Important: Prisma generate

This code was written in a sandboxed environment that could not reach
`binaries.prisma.sh`, so `npx prisma generate` / `prisma migrate` could not
be run or verified here. The schema (`backend/prisma/schema.prisma`) and all
controller code were written and hand-reviewed against it, and the rest of
the backend (`tsc --noEmit`) has zero errors once the Prisma client types
exist — but you must run `npx prisma generate` and `npx prisma migrate dev`
yourself as the first step. The frontend was fully installed and both
`tsc --noEmit` and `next build` pass with zero errors in this environment.

## Project structure

```
pfd-pro/
├── backend/           Express + Prisma API (REST, no auth yet)
│   ├── prisma/         schema.prisma, seed.ts
│   └── src/
│       ├── controllers/  business logic (budget status calc, KPI aggregation)
│       ├── routes/
│       ├── schemas/     Zod validation
│       └── middleware/   error handling, validation
├── frontend/          Next.js 15 App Router
│   └── src/
│       ├── app/(app)/    dashboard, transactions, budget pages (sidebar shell)
│       ├── components/   kpi, charts, transactions, budget, ui primitives
│       ├── lib/          api client, ₹ / date formatting
│       └── store/        zustand (theme)
├── docker-compose.yml  postgres + backend + frontend
└── .github/workflows/ci.yml
```

## API summary

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard/summary` | All dashboard KPIs |
| GET | `/api/dashboard/trend/income-expense` | Monthly income/expense trend |
| GET | `/api/dashboard/breakdown/category` | Category-wise expense totals |
| GET/POST | `/api/transactions` | List (paginated/filtered) / create |
| GET/PATCH/DELETE | `/api/transactions/:id` | Read / update / delete |
| POST | `/api/transactions/bulk-delete` | Bulk delete by id array |
| GET/POST | `/api/budgets` | List with live actual/status / create |
| PATCH/DELETE | `/api/budgets/:id` | Update / delete |
| GET/POST | `/api/categories`, `/api/accounts` | Reference data for dropdowns |

## Progressive Web App

The frontend is an installable PWA (`@ducanh2912/next-pwa`, Workbox under the hood). Configuration lives in
`frontend/next.config.ts`; only regenerate the pieces below if you deliberately want to change PWA behavior.

- **Manifest**: `frontend/public/manifest.webmanifest` — name, icons, `display: standalone`,
  `orientation: portrait-primary`, theme/background colors, and app shortcuts (Dashboard, Add Expense, Add
  Income, Investments).
- **Icons**: `frontend/public/icons/*.png`, generated from `public/logo.png` via `sharp`. Regenerate with:
  ```bash
  node -e "const sharp=require('sharp'); const sizes=[72,96,128,144,152,192,384,512]; (async()=>{ for (const s of sizes) await sharp('public/logo.png').resize(s,s).png().toFile('public/icons/icon-'+s+'.png'); })()"
  ```
  if the source logo ever changes.
- **Service worker**: generated at build time only (`disable: NODE_ENV === "development"`) into
  `frontend/public/sw.js` + `workbox-*.js` — these are build artifacts, not committed (see `.gitignore`).
  Runtime caching: dashboard endpoints and lookup data (`categories`/`accounts`/`payment-methods`) use
  `StaleWhileRevalidate`; every other `/api/*` route is `NetworkOnly` (financial write/read endpoints must
  never serve stale data); static assets/images use Workbox's default cache-first strategy.
  `cleanupOutdatedCaches: true` removes stale precaches automatically on each new deploy.
- **Offline fallback**: `frontend/src/app/~offline/page.tsx`, served when a navigation has no cache match and
  no network.
- **Offline write queue**: creating an Expense, Income, Budget, or Investment while offline is queued in
  IndexedDB (`frontend/src/lib/offlineQueue.ts`) instead of failing. It syncs automatically when the tab
  regains connectivity (`OfflineSyncManager`), and via the Background Sync API (`frontend/worker/index.ts`,
  a custom service worker source merged into the generated one) if the tab was closed before that happened —
  falls back gracefully to the online-event listener on browsers without Background Sync support (Safari).
- **Update prompts**: `skipWaiting: false` — a new deployed version sits "waiting" until the user clicks
  Refresh in `ServiceWorkerUpdatePrompt`, rather than silently swapping under an open tab.
- **Testing locally**: the service worker only runs on a production build (`npm run build && npm run start`),
  not `npm run dev`. Use Chrome DevTools → Application → Service Workers / Manifest, or Lighthouse's PWA
  audit, against the `next start` server.

## Security

- **PWA install prompt**: gated to after login only (`frontend/src/components/pwa/PwaInstallPrompt.tsx`,
  `frontend/src/lib/pwaInstall.ts`) — shown once per device 7s after the dashboard loads, never if already
  installed, and not again for 1h after a dismissal. Manual install is always available from
  Settings → Appearance → Install App.
- **Strict, server-anchored session timer**: session expiry (`frontend/src/lib/AuthContext.tsx`) is purely
  elapsed-time — mouse/keyboard/scroll activity and background API calls never extend it. A warning banner
  appears at 30s remaining, a blocking modal at 15s (`SessionWarningBanner`/`SessionWarningModal`), and
  "Extend Session" calls the real `/api/auth/refresh` endpoint (never a client-side reset). The countdown is
  synced across tabs via `localStorage` + the `storage` event, and expiry logs out every open tab.
- **Periodic 2FA re-verification**: accounts with 2FA enabled must re-enter a TOTP code every 12h
  (`tfaVerifiedAt` JWT claim, enforced by `requireRecent2FA` in `backend/src/middleware/auth.ts`) before
  sensitive actions — export, backup/restore, profile changes, password/UID changes, disabling 2FA. Blocked
  requests return `403 { code: "2FA_REVERIFICATION_REQUIRED" }`, which the frontend
  (`frontend/src/components/ui/TwoFactorReverifyDialog.tsx`) intercepts with a full-screen re-verify prompt
  hitting `POST /api/auth/2fa/reverify`. Users without 2FA are unaffected.
- **Passkeys / biometric sign-in**: WebAuthn-based sign-in (`@simplewebauthn/server` + `@simplewebauthn/browser`)
  supporting Windows Hello, Touch ID, Face ID, Android biometrics, and hardware security keys. Enroll or
  remove devices from Settings → Security → Passkeys & Biometrics (both require password, plus a TOTP code
  if 2FA is enabled). The login screen offers "Continue with Biometrics" as a usernameless (discoverable
  credential) flow alongside the standard password form, with automatic fallback when the browser/device
  doesn't support WebAuthn. Credentials are stored in the `Passkey` Prisma model
  (`backend/prisma/schema.prisma`); the RP ID/origin are derived from the existing `APP_URL`/`FRONTEND_URL`
  env vars (`backend/src/lib/webauthn.ts`) — no new config needed.

See PROJECT_STATUS.md for what to build next.
