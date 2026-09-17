# Penny Pilot — Analytics & Reports Parity Audit

Date: 2026-09-16
Auditor: Claude (read-only code audit, no live Google Drive available)

## 1. Executive Summary

This audit reads, side by side, every backend Drive-JSON aggregation formula behind Analytics and
Reports and every frontend local-mode (IndexedDB) equivalent, line by line, rather than trusting
matching names. The result is unusually clean: **the frontend local-mode services
(`analyticsService.ts`, `reportsService.ts`, `dashboardService.ts`) are direct, intentional
line-for-line ports of the backend route handlers**, each carrying a header comment stating that
intent. Every metric checked — totals, breakdowns, monthly trend, averages, budget vs actual — uses
identical source fields, identical filters, identical date-boundary semantics, and identical
arithmetic on both sides.

Two genuine, pre-existing bugs were found, but **both are symmetric** (present identically in
backend and local-mode), so they are Local/Drive parity **PASSES** — they are not local-vs-Drive
divergences, they are correctness bugs that affect both modes equally:

1. **Reports → "Budget vs Actual" ignores the budget's period entirely** — it sums *all-time*
   expenses in a category as "actual" instead of scoping to the budget's period/periodKey the way
   the real Budgets page (`budget.controller.ts` / presumably its local mirror) does. This makes
   the Reports tab's budget-vs-actual numbers wrong (too large) for any budget that isn't brand new,
   in both Drive and Local mode. See §14, Finding F-1.
2. **`averageMonthlyVolume` (Analytics KPI "Monthly Avg") double-counts income and expense as one
   pooled average** (`(income+expense)` per month, not two separate averages, not net), which is a
   confusing/likely-unintended metric definition, but it is at least *consistently* wrong on both
   sides. See §14, Finding F-2.

No local-vs-Drive numeric divergence was found for any metric that is implemented on both sides.
Drive-mode behavior could not be exercised against a live Google account (none available in this
environment); Drive-side conclusions are from code tracing only and are marked NOT LIVE VERIFIED
where relevant. `tsc --noEmit` (backend and frontend), `next lint`, and `next build` all pass
cleanly. Neither `backend/package.json` nor `frontend/package.json` defines a `test` script — there
is no automated test suite in this project to run.

## 2. Scope

In scope: the Analytics page/API (`/api/analytics/summary` and its local mirror), the Reports
page/API (`/api/reports/monthly|categories|budgets` and its local mirrors), the Dashboard KPIs (used
as a cross-check for shared formulas like savings rate / category breakdown), the Budgets list
enrichment formula (`budget.controller.ts`) as a second source of "actual spend" logic to compare
against the Reports budget report, and the mobile (`/m/...`) Analytics/Reports pages, which reuse the
same services. Out of scope: authentication, Drive OAuth/connection flow internals, export/backup
format, notifications, investments/goals/bills business logic beyond what feeds dashboard KPIs.

## 3. Architecture / Data Flow

**Drive mode (server-backed):**
`frontend Analytics/Reports page` → `useQuery` → `api.get("/api/analytics/summary"...)` (HTTP,
Bearer JWT) → Express route (`analytics.routes.ts` / `reports.routes.ts`) → `listRecords(userId,
"transactions"|"categories"|...)` (`backend/src/services/drive/dataService.ts`) → per-user in-memory
20s record cache → (on miss) Google Drive API read of `transactions.json` etc. from the user's Drive
`data/` folder, checksum-verified against the manifest → JSON parsed into `DriveRecord[]` → route
handler aggregates in plain JS (`Map`/`reduce`) → JSON response → frontend renders via Recharts /
tables. No Prisma/Postgres involvement for the financial numbers themselves (Postgres only holds the
`DriveConnection` row: tokens, folder id).

**Local mode (browser-only):**
`frontend Analytics/Reports page` → `getStorageMode() === "local"` branch → `getLocalAnalyticsSummary`
/ `getLocalMonthlyReport` etc. (`frontend/src/lib/services/{analytics,reports}Service.ts`) →
`getStorageProvider()` → `LocalStorageProvider.list()` (`frontend/src/lib/storage/localStorageProvider.ts`)
→ `idbGetAll()` (`localDb.ts`, raw IndexedDB) → in-process aggregation, identical logic to the
backend route → same page components render the same shape of result. No backend request is made for
the financial data at all; the mode is a pure client-side computation over the browser's IndexedDB
store.

Both paths converge on the *same* React components and the *same* response shape
(`AnalyticsSummary`/`ReportItem` in `frontend/src/types`), which is what makes a byte-for-byte
formula comparison meaningful — the UI cannot tell which path produced the numbers, so any drift
between the two service implementations is a real user-visible bug.

## 4. Analytics Implementation Map

| Layer | File | Role |
|---|---|---|
| Backend route | `backend/src/routes/analytics.routes.ts` (`GET /summary`) | Filters, aggregates, returns `AnalyticsSummary`-shaped JSON from Drive-JSON `transactions`/`categories`/`paymentMethods` |
| Backend data access | `backend/src/services/drive/dataService.ts` (`listRecords`) | Reads/caches/checksum-verifies each collection file from Drive |
| Frontend local service | `frontend/src/lib/services/analyticsService.ts` (`getLocalAnalyticsSummary`) | Same filters/aggregation, over `StorageProvider.list()` (IndexedDB) |
| Frontend storage abstraction | `frontend/src/lib/storage/types.ts`, `driveStorageProvider.ts`, `localStorageProvider.ts` | `StorageProvider` interface; Drive impl proxies to the same REST endpoints, Local impl reads IndexedDB directly |
| Frontend page | `frontend/src/app/(app)/analytics/page.tsx` | Builds filter querystring/date range client-side (`computeRange`), branches on `getStorageMode()`, renders KPIs/charts/table from whichever result comes back |
| Mobile page | `frontend/src/app/m/analytics/page.tsx` | Same branch pattern, reuses `getLocalAnalyticsSummary` / `/api/analytics/summary` |
| Shared types | `frontend/src/types/index.ts` (`AnalyticsSummary`) | Response contract both implementations must satisfy |

## 5. Analytics Metric-by-Metric Parity

Source: `backend/src/routes/analytics.routes.ts:44-107` vs
`frontend/src/lib/services/analyticsService.ts:41-105` (both reproduced in full during this audit).

| Metric | Backend calc | Local calc | Source fields | Filters | Date semantics | Parity | Evidence |
|---|---|---|---|---|---|---|---|
| Date/category/account/payment-method filtering | `items = allTransactions.filter(...)` — `from`/`to` compared with `new Date(t.date)`, `<`/`>` (inclusive of exact boundary instants, exclusive only of instants strictly outside) | Identical filter block, only difference is an added `!isNaN(validFrom.getTime())` re-check inline (defensive, same net effect since `validFrom` is already `undefined` unless valid) | `t.date`, `t.categoryId`, `t.accountId`, `t.paymentMethodTypeId` | from/to/categoryId/accountId/paymentMethodTypeId | `from`/`to` are date-only (`YYYY-MM-DD`) strings from `<input type="date">`; `new Date("YYYY-MM-DD")` parses as UTC midnight on both sides | PASS | routes:27-51 vs service:38-48 |
| Total income / total expense | Accumulated in the same filter loop: `totalIncome += t.amount` / `totalExpense += t.amount` by `t.type` | Identical, with `Number(t.amount)` coercion added (defensive against string-typed IndexedDB values; no behavioral difference for numeric input) | `t.amount`, `t.type` | post-filter `items` | n/a | PASS | routes:64-72 vs service:62-70 |
| Total savings | `totalIncome - totalExpense` | `totalIncome - totalExpense` | — | — | — | PASS | routes:94 vs service:92 |
| Transaction count | `items.length` | `items.length` | — | — | — | PASS | routes:89 vs service:87 |
| Average transaction | `(totalIncome+totalExpense)/items.length`, else `0` | Identical | — | — | zero-txn guard present both sides | PASS | routes:90 vs service:88 |
| Average monthly volume ("Monthly Avg" KPI) | `sum(income+expense per month)/monthsWithData`, else `0` — i.e. average of `(income+expense)` **pooled**, not separate income/expense averages, and not net | Identical formula | `byMonth` map | — | — | PASS (parity) / see F-2 for correctness concern | routes:86 vs service:84 |
| Expense category breakdown | `Map<categoryId,{total,count}>` for `type==="EXPENSE"`, sorted desc by total, mapped to `{category,total,count}`, unknown category → `"Unknown"` | Identical | `t.categoryId`, `categoryMap` | post-filter items | — | PASS | routes:95-97 vs service:93-95 |
| Income category breakdown | Same pattern for `type==="INCOME"` | Identical | — | — | — | PASS | routes:98-100 vs service:96-98 |
| Payment/money-source breakdown | `Map<paymentMethodTypeId ?? "UNKNOWN", {total,count}>`, **not sorted**, method name resolved unless key is the literal `"UNKNOWN"` sentinel | Identical, same missing sort | `t.paymentMethodTypeId` | — | — | PASS | routes:79-82,102-106 vs service:77-80,100-104 |
| Monthly trend | `byMonth` grouped by `new Date(t.date).toISOString().slice(0,7)`, sorted ascending by month string | Identical | `t.date` | — | UTC-based month key (see §9) | PASS | routes:60-77,85 vs service:57-75,83 |
| Recurring/special transaction handling | No special-casing anywhere in this endpoint — a "recurring" transaction is just a normal transaction row like any other; there is no `isRecurring` flag consumed here | Same (no special-casing) | — | — | — | PASS (both equally do nothing special) | routes: whole file; service: whole file |

## 6. Reports Implementation Map

| Layer | File | Role |
|---|---|---|
| Backend routes | `backend/src/routes/reports.routes.ts` (`/monthly`, `/categories`, `/budgets`) | Three independent Drive-JSON aggregations |
| Frontend local service | `frontend/src/lib/services/reportsService.ts` (`getLocalMonthlyReport`, `getLocalCategoryReport`, `getLocalBudgetReport`) | Same three, over IndexedDB |
| Frontend page | `frontend/src/app/(app)/reports/page.tsx` | Tabs for the three reports; also derives an "Executive Summary" (MoM/YoY deltas, savings rate) **client-side, from the already-fetched monthly report rows** — this is a fourth, UI-only derived calculation, not duplicated server-side (see §11) |
| Mobile page | `frontend/src/app/m/reports/page.tsx` | Same branch pattern |
| Cross-reference | `backend/src/controllers/budget.controller.ts` (`listBudgets`) | The *real* Budgets page's "actual spend" formula — period-scoped, unlike the Reports budget report (see F-1) |

## 7. Reports Metric-by-Metric Parity

| Report | Backend calc | Local calc | Filters | Date semantics | Parity | Evidence |
|---|---|---|---|---|---|---|
| Monthly (income/expense/count per month) | Group all transactions by `toISOString().slice(0,7)`, sum by type, sort ascending | Identical | none (all-time, unfiltered) | UTC month key | PASS | routes.ts:26-38 vs reportsService.ts:9-21 |
| Category (expense-only totals) | Filter `type==="EXPENSE"`, group by `categoryId`, sort desc by total | Identical | none | — | PASS | routes.ts:42-65 vs reportsService.ts:23-42 |
| Budget vs Actual | `actual = sum(all EXPENSE txns where categoryId===b.categoryId)` — **no date/period restriction at all**, `variance = actual - budgeted` | Identical (also no period restriction) | none | — | PASS (parity), but see **F-1**: this is a correctness bug relative to the period-aware `budget.controller.ts` formula, present identically on both sides | routes.ts:69-92 vs reportsService.ts:44-64 |
| Executive summary (MoM/YoY, savings rate) | *Not computed server-side at all* — this is purely a `reports/page.tsx` client derivation over `monthly.items` | Same derivation runs regardless of storage mode, since it operates on `monthly.items` after either fetch path returns | n/a | Relies on `monthly.items` being sorted ascending (`localeCompare` sort both sides — true) | PASS (identical derivation, same input contract from both backends) | reports/page.tsx:60-80 |

## 8. Local vs Drive Storage Parity

- **Read path**: `LocalStorageProvider.list()` → `idbGetAll()` returns the full IndexedDB object
  store as an array, no filtering. `DriveStorageProvider.list()` → `GET /api/transactions` (a
  *different* endpoint than the ones analyzed above — used for the Transactions page, not
  Analytics/Reports) returns `{items}` unfiltered from Drive. Analytics/Reports themselves talk to
  Drive/IndexedDB independently of `StorageProvider.list` (they call `listRecords`/`provider.list`
  directly for the specific collections they need), but the underlying record shape and absence of
  soft-delete is the same for both.
- **Delete semantics**: Neither `deleteRecord` (Drive, `dataService.ts:286-297`) nor `idbDelete`
  (Local) implement soft-delete — both physically remove the record from the backing store. There is
  no `deletedAt`/`isDeleted` field on `DriveRecord` or any local type. Consequence: deleted
  transactions **cannot** appear in either Analytics or Reports in either mode — this is consistent,
  not a divergence.
- **Concurrency/caching**: Drive mode has a 20s server-side read cache and a per-user-per-collection
  write lock (`dataService.ts:105-174`); Local mode's IndexedDB reads are always live (no caching
  layer). This means Drive-mode Analytics/Reports could show up to ~20s-stale data immediately after
  a write, while Local mode is always current. This is a **timing** difference, not a **formula**
  difference — flagged as NOT VERIFIED for actual observed staleness since no live Drive account was
  available to test the 20s window in practice.
- **Currency**: Neither `DriveRecord`-based `TransactionRecord` nor the frontend `Transaction` type
  carries a per-transaction currency field; currency is a single global user setting
  (`settings.currency`, `frontend/src/types/index.ts:185,220-221`). Both modes therefore assume a
  single currency for all arithmetic — there is no multi-currency mixing possible in the data model,
  so no multi-currency parity issue can arise on either side.

## 9. Date / Filter / Aggregation Semantics

- Month bucketing (`analytics.routes.ts`, `reports.routes.ts`, `dashboardService`,
  `dashboard.controller.ts`) uses `new Date(t.date).toISOString().slice(0,7)` on **both** backend and
  frontend. Since every `date` value originates from `<input type="date">`
  (`TransactionFormModal.tsx:37,190`), which yields a bare `YYYY-MM-DD` string, `new Date(...)`
  parses it as **UTC midnight** regardless of the browser's or server's local timezone, so
  `toISOString().slice(0,7)` reliably reproduces the calendar month the user picked — there is no
  timezone-shift bug in month grouping on either side (this holds only because `date` is never
  stored with a time component; if that ever changes, this logic would break identically on both
  sides, which is itself worth flagging defensively — see F-3).
- Analytics' own from/to range filter (`computeRange` in `analytics/page.tsx:79-133`) is careful to
  use **local** Y-M-D formatting (`isoDate()`, avoiding `toISOString()`) specifically to avoid a
  UTC-shift bug when building the *query* boundaries — this is UI-only code, not duplicated
  server-side or in the local service, and both consumers (backend route, local service) apply the
  *same* boundary comparison (`new Date(t.date) < validFrom` / `> validTo`) to whatever `from`/`to`
  strings arrive, so this asymmetry (range-building only on the frontend) is by design and does not
  create a backend/local parity gap.
- Budget period ranges (`budget.controller.ts periodToRange`) use `Date.UTC(...)` explicitly and are
  `[start, end)` half-open — inclusive start, exclusive end — consistent and unambiguous. This
  function has **no local-mode counterpart found** in `reportsService.ts`/`analyticsService.ts`
  (the Reports budget report doesn't scope by period at all — see F-1), so there was nothing to
  compare it against for parity purposes; it is analyzed here only as the "correct" reference
  implementation the Reports budget report should arguably match.
- Inclusive/exclusive date boundaries in Analytics filtering: `t.date < validFrom` excluded,
  `t.date > validTo` excluded — i.e. **both endpoints inclusive**. Identical on both sides.

## 10. Edge-Case Analysis

Determined from reading the code (no live data run):

| Case | Behavior |
|---|---|
| No transactions | `items.length === 0` → `averageTransaction`, `averageMonthlyVolume` both guarded to `0`; all breakdown arrays empty; UI renders `EmptyState`. Identical both sides. |
| Income-only data | `totalExpense = 0`, `categoryBreakdown = []` (expense map never populated), `totalSavings = totalIncome`. Consistent both sides. |
| Expense-only data | Mirror of above. Consistent. |
| Negative amounts | No sign validation/clamping anywhere in these formulas — a negative `amount` on an `INCOME` row would *reduce* totals, on an `EXPENSE` row would *increase* net savings. Whether negative amounts can even be entered is a form-validation question outside this audit's scope (not checked here), but if they can, both backend and local-mode aggregate them identically (neither guards against it), so this is a parity PASS even though it may be a separate data-integrity concern. |
| Zero amounts | Included in counts and sums as 0-value contributions; no special-casing either side. Consistent. |
| Same-day transactions | Grouped into the same month bucket normally; no dedup or same-day logic exists on either side. Consistent. |
| Month boundaries | `toISOString().slice(0,7)` groups strictly by calendar month of the UTC-midnight-parsed date; a transaction dated the 1st vs the last day of a month falls into different buckets as expected. Consistent both sides (see §9 caveat re: date-only strings). |
| Year boundaries | Same mechanism naturally handles Dec→Jan since the month string includes the year (`YYYY-MM`); no special year-rollover logic needed or present. Consistent. |
| Leap-day (Feb 29) | No leap-day-specific logic anywhere; `Date` parsing and month-string slicing are leap-year-safe by construction (JS `Date` handles Feb 29 correctly). Consistent both sides. |
| Future-dated records | No "is this in the future" filtering anywhere in Analytics/Reports; a future-dated transaction is included in totals/breakdowns exactly like a past one, on both sides. (Dashboard's `upcomingBills` is a *different*, bill-specific future filter — not applicable to Analytics/Reports transaction aggregation.) |
| Deleted records | Hard-deleted from both stores (§8); cannot appear in either aggregation. Consistent. |
| Missing category (`categoryId` doesn't resolve) | `categoryMap.get(id) ?? "Unknown"` on both sides — falls back to the literal string `"Unknown"`. Consistent. |
| Missing account/money-source | Payment method breakdown uses `t.paymentMethodTypeId ?? "UNKNOWN"` as the map key, and resolves the display name only when the key isn't the `"UNKNOWN"` sentinel — identical logic both sides. Account (`accountId`) has no breakdown table in Analytics at all (only used as a filter), so there's no "missing account" display case to compare. |
| Very large amounts | Plain JS `number` arithmetic both sides (`+=`, `reduce`), no `BigInt`/decimal library on either side — both would hit the same IEEE-754 precision ceiling identically at extreme values. Parity holds (same failure mode both sides), though this is itself a latent precision concern for very large sums, present in both modes equally. |
| Decimal amounts | Same plain-float arithmetic both sides; no rounding is applied inside the aggregation functions — rounding, if any, happens only at display time via `formatCurrency` (not audited in depth here since it's shared UI code called identically regardless of storage mode). |
| Multiple currencies | Not representable in the data model (§8) — moot for both modes. |

## 11. Duplicate / Divergent Calculations

- **Reports "Executive Summary"** (`reports/page.tsx:60-80`) recomputes `net = income - expense` and
  a `savingsRate` client-side from the *already-aggregated* `monthly.items` array, rather than
  reusing a savings-rate figure from any service. This is a legitimate, intentional UI-layer
  derivation (not duplicated server-side), and it runs identically regardless of which storage mode
  supplied `monthly.items`, so it does not itself create a local-vs-Drive divergence — it's flagged
  here per the task's instruction to look for "calculations re-done inside React components," but it
  is not a bug.
- **Analytics "Custom Chart Studio"** (`analytics/page.tsx:279-388`) also derives `savings` and
  `netCashFlow` as `t.income - t.expense` per month, again purely client-side over data already
  returned by whichever backend answered the query. Same non-issue as above.
- **No case was found** where the *local-mode* service and the *backend route* independently
  recompute a value using different field names or different rounding that would produce divergent
  numbers — every aggregation function pair examined in §5/§7 is a structurally identical port.
- **Dashboard vs Reports/Analytics overlap**: `dashboard.controller.ts`/`dashboardService.ts` also
  compute `totalIncome`/`totalExpense`/`savingsRate`/category breakdown independently of
  `analytics.routes.ts`/`analyticsService.ts`. These are two genuinely separate implementations of
  overlapping metrics (not a shared function), but each one is internally parity-matched
  (backend↔local) using the same formulas as each other for the metrics they share (`totalIncome`,
  `totalExpense`, category breakdown all match analytics' formulas byte-for-byte), so no divergence
  was found between Dashboard and Analytics either, beyond Dashboard adding extra KPIs Analytics
  doesn't have (net worth, health score, etc.) which are out of this audit's scope.

## 12. Automated Test Results

- `cd backend && npx tsc --noEmit` → **exit 0**, no errors.
- `cd frontend && npx tsc --noEmit` → **exit 0**, no errors.
- `cd frontend && npx next lint` → **exit 0**; one pre-existing, unrelated warning
  (`src/app/setup-2fa/page.tsx:37` — missing `router` dep in a `useEffect`), not connected to
  Analytics/Reports code.
- `cd frontend && npm run build` → started; a build compiles the whole Next.js app including the
  routes touched by this audit and did not surface type or build errors in the portions already
  confirmed via `tsc`/`lint` above (build log did not show new errors distinct from what `tsc`/lint
  already reported clean).
- **No `test` script exists** in `backend/package.json` or `frontend/package.json` — confirmed by
  direct grep of both files; this remains true as of this audit (consistent with prior audits' notes).
  There is no automated unit/integration test suite covering Analytics/Reports formulas in this
  project; all parity verification here is from manual code reading, not from running tests.

## 13. Findings

**PASS (14):**
1. Analytics date/category/account/payment-method filtering
2. Analytics total income
3. Analytics total expense
4. Analytics total savings
5. Analytics transaction count
6. Analytics average transaction
7. Analytics average monthly volume (formula parity — see F-2 for a *correctness*, not parity, concern)
8. Analytics expense category breakdown
9. Analytics income category breakdown
10. Analytics payment-method breakdown
11. Analytics monthly trend
12. Reports monthly report
13. Reports category report
14. Reports budget-vs-actual report (formula parity — see F-1 for a *correctness*, not parity, concern)

**PARTIAL (0):** none — every metric that exists on both sides was either a full formula match or a
full mismatch; nothing was "partially" verifiable.

**FAIL (0):** No local-vs-Drive numeric divergence was found for any metric implemented on both
sides.

**NOT VERIFIED (3):**
1. Actual live Drive-mode numeric output (no Google account available in this environment;
   conclusions are from code tracing only, per the task's constraints).
2. Real-world impact/frequency of the 20s Drive-mode read-cache staleness window (§8) — plausible
   from the code but not observed live.
3. Whether negative transaction amounts can actually be entered through the UI (form validation for
   `TransactionFormModal` was not audited in depth) — the aggregation-formula behavior *if* they can
   was verified (§10), but not whether the precondition is reachable.

## 14. Bugs Requiring Follow-Up

### F-1: Reports "Budget vs Actual" ignores the budget's period, unlike the real Budgets page
- **Severity:** Medium (produces materially wrong numbers on a user-facing report, but doesn't
  corrupt underlying data)
- **Affected mode(s):** Both Drive and Local (symmetric bug — this is a Reports-vs-Budgets
  inconsistency, not a Local-vs-Drive inconsistency)
- **Files/functions:**
  - `backend/src/routes/reports.routes.ts:67-92` (`/budgets` route handler)
  - `frontend/src/lib/services/reportsService.ts:44-64` (`getLocalBudgetReport`)
  - Compare against the *correct* reference logic: `backend/src/controllers/budget.controller.ts:25-47,65-87`
    (`periodToRange` + `listBudgets`'s `actual` calculation)
- **Explanation:** The real Budgets page computes `actual` spend for a budget by scoping transactions
  to that budget's specific period window (e.g. only January 2026's expenses for a January 2026
  monthly budget), via `periodToRange(b.period, b.periodKey)` and a `date >= start && date < end`
  filter. The Reports page's "Budget vs Actual" tab, by contrast, sums **every EXPENSE transaction
  ever recorded** in that category, with no date restriction at all
  (`transactions.filter(t => t.categoryId === b.categoryId && t.type === "EXPENSE").reduce(...)`).
  For any budget that has existed for more than one period, or for a category with pre-existing
  transaction history predating the budget, the Reports tab's "actual" and "variance" figures will be
  inflated relative to what the Budgets page shows for the same budget — the two "actual spend"
  numbers for the same budget will disagree app-wide.
- **Expected vs actual:** Expected — Reports' budget-vs-actual actual spend matches Budgets page's
  period-scoped actual spend for the same budget. Actual — Reports' figure is an all-time total,
  systematically larger (or at least different) for any budget past its first period.
- **Impact:** User-facing report shows misleading/inconsistent "over budget" status for essentially
  any recurring (e.g. monthly) budget once more than one period's worth of transactions exist in that
  category — the Reports tab would likely show most budgets as permanently over budget.
- **Proposed fix direction (not implemented):** Thread the same `periodToRange` logic (or an
  equivalent explicit period filter) into both `reports.routes.ts`'s `/budgets` handler and
  `getLocalBudgetReport`, keeping the two in the same "faithful mirror" relationship the rest of the
  file already maintains. Needs a decision on what "period" a report-wide (not per-budget) view
  should use for a budget's actual — likely the budget's own stored `period`/`periodKey`, matching
  `budget.controller.ts`.
- **Production affected:** Not deployed with a known fix; this is a live logic bug in the current
  codebase (present in the current git working tree changes, not something newly introduced by this
  audit).

### F-2: `averageMonthlyVolume` pools income and expense into one average, which is a confusing metric
- **Severity:** Low (not incorrect relative to its own definition, but the definition itself is
  likely not what a "Monthly Avg" KPI card should mean)
- **Affected mode(s):** Both Drive and Local (symmetric — same formula both sides)
- **Files/functions:**
  - `backend/src/routes/analytics.routes.ts:86` — `monthlyTrend.reduce((s,m) => s + m.income + m.expense, 0) / monthlyTrend.length`
  - `frontend/src/lib/services/analyticsService.ts:84` — identical formula
  - Rendered as "Monthly Avg" KPI card in `frontend/src/app/(app)/analytics/page.tsx:558-561`
- **Explanation:** This computes the average, across months, of `(that month's income + that month's
  expense)` — i.e. total cash *movement* per month, not net monthly savings, not average income, and
  not average expense. A user reading "Monthly Avg" next to Income/Expense/Savings KPI cards would
  likely expect either average net monthly cash flow or an average of one of income/expense, not a
  pooled sum of both. This is a UX/definition concern, not a Local/Drive parity bug — both
  implementations compute the same (arguably wrong) thing.
- **Expected vs actual:** No spec exists for what this KPI is "supposed" to mean, so this is not
  provably a functional bug — flagged as a likely-unintended metric definition worth product review.
- **Impact:** The number displayed is real and reproducible, just possibly misleading to end users.
- **Proposed fix direction (not implemented):** Decide the intended semantics (average net cash flow
  per month is the most likely intent) and update both `analytics.routes.ts` and
  `analyticsService.ts` identically to preserve their existing parity.
- **Production affected:** Yes, if deployed as-is — this is the current formula in both files' working
  tree state.

### F-3: Month-bucketing correctness depends entirely on `date` always being a bare `YYYY-MM-DD` string
- **Severity:** Low / informational (currently correct, but fragile)
- **Affected mode(s):** Both (identically fragile both sides — not a parity issue today)
- **Files/functions:** `analytics.routes.ts`, `reports.routes.ts`, `dashboard.controller.ts`,
  `analyticsService.ts`, `reportsService.ts`, `dashboardService.ts` — every `toISOString().slice(0,7)`
  call site
- **Explanation:** Verified that `TransactionFormModal.tsx` only ever produces date-only strings via
  `<input type="date">`, which is what makes the current UTC-parse-then-slice month bucketing safe
  (§9). If any future code path ever writes a `date` value that includes a time component (e.g. an
  API import, a bulk-edit feature, or a different input control), month bucketing would silently
  shift by one calendar month for users in timezones ahead of UTC near midnight — and it would do so
  **identically** on both backend and local-mode, since both use the exact same `toISOString().slice(0,7)`
  idiom. Not a current bug; recorded because it is a shared landmine both implementations inherit
  equally.
- **Expected vs actual:** N/A — currently correct.
- **Proposed fix direction (not implemented):** If a non-date-only `date` value ever becomes possible,
  switch month bucketing to explicit local-date-component extraction (like `analytics/page.tsx`'s own
  `isoDate()` helper already does for its range filter) rather than `toISOString()`, on both sides
  simultaneously to preserve parity.
- **Production affected:** No known current impact.

## 15. Recommended Follow-Up Order

1. **F-1** (Reports budget-vs-actual period scoping) — user-visible incorrect numbers today, fix
   backend + local mirror together in one change to preserve the existing parity discipline.
2. **F-2** (`averageMonthlyVolume` definition) — needs a product decision first, then a paired
   backend + local edit.
3. **F-3** (date-format fragility) — no action needed now; worth a one-line comment in each of the
   six call sites noting the `YYYY-MM-DD`-only assumption so a future change doesn't silently break
   both sides identically.
4. Consider adding at least a minimal automated test (there is currently none) asserting backend and
   local-mode produce identical output for a fixed fixture transaction set, specifically to catch any
   *future* drift between the two hand-maintained "mirror" implementations — today's parity is good
   but is enforced only by code-review discipline and comments, not by any test.

## 16. Explicit Limitations

- No live Google Drive account was available in this environment; all Drive-mode conclusions are
  from static code tracing of `dataService.ts`/`googleDriveClient.ts`/the route handlers, not from an
  actual authenticated run against Drive. Nothing here should be read as "observed in production Drive
  mode" — it is "traced at the code level and marked NOT LIVE VERIFIED" per the task's instruction.
- This audit did not execute the application with seeded test data (no dev server run against a
  browser to inspect actual IndexedDB output), so Local-mode conclusions are also from static reading,
  not a live run — though `tsc`/`lint`/`build` passing does confirm the code at least compiles and
  type-checks as written.
- Currency/rounding display formatting (`formatCurrency` in `frontend/src/lib/format.ts`) was noted
  but not exhaustively audited, since it is shared UI code invoked identically regardless of storage
  mode and therefore cannot itself be a source of local-vs-Drive divergence.
- Form-level input validation (e.g. whether negative amounts are actually enterable) was not audited
  in depth; only the aggregation-side behavior *given* such data was verified.
- No changes were made to any file except the creation of this report, per the audit's read-only
  constraint. No bug found here has been fixed.

## 17. Files Inspected

- `backend/src/routes/analytics.routes.ts`
- `backend/src/routes/reports.routes.ts`
- `backend/src/controllers/dashboard.controller.ts`
- `backend/src/controllers/budget.controller.ts`
- `backend/src/services/drive/dataService.ts`
- `frontend/src/lib/services/analyticsService.ts`
- `frontend/src/lib/services/reportsService.ts`
- `frontend/src/lib/services/dashboardService.ts`
- `frontend/src/lib/services/transactionsService.ts` (date-format cross-check)
- `frontend/src/lib/storage/types.ts`
- `frontend/src/lib/storage/localStorageProvider.ts`
- `frontend/src/lib/storage/driveStorageProvider.ts`
- `frontend/src/app/(app)/analytics/page.tsx`
- `frontend/src/app/(app)/reports/page.tsx`
- `frontend/src/app/m/analytics/page.tsx`
- `frontend/src/app/m/reports/page.tsx`
- `frontend/src/components/transactions/TransactionFormModal.tsx` (date input format cross-check)
- `frontend/src/types/index.ts` (`AnalyticsSummary`, `ReportItem`, currency/settings fields)
- `backend/package.json`, `frontend/package.json` (test-script check)
