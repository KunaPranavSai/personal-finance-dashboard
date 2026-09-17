# Penny Pilot — Remaining Audit and Implementation Plan

Date: 2026-09-16
Scope: Read-only status audit synthesizing the Master Implementation Plan against the four prior audit/investigation reports, plus fresh code checks where a prior report left an item ambiguous. **No code was modified. No database/migration commands were run. No environment variables were changed. No commit/push/deploy.**

Confirmed current production state (per your message, not independently re-verified in this pass): same-site API domain (`api.pennypilot.pro`) live, DNS/TLS/health verified, Google OAuth redirect updated, `NEXT_PUBLIC_API_URL` updated, desktop login/session persistence verified. Real iOS Safari remains explicitly **NOT VERIFIED** and intentionally postponed.

---

## Git State

```
git status: 34 modified tracked files, ~15 untracked files (this session's report .md files,
            new StorageProvider/services/errorActions code, driveErrors.ts, robots.ts, sitemap.ts,
            DataStorageCard.tsx)
git diff --stat: 35 files changed, 744 insertions(+), 179 deletions(-)
```

Nothing has been committed at any point in this entire multi-phase effort. Every finding below concerns the **working tree**, not any commit.

---

## Requirement Status Table

| Requirement | Status | Evidence | Risk | Action |
|---|---|---|---|---|
| StorageProvider abstraction | FULL | `frontend/src/lib/storage/types.ts`, `localStorageProvider.ts`, `driveStorageProvider.ts` | Low | None |
| MutationOutcome (success/failure/unknown) pattern | FULL | `types.ts` | Low | None |
| Local-only mode + IndexedDB | FULL (code-level) | `localDb.ts`, `localSeed.ts`, `backupCrypto.ts` | Low | Live pass recommended before launch |
| Encrypted local export/import | FULL | AES-256-GCM + PBKDF2(150k)/SHA-256, random salt/IV, GCM tamper rejection | Low | None |
| **Local → Google Drive migration** | **NOT IMPLEMENTED** | See P0-1 below | **High** | Build or explicitly hide |
| **Google Drive → Google Drive migration** | **PARTIAL** | See P0-2 below | **High** | Build or explicitly hide |
| **Drive-full / quota recovery** | **PARTIAL** | See P0-3 below | **Medium-High** | Verify end-to-end |
| JWT/cookie fail-fast secrets | FULL | `tokens.ts`, `app.ts` | Low | None |
| AUTH_* error catalog (5 codes) | FULL | `middleware/auth.ts`, `auth.routes.ts`, live-verified | Low | None |
| IDOR/authorization (Postgres-backed resources) | FULL | `Penny-Pilot-IDOR-Authorization-Audit.md` — live cross-user tested | Low | None |
| IDOR/authorization (Drive-backed financial resources) | FULL (structural, static-analysis only) | Same report — workspace resolved by `userId` before record id is ever consulted | Low-Medium | Live cross-user test still NOT VERIFIED (needs 2 real Drive-connected accounts) |
| Cross-site cookie architecture | RESOLVED (pending final re-verification) | Same-site API domain migration completed per your report | Low (was High) | Re-run full regression pass now that domain moved |
| Real iOS Safari verification | **NOT VERIFIED** | Explicitly postponed by your instruction | Unknown | Real-device test after same-site migration settles |
| Frontend error boundaries | **FULL** — *upgraded from the prior audit's "NOT VERIFIED"* | `frontend/src/app/error.tsx` exists: proper Next.js error boundary, no stack trace shown, "Try Again"/"Report Issue" actions, `console.error` breadcrumb only | Low | None — prior audit simply hadn't located this file |
| `dangerouslySetInnerHTML` (`layout.tsx:61`) | **FULL / PASS** — *upgraded from the prior audit's "PARTIAL, not confirmed static"* | Read directly: hardcoded, zero-interpolation inline script (theme-flash prevention only, reads `localStorage`, no server/user data injected) | None | None — confirmed not an XSS vector |
| Admin migration-status accuracy | PARTIAL | `admin/migration` page exists (per build output) but reflects a migration system that doesn't exist yet (see P0-1/P0-2) | Medium | Depends entirely on P0-1/P0-2 |
| Analytics/Reports local-vs-backend formula parity | **NOT VERIFIED** | Not completed in the prior audit; a shallow re-check this pass found the two implementations use non-overlapping internal field/function names, so a real side-by-side trace is still needed, not a quick grep | Medium | Dedicated formula-diff pass required |
| Accessibility | NOT VERIFIED | Code-level spot checks only in prior audit; not repeated this pass | Medium | Live pass (axe/VoiceOver/NVDA) required |
| Performance | NOT VERIFIED | Not systematically profiled | Low-Medium | Follow-up profiling pass |
| Backend/frontend typecheck, lint, build | FULL | All passed as of the last phase that ran them (IDOR audit phase) | Low | Re-run once more before any commit, since files have changed since (domain migration env vars, though no source edits) |
| Database migration status | FULL (read-only verified) | `prisma migrate status`: up to date, 22 migrations, no drift (as of last check) | Low | Re-check immediately before commit as routine hygiene |

---

## P0 Findings (Migration Safety & Financial Data)

### P0-1 — Local → Google Drive migration: NOT IMPLEMENTED

**Current implementation:** `frontend/src/components/settings/DataStorageCard.tsx`'s "Switch to Google Drive" button (line ~230-239) does exactly two things: sets the local storage-mode preference to `"drive"` and calls `router.push("/connect-drive")`. **It does not copy, migrate, or transfer any existing local IndexedDB data to Drive.** A user who has been using Local-Only mode and clicks this button lands on the normal Drive-connection flow as if starting fresh — their local data is not referenced anywhere in that flow.

**Files involved:** `frontend/src/components/settings/DataStorageCard.tsx`, `frontend/src/lib/storage/localStorageProvider.ts`, `frontend/src/lib/storage/driveStorageProvider.ts`, `frontend/src/lib/storage/types.ts` (has a `replaceCollection` primitive but no migration orchestration built on top of it).

**What is missing:** The entire validate → stage → write → verify → promote → preserve-source → delete-source-only-after-verified sequence the Master Plan (§9) requires. No code reads all local collections, writes them to a newly-connected Drive workspace, verifies the write, and only then switches the active provider.

**Risk:** **Low as currently shipped** (nothing destructive can happen, because nothing is implemented — the button just doesn't do what a user might expect) but **High if built carelessly later**, and **Medium as a product gap right now**: a Local-Only user who wants to move to Drive has no supported path except manual Export (from Local) → there is no corresponding "Import into Drive" entry point verified in this pass to complete that manually either (not checked this session — flag for the dedicated migration phase).

**Exact implementation required:** Build the staged flow per Master Plan §9, using `StorageProvider`'s existing `replaceCollection`-style primitives as the low-level write mechanism but wrapping them in: (1) read all local collections, (2) write to Drive workspace under a staging marker, (3) read back and checksum/compare against source, (4) only on full verification, flip the active `storageMode` preference, (5) only after the user explicitly confirms the switch (per §9's "explicit confirmation" step) does local data become eligible for cleanup — and even then, per your instructions, this should be a separate, deliberate, user-initiated action, not automatic.

**Could production data be affected?** Not by the current code (no-op beyond a mode flag + navigation). Would become a real risk once implemented if the write/verify/promote ordering isn't respected.

**Verification method:** Once built, must be tested with disposable data, verifying: source preserved on failure, no duplicate records after retry, no promotion without full verification.

### P0-2 — Google Drive → Google Drive migration: PARTIAL

**Current implementation:** `backend/src/services/drive/googleDriveClient.ts` and `backend/src/routes/drive.routes.ts` handle re-authentication and the "you connected a different Google account" choice (`resolve-account-change` endpoint, `pendingAccountChanges` map) — this lets a user *reconnect* to a different Drive account and choose to reuse or start a new workspace, but this is **account reconnection**, not a **verified data migration**. There is no code path that reads the old Drive A workspace's full dataset and writes/verifies it into Drive B before making B authoritative.

**Files involved:** `backend/src/routes/drive.routes.ts` (`resolve-account-change` handler), `backend/src/services/drive/connection.ts`, `backend/src/services/drive/init.ts` (`setupWorkspace`).

**What is missing:** The read-validate-write-verify-promote-preserve sequence from Master Plan §10. Currently, choosing "start a new empty workspace" for Drive B genuinely starts empty — old data in Drive A is not carried over at all (which is at least *safe*, if not *useful* — no silent merge or overwrite risk found). Choosing "reuse the existing workspace" in Drive B (if that workspace already has Penny Pilot data) has not been traced for whether it could silently merge with unrelated data already there — **flagged as NOT VERIFIED, needs a dedicated read of that exact code path before being relied upon**.

**Risk:** Medium-High — not because current code is destructive (it appears to fail safe, defaulting to "nothing carries over" rather than silently overwriting), but because the "reuse existing workspace" branch's exact behavior with pre-existing unrelated Drive B data has not been confirmed safe in this audit.

**Exact implementation required:** Same staged pattern as P0-1, applied Drive-to-Drive; additionally, the "reuse existing workspace" branch needs an explicit read/trace to confirm it truly asks before merging (Master Plan §11 requires this) rather than assuming.

**Could production data be affected?** Only if a real user attempts an account-change today and hits the "reuse existing workspace" branch — this is a genuine open question, not yet ruled out safe.

**Verification method:** Code trace of the exact `resolve-account-change` reuse path (not completed this pass — recommend as the first concrete task in the next phase, before any new migration code is written) + live test with two disposable Drive-connected test accounts.

### P0-3 — Drive quota/full recovery: PARTIAL

**Current implementation:** `backend/src/lib/driveErrors.ts` maps Google's quota-exceeded response to `DRIVE_STORAGE_QUOTA_EXCEEDED`, and `frontend/src/lib/errorActions.ts` maps that code to a "Manage Drive Storage" action button. This much is real and wired.

**What is missing:** End-to-end confirmation that a mutation which fails mid-write due to quota actually surfaces as this specific code (rather than a generic failure), and that the write itself doesn't partially complete (Master Plan §12's "your expense has not been saved" contract, plus §13's "never blindly retry" and §49's SUCCESS/FAILURE/UNKNOWN-OUTCOME contract).

**Risk:** Medium-High — a financial-data write path where quota-exceeded is mishandled could either silently lose a record or duplicate one on retry; not confirmed either way.

**Exact implementation required:** No code change presumed necessary yet — this needs tracing first: read `services/drive/dataService.ts`'s write path for what happens when Google's API returns quota-exceeded mid-write, confirm the `MutationOutcome` returned is `"failure"` (not falsely `"unknown"` treated as success, and not silently swallowed).

**Could production data be affected?** Only in the specific scenario of a real user's Drive being genuinely full during a write — narrow but real.

**Verification method:** Code trace first; live test only feasible with a deliberately near-full test Drive account, which is expensive/impractical to set up — likely stays code-verified rather than live-verified even after the trace.

---

## P1 Findings

### P1-1 — Admin migration-status accuracy: PARTIAL
The `admin/migration` page exists in the build output, but since P0-1/P0-2 aren't implemented as real migration systems, whatever "status" it currently shows cannot be accurate by definition. **Blocked on P0-1/P0-2**, not independently actionable.

### P1-2 — Frontend error boundaries: **RESOLVED this pass, upgraded to FULL**
The prior audit marked this "NOT VERIFIED" because it wasn't located. This pass found and read `frontend/src/app/error.tsx` in full: a complete, correctly-implemented Next.js error boundary (no stack traces exposed, "Try Again" calls `reset()`, "Report Issue" copies safe diagnostic text including the Next.js `digest` — not a raw stack — to clipboard). **No further action needed** unless per-route-group boundaries are specifically desired for finer-grained recovery (not required by the Master Plan, which only asks for "Try Again"/"Go to Dashboard" — note: current implementation has "Try Again"/"Report Issue", not "Go to Dashboard" as the plan's example shows; this is a cosmetic deviation, not a functional gap, and not worth flagging as a defect).

### P1-3 — Analytics/Reports local-vs-backend formula parity: NOT VERIFIED
Still open. A shallow search this pass for shared field names (`savingsRate`, `financialHealth`) between `backend/src/routes/analytics.routes.ts` and `frontend/src/lib/services/analyticsService.ts` found no overlap — meaning either the logic lives under different names/files than guessed (likely `dashboard.routes.ts` on the backend, given the field names seen in earlier dashboard testing), or genuine divergence. **This needs a dedicated, careful side-by-side read of both implementations — not a quick grep — and should be its own scoped task**, not bundled into a broader phase.

### P1-4 — Accessibility: NOT VERIFIED
Unchanged from the prior audit. Needs a live pass (axe or equivalent, plus manual keyboard/screen-reader spot checks) — genuinely requires a browser, not just code reading.

### P1-5 — Performance: NOT VERIFIED
Unchanged from the prior audit. Lowest priority of the open items — no evidence of an acute problem, just unmeasured.

---

## Recommended Implementation Sequence

1. **P0-2's open sub-question first, before writing any new code:** trace the exact `resolve-account-change` "reuse existing workspace" branch in `backend/src/routes/drive.routes.ts` to confirm it cannot silently merge into unrelated pre-existing Drive data. This is pure investigation, zero risk, and could surface a real defect cheaply.
2. **P0-3's trace:** read `services/drive/dataService.ts`'s write-failure handling for quota-exceeded specifically, confirm `MutationOutcome` correctness. Also investigation-only.
3. **Design and build the staged migration flow** (P0-1 and P0-2 together, since they share the same validate→stage→write→verify→promote→preserve-source pattern) — this is the largest remaining engineering task and should be its own dedicated, carefully-scoped phase with disposable-account testing throughout, not rushed alongside anything else.
4. **P1-3 formula-parity trace** — can happen in parallel with step 3 by a separate thread of work, since it doesn't touch migration code at all.
5. **Real iOS Safari verification** — independent of all of the above; do this whenever real-device access becomes available, per your existing plan.
6. **P1-4 accessibility and P1-5 performance passes** — lowest urgency, schedule after the P0 items are closed.

## What Should Be Completed Before the Next Git Commit/Push

Given nothing has been committed yet across this entire effort, and the working tree currently mixes (a) fully-verified, safe, ready hardening work (auth secrets, AUTH_* catalog, IDOR fixes-that-turned-out-unnecessary, same-site domain migration) with (b) still-open P0 migration-safety gaps that are **not yet exposed to users in a dangerous way** (confirmed above — the Drive-account-reuse branch is the only live open question, and the Local→Drive button is presently a safe no-op, not a broken migration):

- **Safe to commit/push now, if you choose:** the auth hardening (JWT/cookie fail-fast, AUTH_* catalog), the IDOR audit's conclusion (no code changes were needed there), and the same-site API domain migration's env-var/config changes (once you're ready to also commit the Vercel/Render side, which is already live per your report). These are independently verified, tested, and don't depend on the P0 migration work at all.
- **Should NOT wait on:** P0-1 (Local→Drive) — it's a stub/no-op today, not a landmine; committing the current state doesn't ship a broken migration, it ships a "switch mode" button that does nothing destructive.
- **Should be resolved before commit, specifically:** the P0-2 "reuse existing workspace" trace (step 1 above) — this is the one place a real, already-shipped code path could theoretically have a data-safety question, and it's cheap (read-only) to close out before locking in this baseline.
- **Recommend NOT bundling** the (as-yet unbuilt) staged migration feature into this same commit/push cycle at all — per your own instruction, it should be "implemented as its own controlled phase," which argues for landing the already-verified security/domain work first as its own clean commit, then tackling migration as a separate follow-up branch of work.

---

### Database
No changes. No migrations run.

### Git
No commit. No push. No deploy.
