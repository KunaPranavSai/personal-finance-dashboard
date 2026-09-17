# Penny Pilot — P0 Drive Safety Trace

Date: 2026-09-16
Scope: Read-only code trace of the two remaining P0 investigations from `Penny-Pilot-Remaining-Audit-and-Implementation-Plan.md`. **No code was modified. No database/migration commands were run. No production writes/deletes performed. No environment changes. No commit/push/deploy.**

---

## TASK 1 — Drive account-change reuse safety

**Files traced in full:** `backend/src/routes/drive.routes.ts` (`/callback`, `/resolve-account-change`), `backend/src/services/drive/init.ts` (`setupWorkspace`, `migratePostgresDataToDrive`), `backend/src/services/drive/dataService.ts` (`initializeEmptyWorkspace`, `readMigrationMarker`, `markMigrationVerified`, `replaceCollectionWithContext`, `saveCollectionFile`).

### What happens when switching from Drive account A to Drive account B

1. `/callback` detects `accountChanged` by comparing the new OAuth token's `accountEmail` against the previously-stored one on the same `BackupConnection` row (same Penny Pilot `userId` throughout — this flow is always "this one Penny Pilot account switching which Google Drive it points at," never a different Penny Pilot account).
2. New tokens are saved to that row via `upsert` (`drive.routes.ts:123-143`) — `backupFolderId` is explicitly cleared when the account changed, which is what keeps `requireDriveConnected` blocking the app until setup actually completes.
3. `findExistingPennyPilotRoot(tokens.accessToken)` searches **Drive account B** (using the new OAuth token) for a folder the app previously created there. Because the Google `drive.file` scope only ever grants visibility into files *this app* created, this can only ever find a folder if some Penny Pilot connection — the current user's own past use of this account, or, in principle, a different Penny Pilot user who separately authorized this same Google account at some point — previously ran a setup against it.
4. If nothing is found → proceeds straight to `getOrCreatePennyPilotFolders` + `setupWorkspace`, i.e. **genuinely fresh, no ambiguity.**
5. If something is found → the callback stops and redirects with `accountChanged=1&choiceToken=...`; nothing is written yet. The frontend is expected to then call `POST /resolve-account-change` with the user's explicit choice.

### What happens if Drive B already contains Penny Pilot data

`resolve-account-change` (`drive.routes.ts:203-248`):
- `choice === "start_fresh"` → creates a **distinctly-named** new folder (`Penny Pilot (YYYY-MM-DD)`), never touches the existing one. **Verified safe** — old data in the existing folder is left completely alone.
- `choice === "use_existing"` → `rootId = pending.existingRootId` (the folder just found), then calls `setupWorkspace(userId, accessToken, rootId, accountEmail)`.

Inside `setupWorkspace` (`init.ts:292-332`), against that **existing** root:
1. `initializeEmptyWorkspace` — **confirmed non-destructive by its own logic** (`dataService.ts:409-450`): for each collection, `if (manifest.files[name]) continue` — it explicitly never overwrites anything already registered in the manifest. If a data file exists on disk but isn't in the manifest (a lost/corrupted manifest), it **adopts the existing file's content as-is** rather than replacing it. This step cannot destroy pre-existing collection data.
2. `readMigrationMarker` — checks `manifest.migrationCompletedAt`. **If present → `setupWorkspace` returns immediately** (`init.ts:299-302`), touching nothing further. This is the safe, expected path for a folder that was ever successfully set up before.
3. **If the marker is absent**, `migratePostgresDataToDrive` runs, which calls `replaceCollectionWithContext` for all 8 collections (`init.ts:241-250`) — this is a **wholesale replace, not a merge**, of every collection file's `records` array (`dataService.ts:462-475`), using the *currently authenticated Penny Pilot user's own Postgres data* (or, if that user has none, silently falls through to seeding default categories/accounts only — see `init.ts:304-312`).

### Whether existing Drive B data can be silently merged, overwritten, replaced, or deleted

**ISSUE FOUND — conditional, not unconditional.**

- **Not at all**, if the existing folder's manifest already carries a `migrationCompletedAt` marker (the normal state of any folder that was ever fully set up before) — confirmed safe, no-op.
- **Yes, silently replaced** (not merged — the entire `records` array is overwritten) if the marker is absent on an existing folder that nonetheless already contains real collection files. The code's own comment (`init.ts:280-286`) explicitly reasons this replay is "always safe" — but that reasoning is scoped to **the same user's own aborted first attempt** (Postgres is idempotent to re-read, so replaying *your own* migration twice is harmless). It does not account for the case where the pre-existing, unmarked folder holds **someone else's** data — which is possible in principle here specifically because `drive.file` visibility is tied to the Google account, not to which Penny Pilot login is asking: if two different Penny Pilot accounts were ever pointed at the *same* Google Drive account (e.g. a shared/reused Google account), and the first one's setup was interrupted before the marker was stamped, a second Penny Pilot user later connecting that same Google account and choosing "use existing" would silently overwrite the first user's records with their own.
- Missing-marker can also occur from an **out-of-band manifest loss** (user manually deletes `manifest.json` in Drive but leaves the collection files): `initializeEmptyWorkspace`'s corrupted/missing-manifest branch (`dataService.ts:424-426`) starts a **brand-new** manifest object with no `migrationCompletedAt` field at all, and then *adopts* the existing collection files into it (safe, per point 1 above) — but since the new manifest has no marker, `setupWorkspace` will still proceed to `migratePostgresDataToDrive`, which will overwrite `categories`, `accounts`, `paymentMethods`, `transactions`, `budgets`, `investments`, `bills`, and `goals` with the connecting user's own current Postgres data (or, for a Drive-native user with empty Postgres, only `categories`/`accounts` get replaced with fresh **default** taxonomy — silently discarding any custom categories that existed in the just-adopted file).

### Whether the user is explicitly warned/asked before any merge or replacement

**Partially.** The choice itself ("use existing" vs. "start fresh") is presented, satisfying the Master Plan §11 requirement to ask rather than silently merge. **But the user is never shown what's actually in the existing folder before choosing**, and — critically — **there is no warning that "use existing" can, in the missing-marker edge case above, replace rather than purely adopt the existing data.** The UI/API contract implies "use existing" means "keep using what's there," not "there's a chance this overwrites what's there." This is a genuine gap against the "explicit confirmation" language in Master Plan §10/§11.

### Whether Drive A data remains untouched

**VERIFIED SAFE.** No code path in `/callback` or `/resolve-account-change` issues any Google Drive API call against the *old* account's token or folder — only `BackupConnection.accessToken`/`refreshToken`/`accountEmail`/`backupFolderId` in Postgres are updated to point at the new account going forward. Drive A's files are never read, written, or deleted by this flow.

### Whether unrelated files/data in Drive B could be affected

**VERIFIED SAFE**, in the sense of "outside the Penny-Pilot-created folder tree." Every write in this flow is scoped to `dataFolderId`/`metadataFolderId` resolved under the specific `rootFolderId` in play (either the newly-created uniquely-named folder, or the located existing "Penny Pilot" folder) — nothing outside that folder tree is ever touched, confirmed via `findOrCreateFolder`'s folder-scoped queries throughout. The risk described above is confined to *within* an existing "Penny Pilot" folder, not to the rest of Drive B.

### Concrete safety issue identified

**Issue P0-2-A:** `setupWorkspace`'s missing-migration-marker fallback (designed for safe same-user retry) does not distinguish "this is my own interrupted attempt" from "this is a pre-existing, unmarked Penny Pilot folder that might belong to someone else's data or might have lost its own default categories via manifest corruption." In both of those latter cases, choosing "use existing" from `/resolve-account-change` can silently overwrite real collection data with no distinct warning beyond the generic reuse-vs-fresh choice.

**Required fix (not implemented in this pass):** Before calling `migratePostgresDataToDrive` inside `setupWorkspace` when reached via the "use existing" path specifically, check whether the located folder's collection files already contain any records (non-empty `records` arrays) despite the missing marker, and if so, either (a) require an additional explicit "this folder already has data in it — replacing it will overwrite those records, proceed?" confirmation before running the replace, or (b) default to *adopting* the existing records read-only (never replacing) whenever any are found, only running the Postgres-migration/seed path when every collection file is genuinely empty. Option (b) is the more conservative and Master-Plan-aligned fix, and doesn't require any new UI.

---

## TASK 2 — Drive quota failure / MutationOutcome safety

**Files traced in full:** `backend/src/services/drive/dataService.ts` (`saveCollectionFile`, `createRecord`, `withLock`), `backend/src/services/drive/googleDriveClient.ts` (`upsertFile`, `createFile`, `updateFileContent`), `backend/src/lib/driveErrors.ts` (`mapGoogleDriveError`), `backend/src/controllers/transactions.controller.ts` (representative create handler), `frontend/src/lib/storage/driveStorageProvider.ts` (`toOutcome`, `create`).

### How Google Drive quota-exceeded errors are detected

`mapGoogleDriveError` (`driveErrors.ts:28-35`) checks the Gaxios error's `reason === "storageQuotaExceeded"` **or** HTTP `status === 507`, and both `createFile`/`updateFileContent` in `googleDriveClient.ts` wrap their Google API calls in try/catch → `throw mapGoogleDriveError(err, "write")`. **VERIFIED SAFE** — every underlying Drive write call is covered, not just some.

### Whether `DRIVE_STORAGE_QUOTA_EXCEEDED` reaches the frontend correctly

**VERIFIED SAFE**, for the simple single-write-failure case: the `ApiError(507, ..., "DRIVE_STORAGE_QUOTA_EXCEEDED", "FREE_DRIVE_SPACE")` propagates unmodified through the route handler to `errorHandler.ts` (which forwards `err.code`/`err.action` verbatim in the JSON body — confirmed in an earlier audit phase), and `frontend/src/lib/errorActions.ts`'s `getRecoveryAction` switches on exactly this `code` to show "Manage Drive Storage." The `code` is preserved correctly regardless of the `MutationOutcome.status` classification bug below.

### Whether the mutation returns SUCCESS, FAILURE, or UNKNOWN — and whether this is always correct

**ISSUE FOUND — two distinct problems.**

**Issue P0-3-A (classification bug, minor):** `frontend/src/lib/storage/driveStorageProvider.ts:22-31`'s `toOutcome` classifies any `err.status >= 500` as `"unknown"` rather than `"failure"`. A `507` (used for quota-exceeded) satisfies `>= 500`, so a **definitively known** quota failure is classified as `"unknown"` instead of `"failure"` — the opposite of what it should be, since this is one of the *most* certain failure reasons in the whole error catalog, not an ambiguous one. Practical impact is limited (the `code`/`action` still flow through correctly, so the specific "Drive full" messaging and recovery button likely still render via `errorActions.ts`'s code-based switch, not the `MutationOutcome.status`), but any UI that branches on `status === "unknown"` specifically to show "we couldn't confirm whether this was saved, check before retrying" language would show that (technically-inaccurate-for-this-case, though not unsafe) message for a case where the honest answer is a clean "no, it wasn't saved."

**Issue P0-3-B (data-integrity bug, the significant one) — partial-write race in `saveCollectionFile`:**

`dataService.ts:162-174`'s `saveCollectionFile` performs **two sequential, independent Drive API writes**, not one atomic operation:
1. `upsertFile(...)` — writes the actual collection data file (the new/updated record content).
2. `saveManifest(...)` — writes the manifest file recording the new `fileId`/`dataVersion`/`checksum` for that collection.

**If step 1 succeeds and step 2 fails** (e.g. the account's Drive quota is exhausted by exactly the manifest write, having *just* had enough headroom for the data-file write, or any other transient failure between the two calls), the sequence throws out of `saveManifest` — the caller (a route like `POST /api/transactions`) receives a genuine `ApiError`, which correctly surfaces to the frontend as a failure/unknown outcome. **But the actual collection data file has already been durably written with the new record.** The write did not fail — only the bookkeeping step after it did.

This is confirmed by re-reading `loadCollectionFile`'s integrity check (`dataService.ts:129-160`): it validates a read file against **its own embedded checksum**, not against the manifest's separately-cached checksum — so the just-written (but not-yet-manifest-acknowledged) data file is fully self-consistent and would read back correctly on the *next* request, with the new record present, even though the immediately-preceding create call reported an error.

### Whether a partial write can occur

**Yes — confirmed above.** This is the core finding of this trace.

### Whether a quota failure can ever be incorrectly treated as success

Not observed in the direction of "reported success but actually failed" — every traced path either fully succeeds or throws. The risk runs the **other way**: a call that **actually persisted data** can be reported as a failure/unknown outcome, which is arguably worse for duplicate-prevention purposes than a false "success" would be, because it actively invites a retry.

### Whether retrying could duplicate a financial record

**Yes — confirmed as a real, currently-unmitigated risk.** The backend has an idempotency-key mechanism ready to prevent exactly this (`dataService.ts:181-186, 219-233` — `createRecord` accepts an optional `idempotencyKey` and returns the original cached record on a repeated key instead of creating a new one), and `backend/src/controllers/transactions.controller.ts:138-143` correctly reads an `Idempotency-Key` request header and passes it through when present. **However, a full grep of the entire frontend source tree (`frontend/src/**/*.ts*`) for `Idempotency-Key`, `idempotencyKey`, or any UUID-generation pattern that would populate it found zero matches.** The frontend never sends this header on any create call today. **The safety net that exists specifically to prevent this scenario is not currently connected to anything** — so if a create request hits the P0-3-B race (data written, manifest-step fails, user sees an error and clicks "Try Again"), the retry has no way to be recognized as "the same operation" and will create a second, duplicate record.

(Confirmed separately: no auto-retry exists anywhere in the traced frontend error-handling code — `errorActions.ts`'s `onRetry` is only ever invoked from an explicit user click on a "Try Again" button, never automatically. So this requires the user to actively retry after seeing an error, not a silent loop — real risk, but not a runaway-duplication scenario.)

### Whether any code change is actually required

**Yes**, to close P0-3-B specifically (the higher-severity finding). No code change was made in this pass, per your instructions.

**Required fix (not implemented):**
1. **Wire the frontend to actually send an `Idempotency-Key`** on every create call for Drive-backed financial records (generate a UUID client-side per create attempt, reuse the same key across retries of that same user-initiated action) — this alone would neutralize the duplicate-record risk from P0-3-B without touching the backend at all, since the plumbing already exists there and is unused.
2. Separately, consider making `saveCollectionFile`'s two writes closer to atomic in effect — e.g. writing the manifest update *before* invalidating any cache and treating a manifest-write failure after a successful data-file write as a distinguishable "your data was saved, but we couldn't fully confirm it — please verify" state (via `Settings → Data & Google Drive → Verify Data`, which already exists per `verifyStorageWithContext`) rather than a bare failure. This is a smaller, more surgical change than a true two-phase-commit and fits the existing architecture.
3. **Minor:** fix `toOutcome`'s `err.status >= 500` check to exclude `507` (or otherwise special-case known-certain error codes) so a quota failure is classified `"failure"`, not `"unknown"`, wherever calling code branches on that status field directly rather than on `code`.

None of these were implemented in this pass, per your explicit instruction.

---

## Recommendation

**3. Further investigation required** — specifically, and narrowly:

- **Task 1's finding (P0-2-A)** describes a real but low-likelihood-in-practice gap (requires an unmarked, non-empty existing Drive folder at reconnect time — the normal case is safe). It does not affect any code path a typical single-account user would ever hit today, and nothing in the currently-shipped `DataStorageCard.tsx` UI (confirmed in the prior audit) exposes an automated migration button that could trigger it unprompted — a user has to actively go through account-reconnection and choose "use existing" against a folder in this specific unmarked state.
- **Task 2's finding (P0-3-B)** is the more actionable one: a real, confirmed, currently-live gap in the *already-shipped* Drive write path (not a future migration feature) — the idempotency safety net exists on the backend but the frontend never uses it, on every single financial-record create today, in production, right now. This is arguably a distinct, standalone P0 the two "further investigation" tasks jointly surfaced, not just prep work for the future migration phase.

Given that distinction: **the already-verified security/domain-migration work (JWT/cookie fail-fast, AUTH_* catalog, IDOR conclusions, same-site API domain) remains safe to commit on its own, unrelated to either finding here.** Neither of these two findings blocks that commit — they're pre-existing conditions in the Drive write path and the not-yet-built migration feature, not regressions introduced by the security work. Whether to fix P0-3-B (frontend idempotency-key wiring) before or after that commit is a scoping choice, not a safety requirement of the commit itself — but given it's a small, self-contained, already-understood fix (send a header) that closes a real live gap, it may be worth doing as its own tiny follow-up commit before or shortly after, independent of the larger migration-feature phase.

---

### Database
No changes. No writes, reads that mutated state, or migrations performed.

### Git
No commit. No push. No deploy. No code modified.
