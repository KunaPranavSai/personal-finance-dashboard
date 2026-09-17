# Penny Pilot — Same-Site API Pre-Cutover Verification

Date: 2026-09-16
Scope: Read-only pre-cutover verification. **No files were modified. No environment variables were changed. No migrations were run. No commit/push/deploy.**

---

## 1. `https://api.pennypilot.pro/health` responds successfully over HTTPS

**NOT VERIFIED.**

`curl https://api.pennypilot.pro/health` fails at the DNS resolution step — it never reaches HTTPS/TLS at all:

```
curl: (6) Could not resolve host: api.pennypilot.pro
```

Confirmed with two independent public resolvers (Google `8.8.8.8`, Cloudflare `1.1.1.1`) — both return `NXDOMAIN` ("Non-existent domain"). To rule out a caching/propagation artifact, I also queried `pennypilot.pro`'s own authoritative nameserver directly:

```
nslookup api.pennypilot.pro aurora.dns-parking.com  →  NXDOMAIN
```

Because this is a direct query to the domain's own authoritative server (not a resolver cache), this is not a propagation-delay situation — **the DNS zone for `pennypilot.pro` currently has no record for `api.pennypilot.pro`.**

For comparison, the existing `www.pennypilot.pro` resolves correctly through the same authoritative servers, confirming the zone itself is reachable and query-able — it simply doesn't contain the new `api` record (yet, or as configured).

`pennypilot.pro`'s authoritative nameservers are `aurora.dns-parking.com` / `nebula.dns-parking.com`, with SOA responsible-mail-address `dns.hostinger.com` — this confirms the zone is indeed Hostinger's DNS (as expected), not a mismatched/wrong provider. The zone's SOA serial (`2026091504`) indicates a recent edit, consistent with DNS having been touched recently — but whatever was added, `api.pennypilot.pro` is not resolvable from it right now.

**Action needed before this can be re-verified:** double-check in the Hostinger DNS panel that the record Render's dashboard displayed was actually saved for the `api` subdomain (correct type, correct name — e.g. `api` not `api.pennypilot.pro.pennypilot.pro`, a common panel-specific duplication mistake — and the exact target Render provided).

## 2. TLS certificate is valid

**NOT VERIFIED** — blocked by #1. TLS negotiation cannot occur without DNS resolution; there is nothing to inspect yet. (Render normally auto-provisions a Let's Encrypt certificate only after it observes the custom domain resolving correctly, so this step logically cannot complete until #1 does.)

## 3. The new hostname reaches the same Render backend service

**NOT VERIFIED** — blocked by #1, for the same reason.

## 4. No source-code changes are required for the API hostname migration

**VERIFIED.**

Re-confirmed by a fresh full-repo grep: zero hardcoded `onrender.com` references in any `.ts`/`.tsx`/`.json` runtime file, in either `backend/` or `frontend/`. The only hits anywhere in the repo are inside this session's own planning/report markdown files. The frontend's single source of truth for the API origin is `frontend/src/lib/api.ts`: `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";` — every other frontend file that calls the API (`AuthContext.tsx`, `consent.ts`, `offlineSync.ts`, `export.ts`, the admin settings page, and `next.config.ts`'s service-worker cache-pattern generation) imports/derives from this one constant. No edits are needed to move the API's public hostname.

## 5. Exact environment variables that must change

**VERIFIED (identified, not changed):**

| Variable | Platform | Change |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Vercel (frontend) | → `https://api.pennypilot.pro` |
| `GOOGLE_REDIRECT_URI` | Render (backend) | → `https://api.pennypilot.pro/api/drive/callback`, **and** this exact URI must also be added to the OAuth client's "Authorized redirect URIs" in Google Cloud Console (external step, outside this repo) |

These are the only two variables this migration requires changing anywhere. Neither was touched in this verification pass.

## 6. `APP_URL` / `FRONTEND_URL` must remain unchanged

**VERIFIED.**

Both are the **frontend's** address, used for: the backend's CORS allowlist (`backend/src/app.ts`), WebAuthn/passkey relying-party ID (`backend/src/lib/webauthn.ts` — `RP_ID`/`RP_ORIGINS` are derived from these, i.e. the frontend's hostname, never the API's), outgoing recovery/notification email links (`backend/src/lib/emailTemplates.ts`), and the post-OAuth redirect back into the app (`backend/src/routes/drive.routes.ts`'s `redirectBase()`). None of these four call sites reference the API's own hostname — moving the backend's public address does not require touching any of them.

## 7. JWT, cookie, database, passkey/WebAuthn, recovery, and Drive storage configuration must remain unchanged except for `GOOGLE_REDIRECT_URI`

**VERIFIED.**

- JWT secrets (`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`) and `COOKIE_SECRET`: no code path ties these to the API's own hostname; unaffected.
- `DATABASE_URL`: entirely unrelated to the public API domain; unaffected.
- Passkey/WebAuthn (`RP_ID`/`RP_ORIGINS`): confirmed under #6 — derived from the frontend's domain, not the API's; unaffected.
- Recovery (`RecoverySession`, OTP/TOTP/security-questions flow): the recovery cookie is scoped to whichever hostname served the request, same as the auth cookies — this changes host along with the API move, exactly as expected and intended (it's the same category of change as the login cookie itself, not a separate concern).
- Drive storage configuration: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are unaffected; only `GOOGLE_REDIRECT_URI` needs to change, as already identified in #5.

**Confirmed: `GOOGLE_REDIRECT_URI` is the only variable in this entire category that needs to change.**

## 8. Old `onrender.com` hostname and old Google OAuth redirect URI should remain available for rollback

**VERIFIED (as a plan, not yet exercised).**

- The old Render hostname (`personal-finance-dashboard-api-e3zf.onrender.com`) was re-tested during this verification and is still live and healthy (`GET /health` → `200 {"status":"ok",...}`) — Render custom domains are additive, so this hostname is expected to keep working in parallel indefinitely, making it a valid rollback target.
- The old Google OAuth redirect URI should be **kept registered** in the Google Cloud Console's "Authorized redirect URIs" list (not removed) when the new one is added — this was already called out as a requirement in the prior planning phase, and remains unchanged/unexecuted here since no Google Cloud Console changes have been made in this pass either.

---

### Blocking Item

**DNS for `api.pennypilot.pro` is not yet resolvable**, confirmed via direct query to `pennypilot.pro`'s own authoritative nameserver (not just a resolver-cache check). Items 1–3 cannot be completed until this is fixed. Recommend re-checking the exact record saved in the Hostinger DNS panel against exactly what Render's dashboard displayed (host/type/target), and re-running this verification once it resolves — items 4–8 do not need to be re-checked, as they're independent of DNS state.

### Files Modified
None.

### Environment Variables Changed
None.

### Database
No migrations run. No changes.

### Git
No commit. No push. No deploy.
