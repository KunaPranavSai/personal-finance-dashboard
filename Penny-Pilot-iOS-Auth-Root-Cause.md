# Penny Pilot — Real iOS Auth Failure Root-Cause Investigation

Date: 2026-09-16
Scope: Trace the production authentication cookie flow to identify exactly where it could fail on real iOS Safari.

## CRITICAL LIMITATION — READ FIRST

**No real iPhone, real Safari, or real WebKit engine was available in this environment**, and no real-device testing service (BrowserStack/Sauce Labs/etc.) credentials were provided. This investigation is **code-and-server-side trace only** — every finding below is either (a) an objective fact about what the production server actually sends/requires (verified directly against `https://www.pennypilot.pro` / the Render backend), or (b) a code-level fact about the frontend's request logic. **The one question this report cannot answer is the one that matters most: whether Safari's cookie jar actually stores and re-sends a `SameSite=None; Secure` cookie that was set by a `fetch()` POST (not a top-level navigation) to a cross-site API origin.** That requires an actual Safari/WebKit engine to observe. Nothing in this report should be read as confirming or ruling out that behavior.

## Reproduction

**Not performed on a real device** — not available. All reproduction below is against the real production endpoints directly (via `curl`, from this machine — not from a browser, and not from an iOS context), which proves the *server side* of the flow is well-formed, but proves nothing about how Safari's client-side cookie policy will treat it.

## Signup Flow

Not re-tested this phase (already verified in an earlier investigation, both via direct production `fetch()` and via code reading: signup creates the account and consent record only, never sets any cookie, and never auto-redirects — see `frontend/src/app/signup/page.tsx`, unchanged since that verification). Signup and login are architecturally independent; this report is entirely about what happens during **login** and the subsequent **session check**.

## Login Flow — Server-Side Trace

Direct request to the real production backend, `Origin: https://www.pennypilot.pro`:

```
POST /api/auth/login  →  200 OK
```

Response headers (values redacted, attributes only):

```
access-control-allow-credentials: true
access-control-allow-origin: https://www.pennypilot.pro
vary: Origin
Set-Cookie: access_token=<redacted>; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=None
Set-Cookie: refresh_token=<redacted>; Max-Age=604800; Path=/api/auth; HttpOnly; Secure; SameSite=None
```

Then, using a cookie jar that actually stored and resent those two cookies on the next request:

```
GET /api/auth/me  →  200 OK  →  {"user": {...}, "sessionExpiresAt": ...}
```

**This proves: if a client stores and resends the cookies exactly as issued, the backend round-trip is correct end-to-end.** This is the same conclusion reached in the earlier investigation phase via a real desktop Chrome test. It does **not** prove Safari will store and resend them — that's a client-side policy question, not a server-side one.

## Cookie Evidence

| Attribute | `access_token` | `refresh_token` |
|---|---|---|
| HttpOnly | yes | yes |
| Secure | yes | yes |
| SameSite | `None` | `None` |
| Path | `/` | `/api/auth` |
| Domain | **absent** (host-only, scoped to the Render backend's own hostname) | **absent** (same) |
| Max-Age | 3600s (1h) | 604800s (7d) |
| Signed (HMAC) | yes (`cookie-parser` signed cookie) | yes |

Source: `backend/src/lib/tokens.ts`'s `setTokenCookies` — `httpOnly: true`, `secure: IS_PROD`, `sameSite: IS_PROD ? "none" : "lax"`, no `domain` option set anywhere in the codebase (confirmed by reading the function in full — there is no `domain:` key at all, so Express/Node defaults to host-only, which is what the live response confirms).

**This is exactly the configuration `SameSite=None` requires** (`Secure` must be present, and per spec is enforced by both Chromium and WebKit — a `SameSite=None` cookie without `Secure` is silently rejected by both). Both are present. No issue found here.

## CORS Evidence

Verified directly against the live backend:
- `Origin: https://www.pennypilot.pro` → `Access-Control-Allow-Origin: https://www.pennypilot.pro` (exact echo, not `*`), `Access-Control-Allow-Credentials: true`. No wildcard-with-credentials misconfiguration.
- `Origin: https://pennypilot.pro` (non-www) on a preflight `OPTIONS` → also correctly allowed (`Access-Control-Allow-Origin: https://pennypilot.pro`), because `backend/src/app.ts`'s `ALLOWED_ORIGINS` is built from a comma-separated `APP_URL`/`FRONTEND_URL` env var that evidently includes both. Not a defect — just confirms both origin variants are covered.
- `vary: Origin` is present, which is the correct pattern for a per-origin-echoed CORS response (prevents cache poisoning across origins).

No CORS misconfiguration found.

## Fetch Credentials

Every fetch call site in the frontend that talks to the API was located and checked:

| File | Call | `credentials: "include"`? |
|---|---|---|
| `frontend/src/lib/api.ts:33` (silent refresh) | `fetch(/api/auth/refresh)` | yes |
| `frontend/src/lib/api.ts:52` (central `request()`, used by the `api.*` client and everywhere via `ApiClientError`) | `fetch(...)` | yes |
| `frontend/src/lib/AuthContext.tsx:147` (`apiFetch`, used by login/logout/refresh/me/2FA/passkeys directly) | `fetch(...)` | yes |
| `frontend/src/lib/consent.ts:43` | `fetch(/api/auth/consent/download)` | yes |
| `frontend/src/lib/offlineSync.ts:18` | `fetch(queued mutation)` | yes |
| `frontend/src/lib/export.ts:14` | `fetch(/api/export)` | yes |
| `frontend/src/app/(admin)/admin/settings/page.tsx:38` | `fetch(/api/admin/backup)` | yes |

**No bypass found.** Every single fetch call site to the API includes `credentials: "include"`. Login and `/me` both go through `AuthContext.tsx`'s `apiFetch`, which unconditionally sets it.

## Cookie Domain / Architecture

- Frontend origin: `https://www.pennypilot.pro` (Vercel)
- Backend origin: `https://personal-finance-dashboard-api-e3zf.onrender.com` (Render)
- These are different **registrable domains** (`pennypilot.pro` vs `onrender.com`) — this is a genuinely **cross-site** relationship, not merely cross-origin-same-site. This matters because:
  - Chromium and Safari agree on the definition of "site" (eTLD+1) for `SameSite` purposes, so both correctly classify this as cross-site.
  - The cookie is issued by, and scoped to, the **backend's own host** (`onrender.com` subdomain) — there is no attempt to share a cookie across the two different registrable domains via a `Domain=` attribute, which would be impossible here anyway (you cannot set a cookie's `Domain` to a different registrable domain than the one that set it; `Domain=.pennypilot.pro` would be rejected by the browser if set from an `onrender.com` response, since it's not a superdomain of the issuing host). **The architecture does not rely on a shared/broad cookie domain** — it relies purely on the browser attaching a host-scoped, `SameSite=None; Secure` cookie to credentialed cross-site requests. That is the standards-compliant way to do this, and is what both Chromium and Safari are supposed to support.

## Safari-Specific Conditions

**NOT VERIFIED — no device available.** None of the following could be tested: Safari normal vs. private mode, "Prevent Cross-Site Tracking" toggle, "Block All Cookies", content blockers, in-app browser/webview context (e.g. opening the link from Mail/Messages/Instagram in-app), Wi-Fi vs. mobile data, or whether visiting the backend origin directly first changes behavior.

## AuthContext Behavior

Reviewed in a prior phase and unchanged since: `login()` calls `setUser(data.user)` directly from the login response body (does not independently verify the cookie was persisted via its own follow-up call), and `restore()` (which runs on every fresh page load / new `AuthProvider` mount) is the only thing that independently confirms a session via `GET /api/auth/me`. This is exactly the gap the earlier "silent redirect" fix addressed — it made the *symptom* (silent bounce to `/login` with no explanation) honest, but it cannot and does not change *whether* Safari actually keeps the cookie in the first place. If Safari drops the cookie, the user will now see: *"You signed in, but your browser didn't keep you signed in..."* instead of nothing — which is exactly why you now have the more specific report that the underlying problem persists, rather than just silence.

## Backend Behavior

No backend defect found. Cookie attributes are correct for the cross-site case (`HttpOnly`, `Secure`, `SameSite=None`), CORS is correctly scoped (no wildcard, credentials allowed, origin echoed with `Vary: Origin`), and a client that does store/resend the cookies gets a working session end-to-end (verified live).

## Root Cause

**NOT DEFINITIVELY IDENTIFIED.** Everything on the server and in the frontend's request code is standards-correct for a cross-site, credentialed, `SameSite=None; Secure` cookie flow (Case A in the original investigation's decision tree — if a real device were tested and behaved correctly, that's what it would look like). The server-side evidence rules out several categories of bug outright:
- Not a CORS misconfiguration (verified: correct allowlist, no wildcard, credentials allowed).
- Not a missing `credentials: "include"` (verified: every fetch call site has it).
- Not a cookie missing `Secure`/`HttpOnly`/`SameSite=None` (verified: all three present on both cookies).
- Not a redirect silently dropping `Set-Cookie` (verified: login is a direct `fetch()` POST, no 3xx involved in the call itself).
- Not an origin mismatch (verified: both `www` and non-`www`, and `http`→`https`, all resolve/redirect consistently and are both in the CORS allowlist).

What remains unruled-out, because it can only be observed on a real device, is **WebKit's own cookie-acceptance policy for this exact pattern** — a `SameSite=None; Secure`, `HttpOnly` cookie set via a `fetch()` (not a top-level navigation) to a cross-site XHR-style API call. Safari's Intelligent Tracking Prevention has, at various points, applied stricter rules to cookies set this way (as opposed to cookies set via a full-page navigation/redirect to the third-party site first) — but Apple's exact current behavior, and whether it applies to this specific unclassified custom API domain, cannot be confirmed without observing it.

## Confidence

**LOW** on a specific root cause. **HIGH** confidence that the root cause, whatever it is, is **client-side (Safari/WebKit cookie policy)**, not a defect in this codebase's CORS, cookie attributes, or fetch implementation — those were all directly verified against production and found correct. But "the server-side is provably correct" is not the same as "I know what Safari is doing" — it only narrows the search space.

## Recommended Fix

**None yet — this phase intentionally does not implement one**, per your instruction. If real-device testing (once available) confirms Safari is genuinely dropping or refusing to send the cookie despite the correct attributes, the standards-compliant next step to investigate (not yet decided, not yet implemented) would most likely be one of:
- Having the login response's cookie-setting happen in the context of a top-level navigation rather than purely a background `fetch()`, if WebKit is found to treat those differently for `SameSite=None` acceptance — this would be a flow change, not a security weakening, since `SameSite=None; Secure; HttpOnly` would remain unchanged.
- Confirming whether Safari's behavior differs between a "regular" tab and an in-app browser context (Mail/social-app webviews are known to have stricter cookie jars than Safari proper) — if the failure is isolated to in-app browsers, the fix is user guidance ("open in Safari"), not a code change.

Both of these require the missing real-device evidence before they can be responsibly chosen between — implementing either now would be exactly the kind of guess the investigation was explicitly told not to make.

## Alternatives Considered (and rejected, not implemented)

- **Weakening `SameSite` to `Lax` or `Strict`** — rejected outright: would break the cross-site architecture entirely (the cookie would never be sent from the Vercel frontend to the Render backend in the first place, for any browser), and was explicitly disallowed.
- **Wildcard/open CORS** — rejected: unnecessary (CORS is already correctly configured) and explicitly disallowed.
- **Setting a broad cookie `Domain`** — not applicable/not possible here: the frontend and backend are on different registrable domains, so no `Domain` attribute could ever make this cookie valid for both; this isn't a lever available in this architecture.
- **Moving tokens into `localStorage`/`sessionStorage`** — rejected outright: explicitly disallowed, and would reintroduce XSS-exfiltration risk for zero proven benefit, since the actual root cause hasn't been identified as "the browser can't do cookies here" — it may not be a cookie problem at all outside the specific fetch-vs-navigation nuance above.

## What Was NOT Verified

- Whether real iOS Safari actually stores/sends the login cookie (the central open question).
- Safari private mode / Prevent Cross-Site Tracking / Block All Cookies behavior.
- In-app browser (Mail/Messages/social apps) behavior.
- Wi-Fi vs. mobile data / carrier proxy behavior.
- Whether opening the backend origin directly in Safari first changes anything.
- Any of the above on Android/other mobile browsers (out of scope — this report is iOS-specific per your request).

## Database

No changes. No migrations. The only backend interaction this phase performed was reading responses from the live login/`me` endpoints using the pre-existing disposable diagnostic account (`ios.diagnostic.test.pp2026@gmail.com`, created and disclosed in an earlier phase) — no new accounts created, no data written beyond the session/lastLoginAt bookkeeping the login endpoint already performs on every normal login.

## Git

No commit. No push.

## Deployment

No deployment.
