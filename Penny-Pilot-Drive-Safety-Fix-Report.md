# Penny Pilot — Drive Safety Fix Report

Date: 2026-09-16
Scope: Implements exactly the two confirmed issues from `Penny-Pilot-P0-Drive-Safety-Trace.md`, plus the 507-classification fix. **No Local→Drive migration, Drive→Drive migration, StorageProvider redesign, database/schema change, OAuth change, or cookie/security change was made.** No commit/push/deploy.

---

## Exact Files Changed

**Backend:**
- `backend/src/controllers/budget.controller.ts` — `createBudget` now reads and forwards `Idempotency-Key` (it was the one financial-create controller that didn't already do this; transactions/investments/bills/goals already did).
- `backend/src/services/drive/init.ts` — new safety gate in `setupWorkspace` (Fix 2).

**Frontend:**
- `frontend/src/lib/idempotencyKey.ts` (new) — `generateIdempotencyKey()`.
- `frontend/src/lib/api.ts` — `api.post` accepts an optional `idempotencyKey`, sent as the `Idempotency-Key` header only when supplied.
- `frontend/src/lib/offlineAwarePost.ts` — `postWithOfflineQueue` now requires and forwards `idempotencyKey`, including onto the queued record.
- `frontend/src/lib/offlineQueue.ts` — `QueuedMutation`/`enqueueMutation` carry `idempotencyKey`.
- `frontend/src/lib/offlineSync.ts` — `flushOfflineQueue`'s retry `fetch()` now sends the queued item's `idempotencyKey`.
- `frontend/worker/index.ts` (service worker background-sync flush) — same header added to its independent retry path.
- `frontend/src/lib/storage/types.ts` — `StorageProvider.create()` interface gains an optional `idempotencyKey` parameter.
- `frontend/src/lib/storage/driveStorageProvider.ts` — `create()` forwards the key; `toOutcome` fix (Fix 3, see below).
- `frontend/src/lib/storage/localStorageProvider.ts` — `create()` accepts (and correctly ignores) the same parameter, to satisfy the shared interface.
- `frontend/src/components/transactions/TransactionFormModal.tsx`, `frontend/src/components/budget/BudgetFormModal.tsx`, `frontend/src/app/(app)/investments/page.tsx`, `frontend/src/app/(app)/bills/page.tsx`, `frontend/src/app/(app)/goals/page.tsx`, `frontend/src/components/mobile/AddTransactionSheet.tsx` — each now holds one stable idempotency key per create attempt (a `useRef`, regenerated only on a genuinely new/fresh form session or after success) and passes it through to the create call.

No other files were touched. In particular: `AuthContext.tsx`, `SessionManager.tsx`, `login/page.tsx`, `(app)/layout.tsx`, cookie/CORS/CSRF code, and `StorageProvider`'s overall shape (beyond the one added optional parameter) are unchanged.

---

## FIX 1 — Frontend Idempotency for Financial Creates

### Architecture trace (why these locations)

There is no single call-site for every financial create — three distinct paths exist, and all three needed the fix:
1. **`postWithOfflineQueue`** (`lib/offlineAwarePost.ts`) — used by Transactions/Expenses/Income, Budgets, and Investments. This already had an offline-queue mechanism for network failures, making it the most safety-critical path, since a queued mutation can be retried automatically later (by `offlineSync.ts`'s `flushOfflineQueue`, triggered on reconnect) or by the **service worker's own independent background-sync flush** (`worker/index.ts`) if the tab was closed — a genuine, existing, already-automatic retry surface that needed the same protection.
2. **Direct `api.post`** — Bills and Goals pages call the API client directly (no offline queue for these two).
3. **Reference-record quick-create** (`TransactionFormModal.tsx`'s `createReferenceRecord`, for categories/accounts/payment-methods created inline from the transaction form) — also a direct `api.post`.

(`DriveStorageProvider.create()` itself was also fixed, for interface completeness, but is not presently reachable from any live UI path — every current form branches around it in Drive mode and calls `postWithOfflineQueue`/`api.post` directly. Confirmed by tracing every call site; noted so this isn't mistaken for the primary fix.)

The key itself is generated and held by each **form component** (via `useRef`), not deep inside the transport layer, because only the component knows whether a given submit is a brand-new attempt or a retry of the one still in flight/failed. Each component regenerates its key exactly twice: when a fresh (non-edit) create session starts, and after a successful create — every call in between (including a user clicking a "Try Again" action) reuses the same key.

### Idempotency implementation and retry semantics

- **Generation:** `crypto.randomUUID()` — cryptographically strong, unpredictable (Fix requirement: "Do NOT use predictable IDs" — satisfied).
- **Transport:** sent only as the `Idempotency-Key` HTTP header, never in a URL or request body (Fix requirement satisfied).
- **Logging:** not logged anywhere — grepped the full diff for any `console.log`/`console.error` referencing the key; none exists.
- **Scope:** only wired into CREATE (POST) calls for the six financial/reference-record create paths listed above. `api.patch`/`api.get`/`api.delete` were not touched — no idempotency key is sent on update/read/delete calls, matching the fix requirement and the backend's own contract (only `createRecord` accepts `idempotencyKey`; update/delete were not touched on the backend either).
- **Backend dedup logic** (`dataService.ts`'s `createRecord`, unchanged by this pass but read in full to confirm correctness): on a create call with a key, it first checks an in-memory cache (`userId:collection:key` → the record from the first successful create, 5-minute TTL). A cache hit returns the **original record immediately, without touching Drive at all** — no second write, no duplicate. A cache miss creates normally and populates the cache for any future retry with that same key. A different key (or no key) always creates fresh. This is exactly the "same key → same result, different key → independent creation" contract required.
- **No automatic retries were introduced.** The plumbing only makes an *existing, already-possible* retry (a user clicking "Try Again" or an already-existing offline-queue/service-worker replay) safe — it does not add any new automatic retry loop anywhere.

### Verification

- **Backend typecheck, frontend typecheck, lint, production build:** all pass (see Tests section).
- **Functional smoke test (live, local dev):** logged into the local dev environment with the existing disposable test account and created a Goal through the actual UI form — it succeeded with no runtime errors, confirming the new plumbing doesn't break the existing create flow.
- **Backend dedup logic:** verified by full code trace of `createRecord` (reproduced above) — the cache-hit/cache-miss logic is straightforward and correct on inspection.
- **NOT VERIFIED LIVE:** the disposable test account used in this environment has **no connected Google Drive** (`GET /api/drive/status` → `connected: false`), and completing a real Google OAuth consent flow isn't possible headlessly in this environment. As a result, the account's storage mode defaulted to Local (IndexedDB) for the live UI smoke test above, which does **not** exercise the network/`Idempotency-Key` path at all (confirmed: the Goal created during the smoke test never appeared via `GET /api/goals`, which correctly returned `DRIVE_NOT_CONNECTED` — proving it went through IndexedDB, not the API). **The full "create → response lost → retry → no duplicate" behavior against the real Drive-backed endpoint could not be exercised end-to-end in this environment.** This is verified by code trace only, not by an actual network-level repro, and is reported honestly rather than claimed as tested.
- **Additional caveat found during this trace, not previously flagged:** the idempotency cache is in-memory and per-process (same characteristic already true of the pre-existing folder/manifest/record caches in this file). A backend process restart between a lost-response create and its retry would lose the cached mapping, and the retry would not be recognized — a narrower residual gap than before this fix (it now covers the common case: network blip, quick manual retry, same process), but not an absolute guarantee across a deploy/restart boundary. Not fixed in this pass (would require persisting the idempotency mapping, which is a larger architectural change out of this fix's narrow scope) — flagged as a remaining NOT VERIFIED/residual-risk item.

---

## FIX 2 — Drive Account-Change "Use Existing" Safety

### Behavior before

`setupWorkspace` (`backend/src/services/drive/init.ts`), when the migration-completion marker was absent on an existing (possibly non-empty) target workspace, proceeded directly into `migratePostgresDataToDrive`, which wholesale-replaces every collection with the connecting user's own data — regardless of whether the existing content was that same user's own interrupted attempt or something else entirely (see the P0 trace for the exact scenario).

### Behavior after

A new check runs immediately after the existing `readMigrationMarker` check and before `migratePostgresDataToDrive` is ever called:

```
alreadyMigrated (marker present) → return early, unchanged (existing behavior preserved)
marker absent →
  read actual record counts across all collections (verifyStorageWithContext, already existed, reused as-is)
  any collection non-empty → throw ApiError(409, "...", "DRIVE_WORKSPACE_UNVERIFIED")
  all collections empty → proceed to migratePostgresDataToDrive exactly as before
```

This is a pure **addition** — no existing branch's logic was altered, only a new refusal path inserted before the destructive one.

Because this lives in `setupWorkspace` itself (the single function both `/callback` and `/resolve-account-change` funnel through), it protects **every** caller uniformly, including one the original trace didn't explicitly cover: a **brand-new** Drive connection (no prior `BackupConnection` row) that happens to land on a Google account with a pre-existing, unmarked "Penny Pilot" folder never goes through the `accountChanged`/reuse-or-fresh choice at all today (that check only fires when there's a *prior* connection to compare against) — `getOrCreatePennyPilotFolders` would silently find-and-reuse that folder by name. This new guard now blocks that silent case too, not just the explicit "use existing" choice. This is a natural, correct consequence of placing the guard at the shared chokepoint rather than only inside `/resolve-account-change`, consistent with "narrowest shared location that covers all paths."

### Required behaviors, checked one by one

- **"Do NOT call the destructive wholesale replacement path"** — satisfied: the throw happens strictly before `migratePostgresDataToDrive` is invoked.
- **"Do NOT silently merge"** — satisfied: nothing is written at all in the refusal case.
- **"Do NOT overwrite existing collections"** — satisfied, same reason.
- **"Do NOT delete existing Drive data"** — satisfied: no delete call exists in this path at all (confirmed in the original P0 trace and unchanged here).
- **"Require an explicit safe resolution path instead"** — satisfied via the structured `409 DRIVE_WORKSPACE_UNVERIFIED` error, which `/resolve-account-change` (an `asyncHandler`-wrapped JSON route) propagates correctly through the existing `errorHandler.ts` → the frontend receives `{error, code: "DRIVE_WORKSPACE_UNVERIFIED"}` and can direct the user to explicitly choose "Start Fresh" — no new migration implementation was built, exactly as instructed.
- **"Preserve the existing start_fresh behavior"** — unchanged: `resolve-account-change`'s `choice === "start_fresh"` branch (a distinctly-named new folder) never calls this code path differently; verified by re-reading — no lines in that branch were touched.
- **"Preserve the normal already-completed workspace behavior"** — unchanged: the `alreadyMigrated` early-return (the common case for any workspace that was ever fully set up before) is untouched and still runs first.
- **"Keep unrelated Drive files outside the Penny Pilot workspace untouched"** — unaffected; this fix only changes what happens *inside* an already-resolved folder tree, never touches folder resolution/scoping itself.
- **User-facing message** — the error text reads: *"This Google Drive folder already contains Penny Pilot data, but Penny Pilot can't verify it was fully set up. To protect that data, it can't be automatically reused. Please choose 'Start Fresh' to create a new workspace instead."* — explicitly explains the "can't verify migration state" reason, per the requirement.

### Trade-off knowingly accepted

This guard is intentionally conservative: it also blocks the narrow *legitimate* case of a user retrying their own genuinely-interrupted first attempt against the same folder (their own data, safe to replay) — because the code has no reliable way to distinguish that from the unsafe cross-account case without more information. Per the task's explicit requirement ("do NOT call the destructive wholesale replacement path" whenever the marker is missing and data exists, with no exception carved out for the same-user case), this is the intended, correct behavior — not an oversight. A user in that specific edge case would need to choose "Start Fresh" (safe, always available) rather than "Use Existing."

### Verification

- **Backend typecheck:** pass (confirms `ApiError` import and throw are well-typed).
- **Code trace:** confirmed line-by-line above; no other branch's control flow was altered.
- **NOT VERIFIED LIVE:** exercising this guard live would require two connected Google Drive accounts and a deliberately-induced missing-marker state — not achievable in this environment (no real Google OAuth flow available headlessly, consistent with the same limitation noted throughout this project's Drive-related work). This fix is verified by static trace and typecheck only.

---

## FIX 3 — HTTP 507 Outcome Classification

### Behavior before

`frontend/src/lib/storage/driveStorageProvider.ts`'s `toOutcome`: `if (err.status === 0 || err.status >= 500) return "unknown"` — since `507 >= 500`, a definitively-known Drive-quota-exceeded failure was classified as `"unknown"` (implying "we can't tell, verify before retrying") instead of `"failure"` (the honest, certain answer).

### Behavior after

A `KNOWN_FAILURE_STATUSES` set (currently just `{507}`) is checked first; any status in that set is always `"failure"`, regardless of being `>= 500`. Every other `>= 500` status (or `0`, network failure) is still `"unknown"`, unchanged.

### Preserved behavior

`code`/`action` (`DRIVE_STORAGE_QUOTA_EXCEEDED`/`FREE_DRIVE_SPACE`) were already being forwarded correctly regardless of the `status` field bug (confirmed in the original P0 trace) — this fix only corrects the `status` field itself; nothing about the error code/action/message propagation was touched.

### Verification

- **Backend/frontend typecheck, build:** pass.
- **Code trace:** the new set-membership check is a small, deterministic, three-line change; correctness verified by direct reading, both for the 507 case (now `"failure"`) and for an ordinary `503`/`0` case (still `"unknown"`, since `503`/`0` aren't in `KNOWN_FAILURE_STATUSES`).
- **NOT VERIFIED LIVE:** reproducing an actual Google Drive `507` response requires a genuinely full test Drive account, impractical to set up — same limitation already noted in the original P0 trace. Verified by code trace only.

---

## Tests Executed and Results

| Check | Result |
|---|---|
| `cd backend && npx tsc --noEmit` | **PASS** — 0 errors |
| `cd frontend && npx tsc --noEmit` | **PASS** — 0 errors |
| `cd frontend && npx next lint` | **PASS** — 1 pre-existing, unrelated warning (`setup-2fa/page.tsx:37`, missing `router` dep — not touched by this phase) |
| `cd frontend && npm run build` | **PASS** — all 44 routes built successfully |
| Backend automated tests | **N/A — none exist.** No `test` script in `backend/package.json`; confirmed again this phase, not assumed. |
| Frontend automated tests | **N/A — none exist.** Same check on `frontend/package.json`. |
| Live UI smoke test (Goal creation) | **PASS** (functional, no errors) — but exercised the Local-mode path, not the Drive-backed idempotency path (see Fix 1's NOT VERIFIED note) |
| `npx prisma migrate status` (read-only) | **PASS** — "Database schema is up to date!", 22 migrations, no drift, no writes performed |

---

## Remaining NOT VERIFIED Items

1. **Fix 1's core guarantee** ("create → response lost → retry → no duplicate") was not exercised end-to-end against the real Drive-backed endpoint — no connected Google Drive account was available in this environment. Verified by full code trace of both the frontend key-generation/reuse logic and the backend's cache-based dedup logic, not by an actual network-level reproduction.
2. **Fix 1's idempotency cache is in-memory/per-process** — a backend restart between a lost-response create and its retry is not covered. Pre-existing architectural characteristic, not introduced by this fix, not addressed in this narrowly-scoped pass.
3. **Fix 2's guard** was not exercised live — requires two connected Drive accounts and a deliberately-induced missing-marker state, not reproducible in this environment. Verified by code trace and typecheck only.
4. **Fix 3's 507 case** was not exercised against a genuinely full Drive account. Verified by code trace only.
5. Reference-record quick-create (categories/accounts/payment-methods, wired with a key on the frontend as part of this pass) is **not yet read by the backend** — those routes (`reference.routes.ts`) don't check for `Idempotency-Key` at all. The header is sent harmlessly (ignored) today; this is out of this fix's explicitly financial-CREATE scope and was not touched, per "narrowly scoped" instructions — noted so it isn't mistaken for an oversight.

---

## Confirmation: No DB/Migration/Env/Deploy/Git Operations

- **Database:** no writes, no schema changes. `prisma migrate status` was run strictly read-only, confirmed above.
- **Migrations:** none created, none run.
- **Environment variables:** none changed.
- **OAuth:** no configuration changed (Google Client ID/Secret/Redirect URI untouched).
- **Cookies/security architecture:** untouched — no file in `backend/src/lib/tokens.ts`'s cookie logic, `backend/src/app.ts`'s CORS/CSRF logic, or `frontend/src/lib/AuthContext.tsx`/`SessionManager.tsx` was modified this phase.
- **Deployment:** none.
- **Git:** no commit, no push. `git status` confirms all changes remain unstaged working-tree modifications.
