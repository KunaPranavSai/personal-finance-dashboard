# Penny Pilot — Commit 611ca91 CI/Vercel Failure Diagnosis

Date: 2026-09-16
Scope: Read-only diagnosis of the GitHub Actions and Vercel failures triggered by commit `611ca91341d7047adcab25617b296aa7c04e5e59` on `main`. **No files modified, no commits, no pushes, no redeploys, no Vercel/Render/environment/database changes.**

---

## 1. Exact GitHub Actions Frontend Failure

**Run:** `35082290841` ("CI", triggered by push, commit `611ca91`)
**Job:** `frontend` — failed at step **"Run npm run typecheck"** (32s into the job; the subsequent `npm run build` step never ran — `tsc --noEmit` failing aborted the job before build was attempted). The `backend` job in the same run **succeeded**.

**Exact failing command:** `npm run typecheck` → `tsc --noEmit`

**Exact error output** (retrieved via `gh run view 35082290841 --log-failed`):

```
src/app/(app)/bills/page.tsx(11,52): error TS2307: Cannot find module '@/lib/storage' or its corresponding type declarations.
src/app/(app)/goals/page.tsx(10,52): error TS2307: Cannot find module '@/lib/storage' or its corresponding type declarations.
src/app/(app)/investments/page.tsx(12,52): error TS2307: Cannot find module '@/lib/storage' or its corresponding type declarations.
src/app/(app)/investments/page.tsx(13,35): error TS2307: Cannot find module '@/lib/errorActions' or its corresponding type declarations.
src/components/budget/BudgetFormModal.tsx(13,32): error TS2307: Cannot find module '@/lib/storage' or its corresponding type declarations.
src/components/budget/BudgetFormModal.tsx(14,35): error TS2307: Cannot find module '@/lib/services/budgetsService' or its corresponding type declarations.
src/components/mobile/AddTransactionSheet.tsx(6,32): error TS2307: Cannot find module '@/lib/storage' or its corresponding type declarations.
src/components/mobile/AddTransactionSheet.tsx(7,40): error TS2307: Cannot find module '@/lib/services/transactionsService' or its corresponding type declarations.
src/components/mobile/AddTransactionSheet.tsx(11,29): error TS2307: Cannot find module './MobileSheet' or its corresponding type declarations.
src/components/transactions/TransactionFormModal.tsx(8,52): error TS2307: Cannot find module '@/lib/storage' or its corresponding type declarations.
src/components/transactions/TransactionFormModal.tsx(9,64): error TS2307: Cannot find module '@/lib/services/transactionsService' or its corresponding type declarations.
src/lib/storage/localStorageProvider.ts(2,94): error TS2307: Cannot find module './localDb' or its corresponding type declarations.
Process completed with exit code 2.
```

Plus a large number of secondary `TS7006: Parameter '...' implicitly has an 'any' type` errors in the same files (`bills/page.tsx`, `goals/page.tsx`, `investments/page.tsx`) and two `TS2554: Expected 1-2 arguments, but got 3` errors in `investments/page.tsx` at the `getRecoveryAction(...)` call sites.

## 2. Exact Vercel Failure

GitHub's commit-status API shows a `Vercel` status of `failure` on `611ca91`, description: *"Deployment has failed — run this Vercel CLI command: `npx vercel inspect dpl_DGLQS9EJh3hm9jbsbWtbmRnfVYKc --logs`"*, linking to `https://vercel.com/raghusai/personal-finance-dashboard/DGLQS9EJh3hm9jbsbWtbmRnfVYKc`.

**NOT VERIFIED — exact Vercel build log content.** No Vercel CLI, API token, or authenticated dashboard session was available in this environment (checked: no `vercel` binary installed, no `VERCEL_*` env vars, no `.vercel` config on disk; the browser session was not logged into Vercel — confirmed by navigating to the deployment URL, which redirected to Vercel's login page). I could not read Vercel's actual build log text and am not claiming to have done so.

## 3. Are the GitHub CI failure and the Vercel failure the same root cause?

**Highly likely the same root cause, but NOT independently confirmed via Vercel's own log text** (see above). Reasoning: Vercel's standard Next.js build pipeline runs `next build`, which — unless explicitly disabled in `next.config.ts` (checked: it is not disabled here; no `typescript: { ignoreBuildErrors: true }` or `eslint: { ignoreDuringBuilds: true }` is set in `frontend/next.config.ts`) — performs the same TypeScript type-checking pass over the same committed file set from the identical commit SHA (`611ca91`). Since the missing modules (`@/lib/storage`, `@/lib/errorActions`, `@/lib/services/*`, `./MobileSheet`, `./localDb`) simply do not exist anywhere in that commit's git tree (verified directly, see §6), any build process checking out this exact commit — GitHub Actions or Vercel — would hit the identical unresolvable imports. This is a strong inference from a verified fact (the files are absent from the commit), not a guess from the failure status message alone, but it stops short of "verified" because I did not read Vercel's actual log output.

## 4. Comparison with the Previously-Verified Successful Production Deployment

The desktop/mobile browser testing done earlier in this engagement (login, session-fix verification, IDOR testing, etc.) was run against **the local dev server** (`localhost:3000`/`localhost:4000`), not against a from-scratch `git clone` + `npm ci` + `next build`. Local dev's `next dev` and local `tsc --noEmit` runs (also done earlier, and reported as passing) all read from the **working-tree filesystem**, which has always contained every file involved here (`storage/index.ts`, `errorActions.ts`, `services/*`, `MobileSheet.tsx`, `localDb.ts`) — they were simply never `git add`ed. TypeScript and Next.js resolve modules by reading the filesystem, not by consulting git — so every local typecheck/build/lint/dev-server check performed throughout this whole engagement (all reported "PASS" in prior reports) was **genuinely accurate for the working tree**, but **could not have caught this class of bug**, because the bug is specifically "a file needed for compilation was never committed" — invisible to any check that runs against the working directory rather than a fresh checkout of the commit.

## 5. Root Cause Classification

| Candidate cause | Verdict |
|---|---|
| TypeScript error (genuine type mismatch in the new code) | **Partially — see below.** The `TS2307` "Cannot find module" errors are not type mismatches; they're missing files. The `TS7006`/`TS2554` errors are very likely cascading consequences of the same missing modules (when an import can't be resolved, TypeScript's inference for dependent code degrades, e.g. array callback parameters lose their inferred element type) — this explains why these specific pre-existing files/lines were never flagged in any of this session's many prior clean local typecheck runs. **NOT VERIFIED** as strictly cascading (a truly independent secondary bug in these exact lines, coincidentally never seen before, can't be fully ruled out without fixing the missing-module errors first and re-checking), but it is the far more probable explanation given zero prior local-check failures on these exact files across many earlier passes this session. |
| ESLint | **Not the cause.** The job failed at the `typecheck` step; `lint`/`build` never ran. |
| Next.js build | **Not directly** — the CI `build` step never got a chance to run (the job aborted after `typecheck` failed). Vercel's build likely fails during its own equivalent `next build` type-checking phase, per §3. |
| **Missing environment variable** | **Not the cause.** All errors are TypeScript module-resolution errors, not runtime/config errors; none of the failing lines relate to `process.env` access. |
| **Dependency/install issue** | **Not the cause.** `npm install` succeeded (visible as a green step before `typecheck` in the job log); this isn't a missing-package error (`TS2307` for `@/lib/storage` etc. are path-alias/local-file resolution failures, not `node_modules` package failures). |
| **Generated files** | Not applicable — none of the missing files are generated artifacts (they're hand-written application source: a storage-provider barrel, an error-action helper, two domain services, a mobile sheet component, and a local-IndexedDB wrapper). |
| **Repository relocation** ("This repository moved" notice from the prior push) | **Not the cause.** The push itself succeeded and CI ran against the correct commit; the relocation notice is cosmetic (GitHub redirecting the old remote URL) and unrelated to the build failure. |
| **Vercel configuration** | **NOT VERIFIED** either way — no access to Vercel's project settings or build log in this session. Given the shared root cause is highly likely per §3, a Vercel-configuration-specific cause (e.g. a different Node version, a missing Vercel env var) is possible but has no supporting evidence and isn't the more probable explanation. |
| **Unrelated pre-existing issue** | **Not the cause.** These exact files/imports were introduced or newly referenced by the changes committed in `611ca91` itself (see §6) — this is not a latent bug that predates the commit. |
| **Missing files never committed (scope/staging error)** | **THIS IS THE CONFIRMED ROOT CAUSE.** See §6. |

## 6. Does commit 611ca91 itself contain something that causes this?

**Yes — confirmed directly, not inferred.** Ran `git show 611ca91:<path>` for each missing module against the actual commit object:

```
git show 611ca91:frontend/src/lib/errorActions.ts
  → fatal: path 'frontend/src/lib/errorActions.ts' exists on disk, but not in '611ca91'
git show 611ca91:frontend/src/lib/storage/index.ts
  → fatal: path 'frontend/src/lib/storage/index.ts' exists on disk, but not in '611ca91'
git show 611ca91:frontend/src/lib/services/transactionsService.ts
  → fatal: path 'frontend/src/lib/services/transactionsService.ts' exists on disk, but not in '611ca91'
git show 611ca91:frontend/src/components/mobile/MobileSheet.tsx
  → fatal: path 'frontend/src/components/mobile/MobileSheet.tsx' exists on disk, but not in '611ca91'
git show 611ca91:frontend/src/lib/storage/localDb.ts
  → fatal: path 'frontend/src/lib/storage/localDb.ts' exists on disk, but not in '611ca91'
```

Every one of these files "exists on disk, but not in `611ca91`" — i.e. they are real, present, correct files in the local working tree (and were read/verified as such throughout every prior phase of this engagement), but **were never `git add`ed in this repository's history at all**, in this commit or any before it.

**How this happened:** the Drive-safety commit was deliberately scoped to exactly 17 files (`frontend/src/lib/storage/types.ts`, `driveStorageProvider.ts`, `localStorageProvider.ts`, plus the six form components, etc. — see the prior commit-review/verification reports). That scoping correctly excluded unrelated pre-existing work — but three of the files it *did* include have hard `import` dependencies on sibling files that were left out as "not part of this fix's scope":
- `localStorageProvider.ts` (committed) imports `./localDb` (not committed).
- `bills/page.tsx`, `goals/page.tsx`, `investments/page.tsx`, `BudgetFormModal.tsx`, `TransactionFormModal.tsx`, `AddTransactionSheet.tsx` (all committed, all modified by this phase to add local-storage-mode branches and idempotency wiring) import `@/lib/storage` (the barrel `index.ts`, not committed), and several also import `@/lib/errorActions`, `@/lib/services/transactionsService`, `@/lib/services/budgetsService`, and `./MobileSheet` (none committed).

The scoping review treated these as "pre-existing, unrelated, earlier-phase files" (correct in the sense that their *content* wasn't written by the Drive-safety phase) but failed to account for the fact that the Drive-safety commit's own files **cannot compile without them**. This is a genuine gap in the pre-commit review's file-selection logic, not a defect in the Drive-safety logic itself — every line of actual idempotency/workspace-safety code reviewed and tested in prior phases remains correct; the commit is simply incomplete as a compilable unit.

## Production Impact

**VERIFIED: production is still serving the previous, working deployment — not affected by the failed build.**

- `https://www.pennypilot.pro` loads normally (confirmed via live browser navigation — renders the real app shell, not a Vercel error/failure page).
- `curl -I https://www.pennypilot.pro/` shows `X-Vercel-Cache: HIT` with `Age: 5161` (seconds) at the time of this check — i.e. the served response was cached roughly 86 minutes before this check, well before `611ca91` was pushed (~6 minutes before this check). This confirms the live traffic is being served from the prior successful deployment's cached output, not from any artifact of the failed build.
- This matches standard Vercel behavior: a failed deployment is never promoted to production; the previously-promoted deployment continues serving traffic untouched.

## Does 611ca91 need a code change?

**Yes.** The commit as pushed cannot pass a clean-checkout build (GitHub CI or Vercel) because it references files it doesn't include. No logic in the Drive-safety fix itself was found to be wrong — the fix needed is purely **additive**: commit the five missing dependency files (`frontend/src/lib/storage/index.ts`, `frontend/src/lib/storage/localDb.ts`, `frontend/src/lib/errorActions.ts`, `frontend/src/lib/services/transactionsService.ts`, `frontend/src/lib/services/budgetsService.ts`, `frontend/src/components/mobile/MobileSheet.tsx` — six files, one more than initially estimated once `budgetsService.ts` is included since `BudgetFormModal.tsx` imports it) that the already-committed files require. (This diagnosis does not implement that fix — you asked for diagnosis only.)

## Recommended Next Action

1. Identify the complete, exact set of files the 17 already-committed files transitively require (this diagnosis found six by reading the first-level `TS2307` errors directly; a full `tsc --noEmit` against a clean checkout — not the working tree — would be the most reliable way to confirm there are no further missing files beyond what surfaced here, since TypeScript may not report every downstream missing-file error until the ones already reported are resolved).
2. Stage and commit exactly those additional files (and no others) as a follow-up commit — do not amend `611ca91`, since it's already pushed and public.
3. Re-run `backend`/`frontend` typecheck, lint, and build **against a truly clean checkout** (not the current always-populated working tree) before pushing again, specifically to catch this class of "works locally, missing in git" issue in the future.
4. Push the follow-up commit; confirm GitHub Actions and Vercel both succeed on it.
5. No rollback of `611ca91` is necessary given production was never affected — but leaving `main` red (failing CI) longer than necessary isn't ideal either.

---

### Confirmed NOT Performed
No files modified. No commit. No push. No redeploy triggered. No Vercel/Render settings changed. No environment variables changed. No database access or modification.
