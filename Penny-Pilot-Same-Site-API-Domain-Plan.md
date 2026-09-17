# Penny Pilot — Same-Site API Domain Plan

Date: 2026-09-16
Scope: Planning + code inventory only. **No code was changed. No DNS was changed. No Render configuration was changed. No commit/push/deploy.**

---

### Current Architecture

```
Frontend:  https://www.pennypilot.pro          (Vercel)
Backend:   https://personal-finance-dashboard-api-e3zf.onrender.com   (Render)
```

Different registrable domains (`pennypilot.pro` vs `onrender.com`) → genuinely **cross-site**. The auth cookies are `HttpOnly; Secure; SameSite=None`, host-only (no `Domain` attribute), and every frontend fetch call site uses `credentials: "include"`. CORS is correctly scoped (exact-origin echo, `Vary: Origin`, credentials allowed, no wildcard). All of this was verified directly against production in the prior investigation ([Penny-Pilot-iOS-Auth-Root-Cause.md](Penny-Pilot-iOS-Auth-Root-Cause.md)).

### Problem

Because the two origins are cross-site, the auth cookie is a third-party cookie from the browser's perspective. WebKit's tracking-prevention documentation confirms Safari applies stricter default handling to cross-site/third-party cookies than Chromium does. This is the one thing the prior investigation could not verify without a real device, and it remains the leading (though still unconfirmed) explanation for the reported iOS failures.

### Proposed Architecture

```
Frontend:  https://www.pennypilot.pro          (Vercel, unchanged)
Backend:   https://api.pennypilot.pro          (Render, same service, new custom domain)
```

### Why Same-Site Helps

`www.pennypilot.pro` and `api.pennypilot.pro` share the registrable domain `pennypilot.pro`. Per the Public Suffix List–based "site" definition both Chromium and WebKit use, subdomains of the same registrable domain are **same-site** (even though they remain **cross-origin**, since the full host differs). This does not eliminate the need for CORS (still a different origin → still needs an explicit CORS policy), but it does remove the cookie from WebKit's cross-site/third-party classification, which is the mechanism the prior report flagged as the most likely (unconfirmed) cause.

---

## Files Requiring Changes

**None require changes to make this architecturally possible today** — the codebase already derives every backend-origin reference from environment variables, not hardcoded hostnames. Confirmed by a full-repo grep for `onrender.com`: the only hits are in this session's own report markdown files (`Penny-Pilot-iOS-Auth-Root-Cause.md`) and two pre-existing docs (`USER_SIDE_BUG_FIX_REPORT.md`, `USER_SIDE_COMPLETE_AUDIT.md`) — all documentation, zero runtime code.

| Location | How it currently resolves the API origin | Change needed |
|---|---|---|
| `frontend/src/lib/api.ts` (`API_BASE_URL`) | `process.env.NEXT_PUBLIC_API_URL` | None — env var value changes, code doesn't |
| `frontend/src/lib/AuthContext.tsx` (`apiFetch`) | imports `API_BASE_URL` from `api.ts` | None |
| `frontend/src/lib/consent.ts`, `offlineSync.ts`, `export.ts` | same `API_BASE_URL` import | None |
| `frontend/src/components/pwa/OfflineSyncManager.tsx` | same `API_BASE_URL` import | None |
| `frontend/next.config.ts` (service-worker `runtimeCaching` URL patterns) | derives `apiOrigin` from `process.env.NEXT_PUBLIC_API_URL` at build time | None — a rebuild with the new env var value regenerates the correct patterns automatically |
| `frontend/src/app/(admin)/admin/settings/page.tsx` | same `API_BASE_URL` import | None |
| `backend/src/app.ts` (CORS `ALLOWED_ORIGINS`) | `process.env.APP_URL` / `FRONTEND_URL` — this is the **frontend's** origin allowlist, not the backend's own address | None (frontend origin doesn't change) |
| `backend/src/lib/webauthn.ts` (`RP_ORIGINS`/`RP_ID`) | same `APP_URL`/`FRONTEND_URL` — passkey relying-party ID is the **frontend** hostname (`pennypilot.pro`), never the API hostname | None — passkeys are entirely unaffected by an API domain change |
| `backend/src/lib/emailTemplates.ts` (recovery/reset emails) | `process.env.APP_URL` (frontend URL, with a hardcoded Vercel-preview fallback if unset) | None — links already point at the frontend, not the API |
| `backend/src/routes/drive.routes.ts` (`redirectBase()`, post-OAuth redirect back to the app) | `process.env.APP_URL`/`FRONTEND_URL` | None — redirects to the frontend, not the API |
| `backend/src/services/drive/googleDriveClient.ts` (`oauthClient()`) | `process.env.GOOGLE_REDIRECT_URI` | **Yes** — this is the one place that must point at the **backend's own** address (see OAuth Impact below) |
| `backend/vercel.json` | unused — legacy alternate deploy target from an earlier attempt to host the backend on Vercel instead of Render (`backend/api/index.ts` exists and still builds, but the live backend is confirmed running on Render) | None required by this plan; harmless historical artifact, not a blocker |

**Net code-change surface for this migration: one environment variable that's already the correct mechanism (`GOOGLE_REDIRECT_URI`), and no source-file edits at all.**

---

## Environment Variables Requiring Changes

| Variable | Where | Current (inferred from code, values not printed) | New value |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Vercel (frontend) | `https://personal-finance-dashboard-api-e3zf.onrender.com` | `https://api.pennypilot.pro` |
| `GOOGLE_REDIRECT_URI` | Render (backend) | `https://personal-finance-dashboard-api-e3zf.onrender.com/api/drive/callback` (inferred — actual value not read) | `https://api.pennypilot.pro/api/drive/callback` |
| `APP_URL` / `FRONTEND_URL` | Render (backend) | `https://www.pennypilot.pro` (comma-list, possibly incl. non-www) | **Unchanged** — this is the frontend's address, not the backend's |
| `COOKIE_SECRET` / `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `DATABASE_URL` | Render (backend) | — | **Unchanged** |

## CORS Changes

**None required in code.** `backend/src/app.ts`'s `ALLOWED_ORIGINS` is built from `APP_URL`/`FRONTEND_URL`, which already list the **frontend's** origins (`https://www.pennypilot.pro`, confirmed live to also already include `https://pennypilot.pro` non-www — both currently pass CORS preflight). Moving the backend's own address to `api.pennypilot.pro` doesn't change which origins are *allowed to call it* — that allowlist is unrelated to the backend's own hostname. No env var or code change needed here specifically for the domain move (they were already correctly configured for both `www` and non-`www` frontend variants in the prior investigation).

## OAuth Impact

Two independent OAuth-adjacent systems exist; only one is affected:

1. **WebAuthn/passkeys** (`RP_ID`/`RP_ORIGINS` in `webauthn.ts`) — derived from `APP_URL`/`FRONTEND_URL` (the frontend's domain). **Not affected** by an API domain change.
2. **Google Drive OAuth** (`googleDriveClient.ts`) — the `GOOGLE_REDIRECT_URI` env var must change to `https://api.pennypilot.pro/api/drive/callback`, **and** this exact new URI must be added to the OAuth client's "Authorized redirect URIs" list in the Google Cloud Console (an external, non-repo step — Google will reject the callback with a redirect_uri_mismatch error if the registered list doesn't include the new one). The old `onrender.com` redirect URI should be *kept* in the Google Cloud Console list during the transition (Google allows multiple registered redirect URIs simultaneously) so any in-flight OAuth flow started before the cutover can still complete, and so rollback is trivial.

## Cookie Impact

Per your instruction, `SameSite=None` is **not** changed in this plan. With the backend at `api.pennypilot.pro`:

- **Same-site?** Yes — `www.pennypilot.pro` and `api.pennypilot.pro` share the registrable domain `pennypilot.pro`.
- **Cross-origin?** Yes, still — different full hostnames, so CORS remains required exactly as configured today.
- **Does CORS remain required?** Yes — same-site does not mean same-origin; the browser still enforces CORS for the cross-origin `fetch()` calls.
- **Can host-only cookies remain?** Yes — the cookie continues to be set with no `Domain` attribute, scoped to `api.pennypilot.pro` exactly as it's scoped to the Render hostname today. No `Domain` attribute change is needed or proposed.
- **Can `credentials: "include"` remain?** Yes, unchanged, and still required for a cross-origin request regardless of same-site status.
- **Can `HttpOnly` remain?** Yes, unchanged.
- **Can `Secure` remain?** Yes, unchanged — both origins are HTTPS.
- **`SameSite=None` still works correctly here** — it's a superset of what `Lax` would allow, so nothing breaks by leaving it as-is during the transition. The only thing that changes is that, if WebKit's own third-party-cookie heuristics were the actual root cause, this same-site relationship should cause Safari to stop treating the cookie as third-party — worth testing before touching `SameSite` at all, exactly as you specified.

## DNS/Render Steps (external — not performed, documented only)

1. **Render dashboard:** open the existing backend service → Settings → Custom Domains → Add Custom Domain → enter `api.pennypilot.pro`. Render will display a DNS target (typically a `CNAME` record pointing at something like `<service>.onrender.com`, but **use exactly what Render's dashboard displays** — do not assume the format in advance).
2. **Hostinger DNS (for `pennypilot.pro`):** add exactly the record type/name/value Render's dashboard shows (usually `CNAME api → <render-provided-target>`). Do not invent a target.
3. **Wait for DNS propagation and Render's automatic HTTPS certificate provisioning** (Render auto-issues a Let's Encrypt cert once DNS resolves correctly — this can take minutes to a few hours).
4. **Verify** `https://api.pennypilot.pro/health` returns `{"status":"ok",...}` over a valid HTTPS connection before touching any application configuration.
5. Only then update `NEXT_PUBLIC_API_URL` (Vercel) and `GOOGLE_REDIRECT_URI` (Render) and redeploy both, plus add the new redirect URI in Google Cloud Console.

The existing `personal-finance-dashboard-api-e3zf.onrender.com` hostname continues to work in parallel (Render custom domains are additive) — this is what makes the rollback trivial (see below).

## Existing Session Impact

- **Currently logged-in sessions will be invalidated by this migration.** The access/refresh cookies are host-only, scoped to `personal-finance-dashboard-api-e3zf.onrender.com`. A browser that already has those cookies will keep sending them to that hostname, but once `NEXT_PUBLIC_API_URL` changes to `api.pennypilot.pro`, the frontend will start calling the new hostname — which that browser has no cookie for yet. **Every existing user will need to log in again** after the cutover (not a security regression — just an expected one-time re-auth, identical in effect to a normal session-timeout `AUTH_REQUIRED` case, and the existing "silent redirect" fix from the prior phase will show the user the (already correct) sign-in page rather than any confusing error).
- Google Drive connections (`BackupConnection` rows, keyed by `userId` + Google's own OAuth refresh token) are **not** affected — they don't depend on which hostname served the original OAuth callback, only on the stored refresh token remaining valid, which Google Cloud Console changes don't invalidate.
- Recovery sessions (forgot-password OTP/TOTP/security-questions) are short-lived (15-minute TTL) and already tied to a signed cookie scoped to the backend hostname — any recovery flow genuinely in-progress at the exact moment of cutover would need to be restarted, but given the TTL this is a negligible window if the cutover is scheduled deliberately.

## Rollback Plan

Because Render custom domains are additive (the `onrender.com` hostname keeps working), rollback is a **single environment-variable revert**, no data or DNS undo required:
1. Revert `NEXT_PUBLIC_API_URL` back to `https://personal-finance-dashboard-api-e3zf.onrender.com` on Vercel, redeploy.
2. Revert `GOOGLE_REDIRECT_URI` back to the `onrender.com` callback on Render, redeploy (safe as long as that redirect URI was never removed from the Google Cloud Console list during the transition, per the OAuth Impact note above).
3. No DNS record needs to be removed — leaving the `api.pennypilot.pro` CNAME in place is harmless even if unused.

## Testing Plan

1. After DNS/Render steps are complete and verified externally, stage the two env var changes in a non-production preview/branch deploy if your Vercel/Render setup supports it, or schedule a deliberate low-traffic cutover window.
2. Test the full production login flow end-to-end on desktop Chrome first (fast, matches the prior investigation's existing baseline).
3. Confirm `Set-Cookie` on `api.pennypilot.pro`'s login response still shows `HttpOnly; Secure; SameSite=None` (unchanged), and that the browser correctly classifies the relationship as same-site (can be inspected via browser devtools' cookie/storage panel, which typically labels first-party vs. third-party).
4. Re-run the same cross-user/IDOR and session-loss checks already covered in prior phases, to confirm no regression from the domain change alone.
5. **Only then**, attempt real iOS Safari testing (device or real-device service) — this is the actual point of the change, and should be the very next step once the domain migration itself is confirmed stable on Chromium.
6. Only after a same-site architecture is confirmed working on real iOS should `SameSite=None` → `Lax` even be considered, and that would be its own separate, deliberately staged phase — not part of this one.

## Security Considerations

- No security property is weakened by this plan: `HttpOnly`, `Secure`, host-only scoping, CORS allowlisting, and CSRF/origin checks are all explicitly preserved unchanged.
- This is a **reduction** in attack surface in one respect: a same-site relationship is generally considered a stronger security posture for cookie-based auth than relying on a third-party-cookie exception, independent of the iOS question entirely.
- The Google OAuth redirect URI change requires care: registering the new URI in Google Cloud Console *before* switching `GOOGLE_REDIRECT_URI` in Render avoids a window where Drive connections could fail with a redirect_uri_mismatch.
- No new attack surface is introduced — `api.pennypilot.pro` is the same backend service, same code, same database, only reachable at an additional hostname.

## iOS Verification Still Required

**Real iOS Safari remains NOT VERIFIED.** This plan is a well-reasoned architectural change that addresses the specific risk factor identified in the prior root-cause investigation (cross-site/third-party cookie classification), but it is still a hypothesis until tested on a real device. Moving to a same-site architecture does not, by itself, prove the original bug is fixed — it removes one specific, plausible cause. If the problem persists after this migration and a real-device test, that would be strong evidence the root cause lies elsewhere (e.g. the fetch-vs-navigation cookie-acceptance nuance or an in-app-browser-specific issue noted in the prior report), and should be revisited from there rather than assumed fixed by this change alone.

---

### Database
No changes. No migrations.

### Git
No commit. No push.

### Deployment
No deployment. No DNS changes. No Render configuration changes. No environment variable changes were made — this document only records what they would need to become.
