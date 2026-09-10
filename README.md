# Penny Pilot

**Live app: [https://www.pennypilot.pro](https://www.pennypilot.pro)**

Penny Pilot is a full-stack personal finance management web application for tracking income,
expenses, budgets, savings, investments, bills/EMIs, and financial goals — with a distinctive
architectural choice: **every user's financial data is stored in their own Google Drive**, not in
a central database. Penny Pilot is the application layer; your Google Drive is the database.

Built with a Next.js 15 + TypeScript frontend and an Express + Prisma + PostgreSQL backend.

---

## Table of Contents

- [Key Features](#key-features)
- [Why Google Drive as Storage?](#why-google-drive-as-storage)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Getting Started Locally](#getting-started-locally)
- [Google OAuth Setup](#google-oauth-setup-required-to-run-financial-features-locally)
- [Environment Variables](#environment-variables)
- [Security](#security)
- [Progressive Web App](#progressive-web-app)
- [Deployment](#deployment)
- [License & Legal](#license--legal)
- [Contact](#contact)

---

## Key Features

- **Dashboard** — live KPI cards (income, expenses, savings, net worth, cash flow, budget
  utilization, savings rate, a rule-based Financial Health Score, emergency fund progress,
  investment growth, and more), an animated hero with time-of-day scenes, an income/expense trend
  chart, a category breakdown donut chart, and a net-worth flight-path graph — all computed live
  from your own data, nothing hardcoded or seeded.
- **Transactions** — full CRUD, search, type filtering, and pagination.
- **Budget Planner** — monthly budgets per category with live actual spend, remaining amount,
  utilization %, variance, and tiered status indicators.
- **Income, Expenses, Savings, Investments, Bills/EMIs, Goals** — dedicated modules for every
  major personal-finance record type.
- **Analytics** — a Midnight-Cockpit-themed charts suite plus a Custom Chart Studio for building
  your own metric/grouping/visualization combinations.
- **Reports** — a monthly financial statement summary with month-over-month/year-over-year deltas,
  CSV export, and a print-to-PDF flight summary.
- **Settings & Profile** — theme (light/dark), session timeout, security (2FA, passkeys), Google
  Drive connection management, data restore, and data export (CSV/Excel/JSON/PDF).
- **Admin panel** — user management, platform settings, and activity monitoring for admin-role
  accounts.
- **Installable PWA** — offline-aware, with an offline write queue and background sync.

## Why Google Drive as Storage?

> Penny Pilot provides the application. Your Google Drive owns and stores your financial data.

After registering, every user account connects its own Google Drive via Google OAuth. Penny Pilot
then creates a dedicated `Penny Pilot` folder in that Drive and stores all financial records there
as versioned JSON files — never in Penny Pilot's own database.

- **What lives in your Google Drive**: transactions, budgets, investments, bills/EMIs, goals,
  accounts, categories, payment methods, and financial preferences. See
  `backend/src/services/drive/`.
- **What lives in Penny Pilot's PostgreSQL database**: only account/authentication data — your
  name, email, password hash, 2FA/passkey credentials, session state, activity log, and the
  encrypted Google OAuth connection record. No financial data ever touches this database.
- **OAuth scope**: `drive.file` + `userinfo.email` only — the narrowest scope available. Penny
  Pilot can see and manage only the `Penny Pilot` folder and files it creates itself; it can never
  see anything else already in your Drive.
- **Token security**: OAuth tokens are AES-256-GCM encrypted at rest (`backend/src/lib/crypto.ts`)
  and are never written into any Drive file or exposed to the frontend.
- **Mandatory connection**: every standard user account must connect Google Drive before reaching
  the dashboard — enforced by both a frontend redirect and a backend middleware
  (`requireDriveConnected`) on every financial API route.
- **Disconnect / reconnect**: disconnecting only removes the local connection record — it never
  touches anything already saved in your Drive. Connecting a different Google account never
  silently merges data; if that account already has a Penny Pilot workspace, you're asked to
  choose between using it or starting fresh.
- **Version history & restore**: Google Drive's own native file-revision history powers a
  built-in "restore a previous version" feature per data collection — no separate backup system
  is needed.

See the [Privacy Policy](https://www.pennypilot.pro/privacy-policy) for the full data-handling
explanation.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, TanStack Query, Recharts |
| Backend | Node.js, Express 5, TypeScript, Prisma ORM |
| Database | PostgreSQL (account/auth data only) |
| Primary data store | Google Drive (per-user, via Google OAuth 2.0) |
| Auth | JWT (httpOnly signed cookies), bcrypt, TOTP 2FA, WebAuthn passkeys |
| Email | Resend (transactional email) |
| PWA | `@ducanh2912/next-pwa` / Workbox |
| Hosting | Vercel (frontend), Render (backend) |

## Architecture Overview

```
Browser (pennypilot.pro)
   │  HTTPS, credentialed fetch
   ▼
Next.js frontend (Vercel)
   │  REST calls, signed cookies
   ▼
Express + Prisma backend (Render)
   │                              │
   ▼                              ▼
PostgreSQL                  Google Drive API
(account/auth data only)    (per-user financial data,
                              via encrypted OAuth tokens)
```

## Project Structure

```
personal-finance-dashboard-pro/
├── backend/                Express + Prisma API
│   ├── prisma/              schema.prisma, migrations, seed.ts
│   └── src/
│       ├── controllers/       business logic (KPI aggregation, budget status, etc.)
│       ├── routes/            REST endpoints (auth, transactions, budgets, drive, admin, ...)
│       ├── services/drive/    Google Drive data service — the financial-data source of truth
│       ├── middleware/        auth, 2FA re-verification, Drive-connection gate, error handling
│       └── lib/                crypto, tokens, session expiry, email
├── frontend/                Next.js 15 App Router
│   └── src/
│       ├── app/(app)/          dashboard, transactions, budget, income, expenses, savings,
│       │                       investments, bills, goals, analytics, reports, settings, profile
│       ├── app/(admin)/        admin panel
│       ├── app/privacy-policy, app/terms   public legal pages
│       ├── app/connect-drive/  Google Drive OAuth connect flow
│       ├── components/         charts, KPI cards, layout, legal, UI primitives
│       └── lib/                API client, auth context, formatting
└── docker-compose.yml       local Postgres for development
```

## Getting Started Locally

### Prerequisites

- Node.js 20+
- PostgreSQL (locally installed, or via `docker compose up -d postgres`)
- A Google Cloud project with the Drive API enabled (see below)

### Setup

```bash
# 1. Start Postgres (or point DATABASE_URL at your own instance)
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env      # fill in the values described below
npm install
npx prisma generate
npx prisma migrate dev
npm run seed                # creates category/account taxonomy only — no financial data
npm run dev                 # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

Open `http://localhost:3000`, create an account, sign in, and connect a Google Drive account to
reach the dashboard — Drive connection is required before any financial feature becomes usable.

## Google OAuth Setup (required to run financial features locally)

1. [console.cloud.google.com](https://console.cloud.google.com) → create/select a project.
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → External → fill in app name/support email → add
   scopes `https://www.googleapis.com/auth/drive.file` and
   `https://www.googleapis.com/auth/userinfo.email` → add your own Google account under **Test
   users** (while the app is in Testing mode).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Web application →
   add an Authorized redirect URI pointing at the **backend's** `/api/drive/callback` (not the
   frontend), e.g. `http://localhost:4000/api/drive/callback` for local dev, or
   `https://<your-backend-domain>/api/drive/callback` in production.
5. Copy the generated Client ID/Secret into `backend/.env`: `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and a random 32+ character
   `BACKUP_TOKEN_ENCRYPTION_KEY` used to encrypt stored OAuth tokens.

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for the full annotated list. At minimum,
the backend needs `DATABASE_URL`, `APP_URL`/`FRONTEND_URL` (the frontend origin(s), used for CORS
and CSRF checks), `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`COOKIE_SECRET`, and the Google OAuth
variables above; the frontend needs `NEXT_PUBLIC_API_URL` pointing at the backend.

## Security

- **Signed, httpOnly session cookies** with a server-anchored, strict session-timeout deadline
  (`backend/src/lib/sessionExpiry.ts`) — computed and enforced entirely server-side, not trusted
  to the client. A hard logout also bumps a per-user session version, immediately invalidating any
  surviving token.
- **Two-factor authentication** (TOTP + backup codes), with periodic re-verification required
  every 12h before sensitive actions (export, restore, profile/password changes).
- **Passkeys / biometric sign-in** via WebAuthn (`@simplewebauthn`) — Windows Hello, Touch ID,
  Face ID, Android biometrics, and hardware security keys.
- **CORS + CSRF allowlisting** — cross-origin requests are only accepted from explicitly
  configured frontend origins (`APP_URL`/`FRONTEND_URL`).
- **Encrypted OAuth tokens at rest** (AES-256-GCM) and bcrypt-hashed passwords — see
  `backend/src/lib/crypto.ts`.
- **Rate limiting** on signup and login endpoints.

## Progressive Web App

The frontend is an installable PWA (`@ducanh2912/next-pwa`, Workbox under the hood):

- Manifest, icons, and app shortcuts for a native-like install experience.
- Runtime caching: dashboard/lookup data uses `StaleWhileRevalidate`; every other financial
  read/write API route is `NetworkOnly` so it never serves stale data.
- An offline write queue (IndexedDB) for creating records while offline, synced automatically via
  the Background Sync API when connectivity returns.
- A dedicated offline fallback page and update-available prompt.

Service worker output is only generated on a production build (`npm run build && npm run start`),
not `npm run dev`.

## Deployment

- **Frontend**: [Vercel](https://vercel.com), serving [https://www.pennypilot.pro](https://www.pennypilot.pro).
- **Backend**: [Render](https://render.com), a Node.js web service exposing the REST API.
- **Database**: managed PostgreSQL, storing only account/authentication data.

## License & Legal

- [Privacy Policy](https://www.pennypilot.pro/privacy-policy)
- [Terms of Service](https://www.pennypilot.pro/terms)

## Contact

For support, security, or privacy inquiries: **superadminpennypilot@gmail.com**
