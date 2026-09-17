# Penny Pilot — IDOR / Authorization Audit

Date: 2026-09-16
Scope: Full backend authorization/IDOR audit of `backend/src/routes/*.ts`, controllers, and `services/drive/dataService.ts`, following up on the Final Pre-Deployment Audit's High-Risk item "full IDOR/authorization scoping across every backend route has not been verified."

## Architecture note (relevant to every finding below)

This app has two storage tiers with different scoping mechanisms:

1. **Financial data (transactions, budgets, investments, bills, goals, categories, accounts, payment methods, settings/profile for USER-role accounts)** lives in each user's own **Google Drive**, in a workspace resolved from `BackupConnection.userId`. Every read/write in `services/drive/dataService.ts` goes through `withWorkspace(userId, ...)`, which resolves the Drive folder from that specific user's own `BackupConnection` row. A record `:id` is only ever looked up inside the requesting user's own Drive JSON files (`listRecords`/`getRecord` filter in-memory over that user's own `records` array). **There is no code path by which supplying another user's record id can return or mutate another user's Drive data** — the userId determines which Drive workspace is even opened, before the record id is ever consulted. This is a materially different (and stronger) isolation model than a shared Postgres table with a `where: { id }` clause.
2. **Account/platform data (users, notifications, activity log, passkeys, 2FA, consent, recovery sessions, admin-only data)** lives in Postgres via Prisma, and ownership is enforced per-query with `where: { ..., userId: req.auth!.userId }` (or an equivalent `findFirst`/`findUnique` + explicit `.userId !== req.auth!.userId` check before acting).

## Endpoint Inventory

| Method | Path | Auth | Role | Resource | Owner determined by | Explicit ownership check | Admin override | IDOR risk | Status |
|---|---|---|---|---|---|---|---|---|---|
| GET/POST/PATCH/DELETE | `/api/transactions*` | yes | USER (+Drive) | Drive: transactions | `req.auth.userId` → Drive workspace | Implicit (Drive isolation) | none | No | OK |
| GET/POST/PATCH/DELETE | `/api/budgets*` | yes | USER (+Drive) | Drive: budgets | same | Implicit | none | No | OK |
| GET | `/api/dashboard/*` | yes | USER (+Drive) | Drive: aggregate | same | Implicit | none | No | OK |
| GET/POST/PATCH/DELETE | `/api/investments*` | yes | USER (+Drive) | Drive: investments | same | Implicit | none | No | OK |
| GET/POST/PATCH/DELETE, bulk-delete | `/api/bills*` | yes | USER (+Drive) | Drive: bills | same | Implicit | none | No | OK |
| GET/POST/PATCH/DELETE, bulk-delete | `/api/goals*` | yes | USER (+Drive) | Drive: goals | same | Implicit | none | No | OK |
| GET | `/api/savings` | yes | USER (+Drive) | Drive: aggregate | same | Implicit | none | No | OK |
| GET | `/api/analytics/summary` | yes | USER (+Drive) | Drive: aggregate | same | Implicit | none | No | OK |
| GET | `/api/reports/*` | yes | USER (+Drive) | Drive: aggregate | same | Implicit | none | No | OK |
| GET/PATCH | `/api/profile` | yes | USER (+Drive) / ADMIN (Postgres `AppProfile`) | Own profile | `req.auth.userId`; Postgres branch uses `findUnique({ where: { userId } })` | Yes | none | No | OK |
| GET/POST/PATCH/DELETE | `/api/reference/*` (categories, accounts, payment methods) | yes | USER (+Drive) | Drive collections | same | Implicit | none | No | OK |
| GET/PATCH | `/api/settings` | yes | USER (+Drive) / ADMIN (Postgres `AppSettings`) | Own settings | same pattern as profile | Yes | none | No | OK |
| GET | `/api/export/preview`, `/api/export` | yes | USER (+Drive) | Drive: aggregate export | `req.auth.userId` | Implicit | none | No | OK |
| GET/POST/DELETE | `/api/drive/*` (status, connect, callback, resolve-account-change, disconnect, verify, restore) | yes (callback via short-lived state token bound to `userId`) | USER | `BackupConnection` row | `userId_provider` compound key; `resolve-account-change` also checks `pending.userId !== req.auth!.userId` | Yes | none | No | OK |
| GET | `/api/notifications`, `/unread-count` | yes | any | `Notification` | `where: { userId: req.auth!.userId }` | Yes | none | No | OK |
| PATCH | `/api/notifications/:id/read` | yes | any | `Notification` | `findFirst({ where: { id, userId } })` then update by primary id | Yes | none | No | OK — live-verified |
| DELETE | `/api/notifications/:id` | yes | any | `Notification` | `deleteMany({ where: { id, userId } })`, count-checked | Yes | none | No | OK — live-verified |
| POST | `/api/notifications/mark-all-read`, `DELETE /api/notifications` | yes | any | `Notification` | `where: { userId }` | Yes | none | No | OK |
| GET | `/api/activity` | yes | any | `ActivityLog` | `where: { userId: req.auth!.userId }` (no client-supplied filter honored) | Yes | none | No | OK — live-verified (client `userId` query param ignored on this route) |
| POST | `/api/auth/signup`, `/login`, `/logout`, `/refresh` | mixed | n/a | Auth | n/a | n/a | n/a | No | OK |
| GET/PATCH | `/api/auth/consent`, `/consent/download` | yes | any | `ConsentRecord` | `where: { userId: req.auth!.userId }` | Yes | none | No | OK |
| GET/POST | `/api/auth/2fa/*` | yes | any | 2FA secret/backup codes | `req.auth.userId` on every query | Yes | none | No | OK |
| GET/PATCH/DELETE | `/api/auth/passkeys*` | yes | any | `Passkey` | fetched by id then `passkey.userId !== req.auth!.userId` checked before use | Yes | none | No | OK |
| POST | `/api/auth/passkey/register/*` | yes | any | `Passkey` registration | `payload.userId !== req.auth!.userId` checked against signed challenge | Yes | none | No | OK |
| POST | `/api/auth/passkey/login/*` | no (pre-auth by design) | n/a | Passkey login | credential id → its own `passkey.userId`, never client-supplied | n/a (this endpoint's job is to establish identity) | none | No | OK |
| GET/POST | `/api/auth/security-questions*` | yes | any | `SecurityQuestion` | `where: { userId: req.auth!.userId }` | Yes | none | No | OK |
| POST | `/api/auth/forgot-password`, `/recovery/select-method`, `/resend-otp`, `/verify-otp`, `/verify-totp`, `/verify-security-answers`, `/reset-password` | no (pre-auth, session-token-gated) | n/a | `RecoverySession` | Resolved from a hashed, cookie-carried, single-use `recoveryToken` (`loadActiveRecoverySession`), never a client-supplied user id; generic error for every invalid/expired/wrong-account case | Yes | none | No | OK |
| GET | `/api/auth/me` | yes | any | Own user | `req.auth.userId` | Yes | none | No | OK — live-verified |
| PATCH | `/api/auth/me` (or equivalent self-update) | yes | any | Own user | `req.auth.userId` | Yes | none | No | OK |
| GET | `/api/auth/users` | yes | SUPER_ADMIN, ADMIN | All users | n/a (admin listing) | n/a | Yes (by design) | No | OK |
| GET | `/api/auth/users/:id` | yes | SUPER_ADMIN, ADMIN | One user | admin-scoped | n/a | Yes (by design) | No | OK |
| PATCH | `/api/auth/users/:id` | yes | SUPER_ADMIN, ADMIN | User role/status | Blocks non-SUPER_ADMIN from granting/touching `SUPER_ADMIN`; blocks demoting the last SUPER_ADMIN | Yes | Yes, gated | No | OK |
| POST | `/api/auth/users/:id/generate-temp-password`, `/reset-password` | yes | SUPER_ADMIN, ADMIN | Password reset | Blocks non-SUPER_ADMIN from resetting a SUPER_ADMIN's password | Yes | Yes, gated | No | OK |
| POST | `/api/auth/users/:id/reset-uid` | yes | SUPER_ADMIN, ADMIN | UID reset | Blocks non-SUPER_ADMIN from resetting a SUPER_ADMIN's UID | Yes | Yes, gated | No | OK |
| DELETE | `/api/auth/users/:id` | yes | SUPER_ADMIN, ADMIN | Delete user | Blocks self-delete, blocks non-SUPER_ADMIN deleting a SUPER_ADMIN, blocks deleting the last SUPER_ADMIN | Yes | Yes, gated | No | OK |
| GET | `/api/admin/stats`, `/activity`, `/security/summary`, `/migration/*`, `/backup`, `/email-templates*`, `/platform-settings` | yes | SUPER_ADMIN, ADMIN (router-level `requireRole`) | Platform-wide | n/a | n/a | Yes (by design) | No | OK |
| POST | `/api/admin/users/:id/force-logout` | yes | SUPER_ADMIN, ADMIN | Session invalidation | n/a (admin action) | n/a | Yes (by design) | No | OK |
| PATCH | `/api/admin/platform-settings` | yes | SUPER_ADMIN only (explicit in-handler check beyond the router's `requireRole`) | Platform config | n/a | Yes | Yes (by design, SUPER_ADMIN only) | No | OK |

## Findings

No item below rose to a confirmed vulnerability; each is recorded because it was specifically checked.

| ID | Severity | Endpoint | Resource | Problem | Evidence | Fix | Verification |
|---|---|---|---|---|---|---|---|
| F-1 | Informational | `GET /api/activity` | ActivityLog | Route ignores any client-supplied filter and always scopes to `req.auth.userId` | `backend/src/routes/activity.routes.ts:14` — `where: { userId: req.auth!.userId }`, no query params read | None needed | Live-verified: passing `?userId=<other user's id>` still returned only the caller's own 2 records |
| F-2 | Informational | `PATCH/DELETE /api/notifications/:id` | Notification | Ownership enforced via `findFirst`+`userId` check (PATCH) and `deleteMany` with `userId` in the `where` (DELETE) | `backend/src/routes/notifications.routes.ts:27-59` | None needed | Live-verified: user A got `{"error":"Notification not found"}` (no data leak) attempting to read/delete user B's real notification id on both verbs |
| F-3 | Informational | Drive-backed resources (transactions/budgets/bills/goals/investments/categories/accounts/payment methods/settings/profile) | Drive JSON collections | Ownership is enforced structurally (workspace resolution by `userId` before the record id is ever consulted), not by an ordinary `where` filter | `backend/src/services/drive/dataService.ts:187-206` (`withWorkspace`, `getRecord`) | None needed | Static analysis only — not live-tested cross-user because it requires a completed Google OAuth Drive connection, which cannot be done headlessly in this session (see Live Verification) |

## Confirmed IDOR Vulnerabilities

No confirmed IDOR vulnerability found in the audited routes.

## Authorization Coverage

- **USER**: can access only its own Drive-backed financial data (enforced structurally) and its own Postgres-backed account records (notifications, activity log, consent, 2FA, passkeys, security questions). Cannot reach any `/api/admin/*` or `/api/auth/users*` admin-management route (`requireRole("SUPER_ADMIN","ADMIN")` returns `403 AUTH_FORBIDDEN`; live-verified).
- **ADMIN**: can reach all `/api/admin/*` and user-management endpoints, but is explicitly blocked from granting/removing `SUPER_ADMIN`, and from resetting a SUPER_ADMIN's password/UID or deleting a SUPER_ADMIN account (`backend/src/routes/auth.routes.ts:1360-1365, 1414, 1452, 1523-1530`). Also blocked in-handler from `PATCH /api/admin/platform-settings` (`backend/src/routes/admin.routes.ts:306-309`).
- **SUPER_ADMIN**: full access, including the above SUPER_ADMIN-only actions, with a guard preventing the *last* SUPER_ADMIN from being demoted or deleted (`otherSuperAdmins` count checks).
- All three roles derive their identity exclusively from `req.auth` (set by `authenticate` from the verified JWT cookie) — no route reads `req.body.userId`/`req.query.userId`/a URL `userId` param to determine "my own" resources.

## Live Verification

Two disposable USER accounts were created via the real `POST /api/auth/signup` + `POST /api/auth/login` against the local dev backend (`http://localhost:4000`), which talks to the real dev database:
- `idor.test.a.<rand>@gmail.com`
- `idor.test.b.<rand>@gmail.com`

| Area | Result |
|---|---|
| Signup/login flow | VERIFIED — both accounts created and authenticated normally |
| `GET /api/auth/me` scoping | VERIFIED — each session returns only its own account |
| `GET /api/activity` scoping incl. client-supplied `userId` ignored | VERIFIED |
| `GET /api/notifications` scoping | VERIFIED |
| Cross-user `PATCH /api/notifications/:id/read` (A → B's real id) | VERIFIED — blocked, 404, no data leak |
| Cross-user `DELETE /api/notifications/:id` (A → B's real id) | VERIFIED — blocked, 404, no data leak; confirmed B's notification still present afterward |
| USER role blocked from `/api/admin/stats`, `/api/auth/users` | VERIFIED — `403 AUTH_FORBIDDEN` |
| Financial records (transactions/budgets/bills/goals/investments), profile, settings, reference data | NOT VERIFIED LIVE — every one of these routes is gated by `requireDriveConnected` (`backend/src/app.ts:134-145`), which requires a completed Google OAuth consent flow. That flow cannot be completed headlessly/non-interactively in this audit session without a real Google account and browser-based consent, so cross-user testing here is **static-analysis-only**, based on the structural Drive-workspace isolation documented under "Architecture note" and Finding F-3. |
| 2FA setup, passkeys, security questions | NOT VERIFIED LIVE beyond what the two accounts' own default (unconfigured) state allowed to exercise — code-reviewed only (ownership checks present and consistent, see Endpoint Inventory) |

## Security Regression

Diff-checked against the prior phase's stated deliverables — none of the following were touched by this audit (read-only investigation; zero fixes applied):
- JWT fail-fast secrets (`backend/src/lib/tokens.ts`, `backend/src/app.ts`) — unchanged
- `AUTH_REQUIRED`/`AUTH_INVALID`/`AUTH_EXPIRED`/`AUTH_FORBIDDEN`/`AUTH_RATE_LIMITED` catalog (`backend/src/middleware/auth.ts`, `backend/src/routes/auth.routes.ts`) — unchanged, and observed in live testing returning correctly (`AUTH_FORBIDDEN` for USER hitting admin routes)
- Account recovery flow (`RecoverySession`, email OTP / TOTP / security questions) — unchanged, reviewed and found sound
- Cookies / CORS / CSRF / origin protection — unchanged, not modified
- StorageProvider abstraction — unchanged
- Files under the explicit do-not-touch list (`AuthContext.tsx`, `layout.tsx`, `login/page.tsx`, `SessionManager.tsx`) — not opened for editing

## Database

No migrations run. No `prisma migrate`/`db push`/`reset` executed. No destructive operations. No existing user's or production data was read, modified, or deleted. Two disposable test accounts (`idor.test.a.<rand>@gmail.com`, `idor.test.b.<rand>@gmail.com`) were created via the real signup endpoint for live cross-user testing and were left in place (no self-service account-deletion endpoint was found in `auth.routes.ts`; the admin delete-user endpoint was deliberately not used per the task's constraints). They hold no financial data (no Drive connection was established) and can be removed later via the admin panel if desired.

## Git

No commit. No push. No deploy.

## Remaining Risks

- Cross-user IDOR testing of Drive-backed financial records (transactions, budgets, bills, goals, investments, categories, accounts, payment methods, profile, settings for USER accounts) is backed only by static code analysis, not a live two-account test, because it requires a completed Google Drive OAuth consent that can't be performed headlessly. The structural isolation (workspace resolved by `userId` before any record id is consulted) is strong by design, but has not been exercised end-to-end with two real connected Drive accounts.
- 2FA, passkey, and security-question ownership checks were verified by code review (consistent `userId` checks throughout `auth.routes.ts`) but not live cross-user tested, since exercising them meaningfully requires each account to have those features actually configured (TOTP secret, registered passkey, or security questions), which is out of scope for a quick disposable-account pass.
- This audit did not attempt to test rate-limiting bypass, timing side-channels, or non-authorization vulnerability classes — it was scoped strictly to IDOR/ownership-scoping per the task.
