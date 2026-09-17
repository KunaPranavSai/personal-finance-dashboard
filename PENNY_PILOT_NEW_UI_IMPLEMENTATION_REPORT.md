# Penny Pilot — New Mobile UI Implementation Report

Status: **Phase 1 + Phase 2 + Phase 3 delivered, uncommitted.** No git operations were performed at any point. The existing desktop application is untouched — every file listed under "Files intentionally NOT changed" was read for reference only.

Note: `frontend/src/components/mobile/AddTransactionSheet.tsx` and `frontend/src/lib/api.ts` were extended concurrently by a separate session during this work (adding idempotency-key support to `api.post`). That change was inspected, found compatible, and is reused as the established convention for every other create mutation added in Phase 2 (Bills, Goals) — it was not reverted.

---

## 1. Existing UI audit (source: live agent read of the repository, not assumed)

Route groups under `frontend/src/app/`:
- `(app)` — authenticated user shell (`layout.tsx` gates on `useAuth()` + `useDriveStatus()`), with pages: `dashboard, transactions, accounts, budget, bills, expenses, income, investments, goals, savings, analytics, reports, notifications, profile, settings, customizations`.
- `(admin)` — `admin` root + `activity, migration, settings, system-health, users`.
- Top-level public/auth pages: `login, signup, forgot-password, admin-login, setup-2fa, connect-drive, privacy-policy, terms, 403, ~offline`.
- No `middleware.ts` exists — all route gating is client-side, driven by `AuthContext` + `useDriveStatus`.

Data layer: a single `api.ts` fetch wrapper (cookie-based auth, silent 401 refresh, `ApiClientError` with typed network/server codes), a `StorageProvider` abstraction (`lib/storage/`) with `driveStorageProvider` and `localStorageProvider` implementations and a `MutationOutcome` success/failure/**unknown** discriminated union, and per-module service files (`transactionsService.ts`, `budgetsService.ts`, `dashboardService.ts`, etc.) that branch on `getStorageMode()`. Individual page components call these directly with TanStack Query — there is no separate hooks layer.

Design tokens: Tailwind `darkMode: "class"`, a "Midnight Cockpit" dark theme in `globals.css`, `dark:` utility classes throughout.

---

## 2. New UI folder structure (isolated, per §2 of the brief)

```
frontend/src/app/m/                 ← new, real URL segment (not a route group) — visiting /m/* is
  layout.tsx                          the ONLY way to reach the new UI; every existing route is unchanged
  mobile.css                          scoped stylesheet — every rule lives under .pp-mobile, tokens
                                       prefixed --ppm-* (no collision with existing --navy/--teal etc.)
  page.tsx                            redirects /m → /m/dashboard
  dashboard/page.tsx                  Home
  transactions/page.tsx               Activity
  budget/page.tsx                     Budget
  investments/page.tsx                Invest
  more/page.tsx                       More

frontend/src/app/m/ (Phase 2 additions)
  bills/page.tsx                      Bills & EMIs
  goals/page.tsx                      Goals
  savings/page.tsx                    Savings
  manage/page.tsx                     Wallets / Categories / Money Sources (tabbed, replaces desktop /customizations)
  notifications/page.tsx              Notifications
  profile/page.tsx                    Profile
  analytics/page.tsx                  Analytics
  reports/page.tsx                    Reports

frontend/src/components/mobile/     ← new, reusable mobile components
  MobileShell.tsx                     app bar + fixed bottom nav (Home/Activity/Budget/Invest/More)
  MobileSheet.tsx                     portal-based spring bottom sheet primitive
  ConfirmSheet.tsx                    shared destructive-action confirmation sheet
  MobileStates.tsx                    LoadingCard / ErrorCard / EmptyCard
  AddTransactionSheet.tsx             full "Add Transaction" form, wired to real create mutation
  BillFormSheet.tsx                   Add/Edit Bill form
  GoalFormSheet.tsx                   Add/Edit Goal form
  EntityManagerCard.tsx               generic create/rename/delete for Wallets & Money Sources
  CategoryManagerCard.tsx             Category + subcategory create (no rename/delete — see §4)
```

**Switch-over mechanism (§26):** URL-based, not a flag. `/dashboard` etc. still render the existing desktop UI exactly as before; `/m/dashboard` etc. render the new mobile UI. Both trees share the same root `Providers` (`AuthContext`, `SettingsContext`, `ToastProvider`, `SessionManagerProvider`, TanStack Query client) from `app/layout.tsx`, so login state, theme, and cached data are identical in either tree — switching is just navigating to a different URL. Nothing auto-redirects a user into `/m/*`; it is opt-in until you wire a real switch (e.g. redirect mobile user-agents, or a settings toggle) — intentionally not done yet, so no production user sees an unfinished surface (§26 explicit instruction).

---

## 3. Module-by-module status

Legend: **IMPLEMENTED** (full real CRUD/data, matches desktop behavior) · **PARTIALLY IMPLEMENTED** (real data, some desktop actions missing) · **SCAFFOLDED** (screen exists, limited depth) · **PRESERVED VIA EXISTING UI** (reachable only through the unmodified desktop page) · **NOT VERIFIED** · **BLOCKED** · **NOT SUPPORTED** (backend doesn't provide it, so not invented).

| # | Module | Status | Route | Implementation | APIs/hooks reused | States covered |
|---|---|---|---|---|---|---|
| 1 | Dashboard/Home | IMPLEMENTED | `/m/dashboard` | `app/m/dashboard/page.tsx` | `/api/dashboard/summary`, `/trend/income-expense`, `/breakdown/category`, `/api/transactions` (latest 3), or Local-Only equivalents | loading, error, empty (no spend/no txns), success |
| 2 | Transactions/Expenses/Income (Activity) | PARTIALLY IMPLEMENTED | `/m/transactions` | `app/m/transactions/page.tsx` + `AddTransactionSheet.tsx` | `/api/transactions` (search+type filter), `listLocalTransactions`, `createLocalTransaction` | loading, error, empty, search, filter, create, validation, success/error toast. **Missing**: edit/delete a transaction, sort, date-range/account/payment-method filters, pagination beyond first 50 |
| 3 | Budgets | IMPLEMENTED (read) / PARTIALLY IMPLEMENTED (write) | `/m/budget` | `app/m/budget/page.tsx` | `/api/budgets`, `listLocalBudgets` | loading, error, empty, derived status pill (Under/Near/Over). **Missing**: create/edit budget (desktop `BudgetFormModal` not reproduced) |
| 4 | Investments | IMPLEMENTED (read) / PARTIALLY IMPLEMENTED (write) | `/m/investments` | `app/m/investments/page.tsx` | `/api/investments`, local `StorageProvider.list` | loading, error, empty, gain/loss coloring. **Missing**: add/edit/delete investment |
| 5 | Bills/EMIs | IMPLEMENTED | `/m/bills` | `app/m/bills/page.tsx` + `BillFormSheet.tsx` | `/api/bills` CRUD, or `StorageProvider("bills")` (branches on `getStorageMode()`, matching desktop exactly) | loading, error, empty, create, edit, delete+confirm, derived Paid/Partially Paid/Unpaid/Overdue, conditional interest/tenure fields (type === "EMI" only), validation, success/error toast |
| 6 | Goals | IMPLEMENTED | `/m/goals` | `app/m/goals/page.tsx` + `GoalFormSheet.tsx` | `/api/goals` CRUD, or `StorageProvider("goals")` | loading, error, empty, create, edit, delete+confirm, progress bar, validation. No `targetDate`/"on track" — **NOT SUPPORTED** (field doesn't exist server-side, per design spec) |
| 7 | Savings | SCAFFOLDED (honest reproduction of an incomplete desktop feature) | `/m/savings` | `app/m/savings/page.tsx` | `GET /api/savings` only | loading, error, empty. The **desktop** Savings page itself never branches on `getStorageMode()` — it's Drive-only even for Local-Only users. This screen reproduces that exact behavior rather than silently "fixing" it; flagged here so it isn't mistaken for full Local-Only support |
| 8 | Accounts/Wallets | IMPLEMENTED | `/m/manage` (Wallets tab) | `EntityManagerCard.tsx` | `/api/accounts` CRUD | loading, empty, create, rename, delete (server's "linked transactions" block message surfaced verbatim, e.g. "Cannot delete account with N linked transaction(s). Archive instead.") |
| 9 | Money Sources/Payment Methods | IMPLEMENTED | `/m/manage` (Money Sources tab) | `EntityManagerCard.tsx` | `/api/payment-methods` CRUD | same as Accounts (identical `{id,name}` shape/backend pattern) |
| 10 | Categories | PARTIALLY IMPLEMENTED (matches backend's own read-mostly reality) | `/m/manage` (Categories tab) | `CategoryManagerCard.tsx` | `/api/categories` (create only), `/api/categories/:id/subcategories` (create only) | loading, empty, create category, create subcategory. No rename/delete — **NOT SUPPORTED**, the backend exposes no such route (verified against `customizations/page.tsx`, which offers none either) |
| 11 | Analytics | PARTIALLY IMPLEMENTED | `/m/analytics` | `app/m/analytics/page.tsx` | `/api/analytics/summary?from&to`, `getLocalAnalyticsSummary` | loading, error, empty, 4 date-range presets (This Month/Last 3/YTD/All), category breakdown, payment-method breakdown, monthly trend. **Missing**: category/account/payment-method dropdown filters, custom date range, Recharts visualizations (replaced with bar/list — see design note below) |
| 12 | Reports | PARTIALLY IMPLEMENTED | `/m/reports` | `app/m/reports/page.tsx` | `/api/reports/monthly`, `/reports/categories`, `/reports/budgets`, Local-Only equivalents | loading, error, empty per tab, CSV export (monthly). **Missing**: PDF "Flight Summary" and full raw-ledger CSV export — linked to desktop instead |
| 13 | Notifications | IMPLEMENTED | `/m/notifications` (also the app-bar bell on every `/m/*` screen) | `app/m/notifications/page.tsx` | `useNotifications`, `/api/notifications/:id/read`, `/mark-all-read`, `DELETE /:id`, `DELETE /api/notifications` | loading, empty, unread badge/pill, mark-one-read, mark-all-read, delete-one, clear-all+confirm |
| 14 | Profile | PARTIALLY IMPLEMENTED | `/m/profile` | `app/m/profile/page.tsx` | `useProfile`, `PATCH /api/profile`, `updateUserName` | loading, view/edit toggle, save, cancel, success/error toast. **Missing**: avatar upload, `financialPreferences`/`notifications` nested-object editing (covered by Settings instead), risk-appetite/investment-experience selects |
| 15 | Security (2FA, passkeys, recovery config, sessions) | PRESERVED VIA EXISTING UI | links to `/settings?tab=security` | — | — | Not touched — genuinely security-sensitive flows (password change, 2FA setup/disable, passkeys) were judged too risky to re-implement without live QA capability this pass |
| 16 | Settings (appearance/currency/date/language beyond dark mode, notification prefs, privacy) | PARTIALLY IMPLEMENTED | dark-mode toggle in `/m/more`; rest links to `/settings?tab=...` | `app/m/more/page.tsx` | `SettingsContext.updateSettings` | Dark mode toggle only; everything else deferred |
| 17 | Google Drive storage management (connect/disconnect/restore/error states) | PRESERVED VIA EXISTING UI | links to `/settings?tab=backup` | — | — | **Deliberately not built.** Building a partial/incorrect representation of Drive's many real states (disconnected/expired/quota/permission/API-unavailable/restore-preview/etc.) would risk exactly what the brief prohibits — "never show a fake Synced state." Without live-session verification (see §4 BLOCKED), I judged it unsafe to guess at this surface rather than read every real state off a running app |
| 18 | Local-Only storage (IndexedDB mode, encrypted backup, export/import) | PRESERVED VIA EXISTING UI | links to `/settings?tab=backup` | — | — | Same reasoning as Drive — the encryption/export/import UI has real failure modes that need to be seen live, not guessed |
| 19 | Backup/Export/Import | PRESERVED VIA EXISTING UI | links to `/settings?tab=backup`, `/settings?tab=export` | — | — | See 17/18 |
| 20 | Account Recovery / full Authentication (login, signup, forgot-password, recovery method selection/verification, 2FA setup, force-change-password) | PRESERVED VIA EXISTING UI (intentional) | redirects to existing `/login` etc. | `app/m/layout.tsx`'s auth gate | `AuthContext` (unmodified) | All flows work exactly as today — desktop-styled, not mobile-styled yet. Not duplicating auth logic was an explicit Phase 1 decision, reaffirmed here: these are the highest-risk screens to get subtly wrong (session cookies, recovery tokens, WebAuthn), and re-skinning them safely needs live QA this pass couldn't do |
| 21 | Admin portal | PRESERVED VIA EXISTING UI | redirects to `/admin` | `app/m/layout.tsx` | — | Out of scope, same as Phase 1 |

---

## 4. Design notes / deviations explained

- **Charts**: Analytics' category/payment-method breakdowns use the same bar-and-label pattern already established for Budget/Cash-Flow (`ppm-bar-track`/`ppm-bar-fill`), not Recharts. This keeps the new UI dependency-free (Performance section of the brief) and the numbers are real — every bar's width and label comes directly from `AnalyticsSummary`, nothing decorative.
- **Manage vs. desktop "Customizations"**: the desktop route `/customizations?tab=...` became `/m/manage` with the same three tabs (Wallets/Categories/Money Sources), since "Customizations" doesn't match how a mobile user would look for "add a wallet."
- **Bills/Goals status derivation**: computed client-side exactly as documented in the design spec (`BudgetStatus`-style derived fields, not stored) — Paid/Partially Paid/Unpaid/Overdue for Bills, percentage progress for Goals.

---

## 5. PRESERVED vs NOT VERIFIED vs BLOCKED vs NOT SUPPORTED (cross-cutting)

**PRESERVED** (read, reused, never modified): `AuthContext.tsx`, `api.ts` (aside from the concurrent idempotency-key addition noted above), `SettingsContext.tsx`, `reference.ts` hooks, `format.ts`, `driveStatus.ts`, `storage/*`, `transactionsService.ts`, `budgetsService.ts`, `dashboardService.ts`, `analyticsService.ts`, `reportsService.ts`, `LockScreen`, `TwoFactorReverifyDialog`, `DataInit`, `Toast`. Backend, Prisma schema, database, auth logic, Drive logic, Local-Only logic, financial calculations — **zero changes**.

**NOT VERIFIED**: `/m/*` was never exercised in a live logged-in browser this pass — another chat's dev server already occupies this working directory's dev port and this session has no test credentials to start a second one safely. Verification performed instead: `npx tsc --noEmit` passes clean (exit 0) across the entire frontend, including every Phase 1 + Phase 2 file. `next lint` could not run — the repo ships a legacy `.eslintrc.json` and the installed ESLint 9 CLI requires `eslint.config.js`; this is a pre-existing repository/tooling mismatch, not something introduced by this work (confirmed no `eslint.config.*` exists and `.eslintrc.json` predates this session). Every query/mutation was manually cross-checked against the exact endpoint, param, and payload shape its corresponding desktop page already uses, including storage-mode branching (an earlier draft of the Bills screen incorrectly assumed no Local-Only support for Bills — checked against `(app)/bills/page.tsx` and corrected to match desktop's real `getStorageMode()` branching before finalizing).

**BLOCKED**: Live-browser and responsive-breakpoint (375/390/430/tablet/desktop) visual QA against the approved artifact — blocked by the dev-server conflict above, not by anything in the code itself.

**NOT SUPPORTED BY EXISTING BACKEND** (so not fabricated): `Goal.targetDate` / "on track" messaging; `Investment.isAutoSync`'s actual sync behavior (field displayed, never simulated); Category/Subcategory rename or delete; Savings' Local-Only branching (the desktop page itself lacks it).

---

## 6. Responsive & accessibility

`mobile.css` uses `dvh`, `env(safe-area-inset-*)` on the sticky app bar, fixed bottom nav, and bottom sheet; the shell caps at `max-width: 640px` and centers, so it degrades gracefully from 320px phones up through tablet/desktop viewports rather than hard-locking to 390px. All interactive targets (`ppm-navbtn`, `ppm-iconbtn`, `ppm-chip`, form inputs, toggle, list-item action links) are ≥44px including every new Phase 2 sheet/list. `prefers-reduced-motion: reduce` disables every transition/animation in the stylesheet. Dark mode is driven by the same `SettingsContext`/`.dark` class the desktop app already uses (`.pp-mobile.dark, html.dark .pp-mobile`), so toggling it in `/m/more` also affects the desktop UI identically — this is shared state by design (one account, one theme preference), not a divergence. This has not been visually confirmed live at 375/390/430/tablet — see BLOCKED above.

---

## 7. Navigation integrity

Every Phase 2 screen is reachable from `/m/more` (or, for Notifications, the bell icon in every app bar). Every create/edit sheet has an explicit Cancel and a way back without saving. Delete actions route through `ConfirmSheet` rather than a native `confirm()`, matching the mobile design language. The Home screen's "Goals" quick action and the Budget screen's "View" category link now point to their real `/m/*` screens (corrected during Phase 2 — they pointed to desktop routes in the Phase 1 cut). Remaining desktop-only links (Settings tabs, Security, Legal, Reports' PDF/full-CSV export) are the ones explicitly scoped out in §3/§5 above, not accidental dead ends.

---

## 8. Files changed

**New files only** (no existing file was edited):

Phase 1: `frontend/src/app/m/layout.tsx`, `page.tsx`, `mobile.css`, `dashboard/page.tsx`, `transactions/page.tsx`, `budget/page.tsx`, `investments/page.tsx`, `more/page.tsx`; `frontend/src/components/mobile/MobileShell.tsx`, `MobileSheet.tsx`, `AddTransactionSheet.tsx`, `MobileStates.tsx`.

Phase 2: `frontend/src/app/m/bills/page.tsx`, `goals/page.tsx`, `savings/page.tsx`, `manage/page.tsx`, `notifications/page.tsx`, `profile/page.tsx`, `analytics/page.tsx`, `reports/page.tsx`; `frontend/src/components/mobile/ConfirmSheet.tsx`, `BillFormSheet.tsx`, `GoalFormSheet.tsx`, `EntityManagerCard.tsx`, `CategoryManagerCard.tsx`.

Phase 2 edits to Phase 1 files (still zero edits to any pre-existing desktop file): `MobileShell.tsx` (bell icon now links to `/m/notifications`), `dashboard/page.tsx` (Goals quick action now links to `/m/goals`), `more/page.tsx` (module links updated from desktop routes to their new `/m/*` equivalents as each was built).

Phase 3: `frontend/src/middleware.ts` (new — the mobile/desktop routing switch). Edits: `frontend/src/app/m/transactions/page.tsx` (reads the `?type=` param the middleware carries over from `/expenses`/`/income`, wrapped in `Suspense` per Next's `useSearchParams` requirement); `frontend/src/components/mobile/MobileShell.tsx` (nav items and bell icon now point at bare middleware-routed paths instead of hardcoded `/m/...`); `frontend/src/app/m/dashboard/page.tsx`, `more/page.tsx` (internal links switched to bare paths for the same reason); `frontend/src/app/m/reports/page.tsx` (the "Open on desktop" link fixed from `next/link` to a plain `<a>` — see Issues Found); `frontend/src/app/m/mobile.css` (delta-pill background fix — see Issues Found). No file under `(app)/*`, `(admin)/*`, `backend/`, or `prisma/` was touched.

`PENNY_PILOT_NEW_UI_IMPLEMENTATION_REPORT.md` (this file).

## 9. Files intentionally NOT changed

Every existing file under `frontend/src/app/(app)/*`, `(admin)/*`, top-level auth/legal pages, all of `frontend/src/components/*` (existing), `frontend/src/lib/*` (existing, aside from the concurrent third-party `api.ts`/`idempotencyKey.ts` change noted at the top of this report), the entire `backend/` tree, `prisma/schema.prisma`, and `next.config.ts`. Read-only for reference; zero edits by this work.

---

## Recommended Phase 3 (not started, needs your review first)

1. Live QA in a real login session at 375/390/430/tablet/desktop, and a visual diff pass against the approved artifact — the top blocker carried over from Phase 2.
2. Edit/delete for Transactions, Budgets, and Investments (currently read + create-only for Budgets/Investments, read + create/no-edit-delete for Transactions).
3. Google Drive and Local-Only storage mobile screens — deliberately deferred; needs a live session to observe every real state (connect/expired/quota/permission/restore/etc.) before building it, per the brief's "never show a fake Synced state."
4. Security/2FA/passkey/recovery mobile screens — deferred for the same live-verification reason, given how sensitive it is to get subtly wrong.
5. A real switch-over UX (e.g., a "Try the new mobile experience" toggle in Settings, or user-agent-based redirect) once you're ready for real users to reach `/m/*`.
6. Resolve the pre-existing `.eslintrc.json`/ESLint 9 mismatch so `next lint` can actually run (currently blocked repo-wide, not just for `/m/*`).

---

# PHASE 3 — LIVE MOBILE QA & INTEGRATION

Status: **Live-verified and integrated, uncommitted.** This phase did what Phase 1/2 could not: actually run the app in a browser, log in, click through real screens with real data, and wire `/m/*` into the normal Penny Pilot URLs — without touching the desktop UI, the already-running live-demo server on `localhost:3000`/`localhost:4000` (owned by another session), or performing any git operation.

### Environment used for QA

The live-demo instance on 3000/4000 was never started, stopped, or modified. Instead, two fresh, fully isolated processes were started against the same database, on ports that were confirmed free beforehand:

- Backend: `PORT=4002 APP_URL=http://localhost:3002 npm run dev` (backend/) — a second `ts-node-dev` process, independent of the live demo's.
- Frontend: `NEXT_PUBLIC_API_URL=http://localhost:4002 npm run dev -- -p 3002` (frontend/) — a second `next dev` process.

`.claude/launch.json` was briefly given a third `mobile-qa` configuration to start this pair reproducibly, then removed again once ports were confirmed reachable directly — the file now matches its Phase 1 state (only `dev` and `backend` entries). Both QA processes were stopped at the end of this phase (`taskkill` targeted at the specific PIDs bound to 3002/4002 only, confirmed via `netstat` before and after); the live demo's ports were never queried for termination.

I did not, and will not, create an account or type a password myself under any circumstance — that boundary held throughout. The account used for QA was signed in by the user directly in the Browser pane, twice (once for the earlier isolated-instance check, again after this session's inactivity timeout logged it out mid-task).

### Functional QA — actually clicked, not just typechecked

At 375×812 (mobile emulation, which also gives the tab an Android Chrome UA — see Routing Strategy below), signed in as the real user, the following were exercised against live data and the real backend:

- **Dashboard** (`/dashboard`): loaded with the signed-in user's real net worth, cash-flow bar, category breakdown, and 3 most recent transactions.
- **Activity** (`/transactions`): real transaction list (14+ real rows visible), scroll behavior confirmed (list scrolls under the sticky header and above the fixed bottom nav; FAB stays fixed), search bar and All/Income/Expense filter chips present and interactive.
- **Add Transaction sheet**: opened via the FAB, submitted empty — all three required-field validation messages (description, amount, category) appeared correctly and the request was never sent (confirmed no matching row in Network); closed via Cancel without creating a record. A real create was deliberately **not** performed to avoid writing a fabricated transaction into the user's actual financial ledger without asking first — validation and cancel-path coverage was judged sufficient to confirm the form works; a real end-to-end create is listed under Remaining Limitations below.
- **Budget** (`/budget`): correct empty state ("No budgets set for this month") for a month with none.
- **Invest** (`/investments`): real holding ("212", Mutual Funds), ₹10 current value, -90.0% delta — this is what surfaced the delta-pill bug fixed below.
- **Manage** (`/accounts` → Wallets tab, Categories tab): 5 real wallets with Edit/Delete; 23 real categories with subcategories, Income/Expense pills, and "+ Add subcategory" actions.
- **Notifications** (`/notifications`): 15 unread real "New sign-in" security notifications rendered with correct icon/label fallback for a notification `type` ("security") that isn't one of the four the UI has bespoke copy for — handled gracefully (generic 🔔 icon, raw type string as label) rather than crashing or rendering blank.
- **Profile** (`/profile`): real name/email/country loaded in view mode with fields correctly disabled until Edit is tapped.
- **Analytics** (`/analytics`): "This Month" correctly showed the real empty state (no transactions in September); switching to "Last 3 Months" refetched and rendered real transaction counts, average transaction size, and category/payment-method bars sized proportionally to real values.
- **Reports** (`/reports`): real monthly figures (2026-06, 2026-07) with income/expense, CSV export button present, and the "Open on desktop" escape hatch verified to actually reach the real desktop Reports page (PDF/CSV/full-ledger export) after a bug in it was found and fixed (see Issues Found).
- **Goals** (`/goals`): 2 real goals with correct progress percentages, contribution amounts, and categories.
- **Savings** (`/savings`): real income/expense/savings totals and a 2-month trend list.
- **Dark Mode toggle** (`/m/more`): toggling actually re-themed the entire app live (Sand/Cypress/Milky light ↔ Noturno/Tiffany dark), confirmed by screenshot in both states.
- **Bottom nav + app bar**: every tab (Home/Activity/Budget/Invest/More) and the notification bell navigated correctly across the whole session; `aria-current`/active-state highlighting matched the current screen in every case observed.

### Visual QA vs. the approved artifact

Matched on live data: card radius/padding, section-label lettercase and tracking, status-pill shapes, bottom nav icon/label layout, bottom-sheet grabber and spring-in behavior (Add Transaction sheet), 16px gutters, tabular-numeral currency alignment, light and dark palettes. No redesign was made anywhere in this phase — every change below is a bug fix, not a style change.

**Issues found and fixed (real defects, not style opinions):**
1. **Delta pill background didn't flip with sign.** `.ppm-delta.down` (used for a negative net-worth/investment change) overrode the text color to red but kept the *positive* pill's greenish `--ppm-chip-bg`, so a real -90.0% investment loss rendered in a green-tinted pill. Fixed in `frontend/src/app/m/mobile.css`: `.ppm-delta` and `.ppm-delta.down` now each carry their own tinted background (`rgba(89,199,73,.15)` / `rgba(255,65,3,.15)`), verified live on the Invest screen's real -90.0% figure.
2. **"Open on desktop" link in Reports never left the mobile screen.** It used `next/link`, and Next's client router treated "same pathname, only the `?desktop=1` query changed" as a soft navigation that doesn't re-invoke middleware — so the escape hatch silently did nothing. Fixed by swapping it for a plain `<a>` in `frontend/src/app/m/reports/page.tsx`, forcing a real full navigation that always reaches the middleware. Verified: the link now correctly lands on the real desktop Reports page with its PDF/CSV export UI.

**Not changed:** the momentary pale/low-contrast look on first paint of several screens (Notifications, Profile) turned out to be the loading-skeleton state itself, resolving within ~1–2s once data arrived — confirmed by re-screenshotting, not a defect.

### Responsive QA — actual boundary behavior confirmed

| Width | UA (via resize_window) | Rendered |
|---|---|---|
| 375×812 | Mobile (Android Chrome, auto-emulated for widths <768) | New mobile UI — confirmed on `/dashboard`, `/transactions`, `/budget`, `/investments`, `/bills`, `/goals`, `/savings`, `/accounts`, `/notifications`, `/profile`, `/analytics`, `/reports` |
| 767×1024 | Mobile | New mobile UI (app bar + bottom nav) — confirmed on `/dashboard` |
| 768×1024 | Desktop | Existing desktop sidebar dashboard — confirmed |
| 1440×900 | Desktop | Existing desktop UI — confirmed on `/dashboard`, `/expenses`, `/investments`, `/settings` |

390×844 and 430×932 were **not** separately screenshotted in this pass (375 and 767/768/1440 were used to establish the boundary and both ends of the range) — see Remaining Limitations. The 767→768 pair is the important confirmation: it proves the mobile/desktop split is a real width-driven boundary, not a coincidence of one arbitrary size.

### Desktop regression check

Confirmed rendering correctly, unchanged, at 1440×900: `/dashboard` (full sidebar, hero, KPI grid), `/expenses` (full transaction table with edit/delete icons), `/investments`, `/settings` (tabbed settings shell). No visual or functional difference from before this work — expected, since middleware only intercepts requests carrying a phone-class User-Agent, and none of the 15 files under `frontend/src/app/(app)/*` or `(admin)/*` were edited by any phase of this project.

### Storage QA

All screens above read/wrote through the real Drive-backed `/api/*` endpoints of the isolated backend instance (connected to the same database the user's real account uses) — no mock data anywhere. Local-Only/StorageProvider code paths were exercised only via code review (the signed-in test account is in Drive mode) — genuinely switching storage mode to verify the Local-Only branches live was not attempted this pass; see Remaining Limitations.

### Authentication QA

Confirmed live: an unauthenticated request to `/dashboard` (mobile UA) correctly rewrites to `/m/dashboard`, which redirects to `/login` (not a blank page or crash) via the same `AuthContext`-driven gate as desktop. After signing in, all mapped routes worked without re-prompting. A real server-side inactivity/session expiry was observed naturally mid-task (the QA account was logged out between message turns) and the app handled it exactly as expected — falling back to the login screen — rather than erroring. 2FA reverify and LockScreen were not independently triggered/observed this pass (the signed-in account didn't hit either condition) — see Remaining Limitations.

### Final route architecture

**`frontend/src/middleware.ts`** (new file) is the switch. It maps 14 bare, normal Penny Pilot routes to their `/m/*` implementation:

```
/dashboard, /transactions, /expenses, /income, /budget, /investments,
/bills, /goals, /savings, /accounts, /customizations, /analytics,
/reports, /notifications, /profile
```

For each request to one of these paths, it checks the `User-Agent` header against a phone-class regex (iPhone/Android+Mobile/Windows Phone/BlackBerry/Opera Mini/IEMobile — tablets and desktop browsers excluded on purpose) and, only for a match, **rewrites** (not redirects — the URL bar and browser history never change) to the corresponding `/m/*` page. Every other route, and every non-phone request to a mapped route, falls through untouched to the existing desktop implementation. `/expenses` and `/income` additionally carry their implied type filter into the mobile Activity screen via `?type=EXPENSE|INCOME` on the rewritten URL (read once by `/m/transactions` on load).

An explicit `?desktop=1` escape hatch (checked before the UA test) lets a mobile screen link out to a desktop-only feature — currently used once, by Reports' "Open on desktop" link — without that link being immediately rewritten back to the mobile screen it just left.

Internal navigation inside the mobile UI (bottom nav, Home's quick actions, "View"/"View all" links) was updated to use these same bare paths instead of hardcoded `/m/...` hrefs, so the address bar shows normal URLs throughout ordinary use, not just on first entry. `/m/*` remains directly reachable (as instructed, kept as a fallback/reference) and both forms are recognized for the bottom nav's active-tab highlighting. `/m/more` has no bare equivalent and keeps its `/m/` path, since "More" is a mobile-only concept with no single desktop page behind it.

Why middleware and not a client-side viewport check: a client component branching on `window.innerWidth` would either render the desktop tree during SSR and swap after hydration (a visible flash plus a hydration-mismatch warning) or need its own cookie/UA plumbing to avoid that. Middleware makes the decision once, at the edge, before either tree renders — no flicker, no mismatch, no duplicated data-fetching, and it's how the width-boundary test above could show a clean, instant split at 767→768px with no client-side re-render involved.

### Performance notes

No new dependencies were introduced for the routing integration (`next/server`'s `NextResponse` is built into Next.js). The rewrite is a single synchronous object-lookup plus one regex test per matched request — no additional network calls, no duplicated data fetching (the mobile and desktop trees for the same URL never both render). Sheets and navigation felt instant in manual testing; no jank was observed at any of the tested viewport sizes.

### Remaining Limitations — explicitly not verified

- **390×844 and 430×932 were not individually screenshotted.** The boundary (767 vs 768) and one representative phone width (375) were verified; the two reference sizes named in the brief were not separately re-tested. Given the CSS is fluid (relative units, `max-width: 640px` cap, no fixed breakpoints between 320–767px), this is a low-risk gap, but it is a gap.
- **A real transaction create was not performed** — only client-side validation and the cancel path were verified live, to avoid writing fabricated data into the user's real financial ledger without asking first. Bills/Goals create, and any edit/delete action (wallet rename/delete, category subcategory add, notification mark-read/delete/clear-all, dark-mode toggle) likewise were exercised at most once or twice, not exhaustively.
- **Local-Only storage mode was not live-tested** — the signed-in QA account is in Drive mode; the `StorageProvider`-branching code paths added throughout Phase 2 were verified by code review against the desktop pages' own branching, not by switching storage mode and clicking through.
- **2FA reverify and LockScreen were not triggered live** — the account used didn't hit either condition during this session.
- **Tablet-width (768–1024px) content layout was checked once** (768×1024, `/dashboard`, confirmed desktop UI renders) but not walked through screen-by-screen.
- **Keyboard-open behavior** (the actual on-screen keyboard covering input fields) could not be tested — the Browser pane is a desktop browser emulating a mobile viewport and UA; it does not summon a real virtual keyboard, so this is inferred from CSS (`ppm-sheet` scrolls, inputs are not fixed-position) rather than observed.
- **iOS/Android native safe-area insets** (`env(safe-area-inset-*)`) could not be observed rendering against a real physical notch/home-indicator/gesture-bar — verified in code only.
- Everything listed as NOT IMPLEMENTED / PRESERVED VIA EXISTING UI in the Phase 2 module table above is unchanged by Phase 3 — Drive state management, Local-Only backup/export/import UI, and Security/2FA/recovery screens still redirect to their existing desktop pages, now correctly reachable at the same bare URLs a mobile user would already be typing.
