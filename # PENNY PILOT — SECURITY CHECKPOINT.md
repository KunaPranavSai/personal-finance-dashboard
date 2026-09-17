# PENNY PILOT — SECURITY CHECKPOINT + iOS AUTH RELIABILITY MASTER PROMPT

You are continuing work on the Penny Pilot codebase.

IMPORTANT: Work continuously through this task. Do not stop after every small step for confirmation.

However, there are explicit safety checkpoints:
- DO NOT run destructive database commands.
- DO NOT run `prisma migrate reset`.
- DO NOT run `prisma db push` against production/shared databases.
- DO NOT delete/truncate production data.
- DO NOT bypass Prisma migration tracking.
- DO NOT implement Local↔Google Drive migrations in this task.
- DO NOT modify migration architecture/endpoints.
- DO NOT commit.
- DO NOT push.
- DO NOT deploy.
- DO NOT rotate or print any secrets.
- DO NOT expose tokens, cookies, passwords, API keys, JWTs, OTPs, or OAuth credentials in logs/reports.
- DO NOT weaken HttpOnly, Secure, SameSite, CORS, CSRF, OAuth-state, or authentication protections to "fix" iOS.
- Do not rewrite the authentication architecture unnecessarily.

Your job is to:
1. Apply the already-reviewed JWT/cookie secret fail-fast security fix.
2. Add the remaining AUTH_* error-code handling without weakening security.
3. Thoroughly diagnose the iOS/Safari signup/login issue.
4. Fix the actual root cause(s).
5. Verify signup, login, session persistence, logout, forgot-password/recovery, and post-signup routing.
6. Perform regression checks.
7. Produce a detailed report.
8. Leave all migration work untouched.

==================================================
PHASE 0 — READ THE CURRENT STATE FIRST
==================================================

Before modifying anything:

Read and understand:
- Penny-Pilot-Master-Implementation-Plan.md if available in the repository.
- Current git status.
- Current auth routes.
- Auth middleware.
- AuthContext.
- login page.
- signup page.
- forgot-password/recovery flow.
- cookie/session implementation.
- CORS configuration.
- frontend API client.
- error normalization/errorActions.
- environment variable validation.
- any existing auth/security tests.
- recent recovery implementation.

Also inspect the previous implementation/report if available.

Do NOT assume the previous report is correct without checking the current code.

Create an internal checklist of:
- current auth architecture
- signup sequence
- login sequence
- session creation
- cookie creation
- frontend credential handling
- signup redirect behavior
- error propagation
- recovery flow
- iOS/Safari-sensitive behavior

Do not change code during this initial inspection unless required to run harmless read-only diagnostics.

==================================================
PHASE 1 — APPLY JWT/COOKIE SECRET FAIL-FAST FIX
==================================================

The previous audit identified hardcoded fallback secrets.

Apply the prepared safe fix:

backend/src/lib/tokens.ts

Replace:

ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "pfd-access-secret"
REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "pfd-refresh-secret"

with a fail-fast environment-secret requirement equivalent to:

function requireSecret(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not set — refusing to start with a default JWT secret.`
    );
  }

  return value;
}

export const ACCESS_SECRET = requireSecret("JWT_ACCESS_SECRET");
export const REFRESH_SECRET = requireSecret("JWT_REFRESH_SECRET");

backend/src/app.ts

Replace the COOKIE_SECRET fallback:

process.env.COOKIE_SECRET ?? "pfd-cookie-secret"

with fail-fast validation equivalent to:

const COOKIE_SECRET = process.env.COOKIE_SECRET;

if (!COOKIE_SECRET) {
  throw new Error(
    "COOKIE_SECRET is not set — refusing to start with a default cookie secret."
  );
}

Do NOT print the secret values.

Verify:
- local environment already contains the required variables.
- backend typecheck passes.
- application starts successfully when required variables are present.

Do NOT alter the actual secret values.

If production/staging environment variables cannot be verified without exposing secrets:
- do not expose them;
- report only whether presence could/could not be verified.

==================================================
PHASE 2 — COMPLETE AUTH ERROR CODES
==================================================

Inspect the existing error-code catalog and implementation.

Add/use the remaining appropriate authentication codes:

AUTH_REQUIRED
AUTH_INVALID
AUTH_EXPIRED
AUTH_FORBIDDEN
AUTH_RATE_LIMITED

Use the project's existing structured error contract.

Do NOT blindly change every authentication failure into a different code.

Map errors according to actual semantics.

Examples:

Unauthenticated request:
AUTH_REQUIRED

Invalid credentials:
AUTH_INVALID

Expired authentication/session:
AUTH_EXPIRED

Authenticated but insufficient permissions:
AUTH_FORBIDDEN

Authentication endpoint rate limit:
AUTH_RATE_LIMITED

Important:
- Preserve anti-enumeration behavior.
- Do not reveal whether an email/account exists where the existing recovery flow intentionally avoids enumeration.
- Do not expose internal Prisma/database/auth implementation details to users.
- Do not include secrets/tokens in errors.
- Keep request IDs where the existing architecture supports them.

Update frontend error handling/actions where appropriate.

Do not invent unnecessary error codes.

==================================================
PHASE 3 — INVESTIGATE THE iOS/SAFARI AUTH BUG
==================================================

This is the highest-priority functional investigation.

The reported symptoms are:

A) Some iOS users could not create an account or log in.

B) In some signup attempts:
- account creation appeared successful;
- user was redirected to the sign-in page;
- no error was displayed;
- no warning was displayed;
- the user could not tell whether signup succeeded.

Do NOT assume the cause is Safari cookies.

Determine the actual failure point.

Investigate the complete sequence:

SIGNUP

Frontend:
Signup form
→ validation
→ POST signup
→ backend response
→ cookie/session response if applicable
→ AuthContext state update
→ storage/onboarding initialization
→ routing decision
→ destination page

LOGIN

Login form
→ POST login
→ Set-Cookie
→ frontend credentials handling
→ `/me` or equivalent session validation
→ AuthContext state
→ redirect

==================================================
PHASE 4 — iOS/WEBKIT-SPECIFIC AUTH AUDIT
==================================================

Inspect actual browser/network behavior.

Pay particular attention to:

1. fetch/axios configuration

Verify all authenticated cross-origin requests correctly use credentials.

For fetch this generally means:

credentials: "include"

where required.

Do not add credentials blindly to every request if the existing API client centralizes this.

2. CORS

Frontend:
Vercel/domain

Backend:
Render/domain

Verify:
- explicit allowed origins
- credentials: true
- no wildcard origin with credentials
- OPTIONS/preflight behavior
- allowed methods
- allowed headers
- origin handling
- production domain handling

3. Cookies

Inspect every auth/session cookie.

Verify:
- HttpOnly where appropriate
- Secure in production
- correct SameSite behavior
- correct Path
- appropriate Max-Age/Expires
- no accidental Domain mismatch
- no duplicate/conflicting cookies
- no incorrect host-only/domain assumptions
- no cookies accidentally scoped only to a development domain

IMPORTANT:

Because frontend and backend are on different origins, carefully evaluate whether:

SameSite=None; Secure

is required for the current deployment architecture.

Do not weaken SameSite protections merely to make a test pass.

If SameSite=None is required, verify that CSRF/origin protections remain correct for every state-changing endpoint.

4. Cookie parsing/signing

Inspect:
- signed cookies
- cookie secret
- cookie verification
- malformed/expired cookie behavior

5. Safari/WebKit behavior

Look for assumptions that work in Chromium but can fail in Safari/iOS:
- third-party cookie assumptions
- cross-site cookie restrictions
- storage partitioning
- localStorage/sessionStorage assumptions
- IndexedDB initialization timing
- redirect immediately after cookie-setting response
- request immediately after signup
- frontend state initialized before navigation
- unsupported browser APIs
- timing/race conditions

Do NOT disable security controls to accommodate Safari.

6. IndexedDB

Because Penny Pilot supports Local mode, inspect whether signup/login routing can race with:
- IndexedDB creation
- object-store upgrades
- local-mode initialization
- onboarding initialization

Verify DB version 2 and all required stores.

Do not regress the recently fixed IndexedDB upgrade.

==================================================
PHASE 5 — REPRODUCE THE SIGNUP BUG
==================================================

Use available browser/dev tooling if possible.

Test at minimum:

DESKTOP:
- Chromium
- Safari/WebKit if available

MOBILE:
- iOS/WebKit environment if available

If actual iOS hardware/browser testing is unavailable, explicitly say:

"iOS hardware/WebKit behavior could not be directly verified."

Do not claim iOS verification without actually testing it.

For every signup test record only safe information:

- HTTP status
- endpoint
- response success/failure
- whether Set-Cookie was present
- whether frontend considered request successful
- whether session was established
- redirect destination
- visible user message

NEVER log:
- cookie value
- JWT
- refresh token
- password
- OTP
- recovery token
- API key

==================================================
PHASE 6 — DETERMINE THE INTENDED SIGNUP BEHAVIOR
==================================================

Inspect the current product architecture and determine whether signup is intended to:

A) automatically authenticate the user and continue onboarding

OR

B) create the account and require manual login.

Do not arbitrarily redesign this.

If current intended behavior is unclear, use the existing implementation/product flow and document the conclusion.

Whatever behavior is intended, it must be explicit to the user.

There must NEVER be a silent:

Signup success
→ redirect to Sign In
→ no explanation

state.

==================================================
PHASE 7 — FIX POST-SIGNUP UX
==================================================

Implement explicit state handling.

At minimum, handle:

1. SIGNUP_SUCCESS + AUTO_LOGIN

Continue into authenticated onboarding/dashboard/local-vs-drive storage selection as intended.

2. SIGNUP_SUCCESS + MANUAL_LOGIN

Show a clear message such as:

"Account created successfully. Please sign in using your email and password."

Then navigate to Sign In.

3. SIGNUP_FAILED

Stay on signup and show a safe, actionable error.

4. SIGNUP_NETWORK_FAILURE

Do NOT blindly retry account creation.

Show:

"We couldn't confirm whether your account was created. Please check your email or try signing in before submitting signup again."

This is especially important because signup is a state-changing operation.

5. SIGNUP_RESPONSE_SUCCESS_BUT_SESSION_NOT_ESTABLISHED

Do not silently redirect.

Give the user a clear next action consistent with the actual product flow.

Do not accidentally create duplicate accounts by automatically resubmitting.

==================================================
PHASE 8 — AUTHCONTEXT / ROUTING RACE AUDIT
==================================================

Inspect AuthContext and all auth-protected routing.

Look specifically for:

- signup sets cookie but frontend navigates before auth state updates
- login sets cookie but `/me` executes too early
- stale `isAuthenticated` state
- loading state incorrectly treated as unauthenticated
- redirect to `/signin` while auth initialization is still running
- router navigation before session validation
- duplicate auth initialization
- React effect race conditions
- Safari timing differences
- errors swallowed inside try/catch
- `.catch()` handlers that navigate without displaying errors
- redirects triggered by stale auth state
- API errors converted into generic navigation
- failed session refresh silently causing sign-in redirect

The correct pattern should distinguish:

loading
authenticated
unauthenticated
error

Do not use:

"not authenticated yet"

as equivalent to:

"definitely unauthenticated"

while initialization is still running.

==================================================
PHASE 9 — API CLIENT AUDIT
==================================================

Inspect frontend/src/lib/api.ts and related request helpers.

Ensure:

- credentials are included correctly
- non-2xx responses are not silently ignored
- JSON errors are parsed safely
- empty/non-JSON responses are handled
- network errors are classified correctly
- timeout handling does not incorrectly claim signup failure/success
- 401 handling does not create redirect loops
- 403 is distinguished appropriately
- request IDs are preserved/displayed where intended
- no sensitive response body is logged

For signup specifically, make sure a successful HTTP response cannot be accidentally interpreted as failure because of:
- unexpected response shape
- empty response
- cookie-only response
- JSON parsing failure
- Safari-specific behavior

==================================================
PHASE 10 — LOGIN FLOW REGRESSION
==================================================

Test:

1. New account signup.
2. Manual logout.
3. Email + password login.
4. Wrong password.
5. Unknown email.
6. Session persistence after page reload.
7. Session persistence after browser restart where applicable.
8. Expired/invalid session.
9. Logout.
10. Login again.
11. Existing recovery flow.
12. Recovery followed by login.
13. Local-only onboarding.
14. Google Drive onboarding where available.

For all failure cases, verify the UI gives a useful message.

Do not leak account existence through error messages.

==================================================
PHASE 11 — ACCOUNT RECOVERY REGRESSION
==================================================

Do NOT rewrite the recovery system.

Verify the current choice-based flow remains intact:

Forgot Password
→ Enter Email
→ Choose ONE:
   Email OTP
   Authenticator
   Security Questions
→ Verify selected method
→ New password
→ Done

Verify:

- recovery token is never returned in JSON
- token remains HttpOnly cookie-based
- Secure in production
- appropriate SameSite
- correct Path
- short expiration
- single use
- session invalidation
- OTP attempt limits
- TOTP attempt limits
- security answer hashing
- anti-enumeration
- no legacy reset-password bypass
- UID is not required for recovery/login

Do not expose any token in logs.

==================================================
PHASE 12 — MOBILE UX AUDIT
==================================================

Inspect signup/login/recovery specifically at mobile widths.

Check:
- form fields
- password visibility controls
- validation messages
- buttons
- loading states
- error messages
- keyboard overlap
- scrolling
- focus behavior
- safe-area behavior
- modal behavior
- redirect messaging

Do not perform a broad UI redesign.

Only fix issues directly related to authentication usability/reliability.

==================================================
PHASE 13 — TESTS
==================================================

Run appropriate safe tests.

At minimum:

Backend:
- typecheck
- lint if configured
- relevant auth tests
- build

Frontend:
- typecheck
- lint
- build

Behavioral:
- signup
- login
- logout
- session persistence
- recovery
- local onboarding
- post-signup routing

Do NOT run destructive DB tests.

If a test requires a database:
- use an explicitly safe test/development database/environment;
- never reset production/shared production data.

==================================================
PHASE 14 — DATABASE SAFETY
==================================================

Do NOT create a Prisma migration unless absolutely required.

This task should preferably require NO PostgreSQL schema change.

If you discover that a migration is genuinely required:

STOP BEFORE APPLYING IT.

Show:
- exact migration SQL
- affected tables
- why it is necessary
- whether it is additive/destructive
- expected production impact

Then wait for approval.

Do not run:
- prisma migrate reset
- prisma db push against production
- destructive SQL
- manual migration-history bypass

==================================================
PHASE 15 — SECURITY REVIEW
==================================================

Before finishing, verify that the fixes did NOT introduce:

- token storage in localStorage
- token storage in sessionStorage
- tokens in URL
- token logging
- password logging
- OTP logging
- weakened cookie flags
- wildcard CORS
- disabled CSRF/origin protection
- authentication bypass
- duplicate signup behavior
- open redirect
- account enumeration
- recovery bypass

If any security concern is discovered, fix it if safely in scope.

==================================================
PHASE 16 — GIT SAFETY
==================================================

At the end run:

git status
git diff --stat
git diff

Do not:
- commit
- push
- merge
- reset
- revert unrelated work
- delete unrelated untracked files

Preserve all existing recovery, StorageProvider, Analytics, Reports, and IndexedDB work.

==================================================
PHASE 17 — FINAL REPORT
==================================================

Create/update a report:

Penny-Pilot-Auth-iOS-Fix-Report.md

Include:

1. Executive summary
2. Root cause(s) discovered
3. JWT/cookie secret fallback fix
4. AUTH error-code changes
5. Signup flow findings
6. Login flow findings
7. iOS/Safari findings
8. Cookie/CORS findings
9. AuthContext/routing findings
10. API-client findings
11. Recovery regression results
12. Local-mode regression results
13. Exact files changed
14. Tests executed
15. Browser/device environments actually tested
16. What was NOT possible to verify
17. Security considerations
18. Database status
19. Git status
20. Remaining issues

Use honest status labels:

VERIFIED
PARTIALLY VERIFIED
NOT VERIFIED
NOT APPLICABLE

Do not claim "iOS fixed" unless an actual iOS/WebKit reproduction or a technically conclusive root cause plus equivalent verification supports that statement.

==================================================
FINAL RESPONSE FORMAT
==================================================

Return a concise but complete report containing:

### Completed
- ...

### Root Cause
- ...

### iOS/Safari Findings
- ...

### Signup UX Fix
- ...

### Security Fix
- ...

### Tests
- ...

### Database
- ...

### Git
- ...

### Remaining Issues
- ...

### Deployment Readiness
State exactly what remains before deployment.

IMPORTANT:
Do not deploy.
Do not commit.
Do not push.

STOP after the report.