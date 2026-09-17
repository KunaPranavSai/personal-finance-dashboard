# Penny Pilot — Master Security, Launch Readiness, Storage & UX Implementation Plan

## 1. Purpose

This document is the master implementation specification for a comprehensive audit and production-readiness upgrade of Penny Pilot.

It combines:

- Critical security hardening
- Server-side authorization
- Authentication/session security
- Google Drive reliability and recovery
- Google Drive → Google Drive migration
- Optional Local-Only storage
- Local → Google Drive migration
- Secure export/import
- Global error transparency and recovery
- Legal/consent consistency
- SEO and launch readiness
- Accessibility and responsive design
- UI/UX polish
- Performance
- Comprehensive testing and regression validation

**This is not a greenfield rewrite.** Preserve working functionality and the existing architecture. Make only necessary, scoped, reviewable changes.

---

# 2. Core Product/Data Principle

Penny Pilot must support two explicit financial-data storage modes:

```text
                    ┌── Google Drive
StorageProvider ────┤
                    └── Local IndexedDB
```

### Mode A — Google Drive
Recommended cloud storage. The user's Penny Pilot financial workspace is stored in the user's Google Drive.

### Mode B — This Device Only
Local-only storage in the user's browser/device using IndexedDB. No Google Drive connection is required.

### Critical rule

Do **not** use PostgreSQL as a fallback financial-data store when the user declines Google Drive.

PostgreSQL should contain only the minimum account/application metadata required by the existing architecture.

Administrators must never be able to browse ordinary users' financial records.

---

# 3. Phase 0 — Storage Architecture

## 3.1 Common StorageProvider

Create/refine a common storage abstraction:

```text
StorageProvider
├── GoogleDriveStorage
└── LocalStorageProvider
```

All financial modules must use this abstraction instead of deciding independently where data is stored.

Affected areas include:

- transactions
- expenses
- income
- budgets
- savings
- investments
- bills/EMIs
- financial goals
- categories
- money sources/wallets
- analytics
- reports
- dashboard calculations

Do not duplicate business logic unnecessarily between providers.

---

# 4. Local-Only Mode

Provide a clear onboarding choice:

## Choose how you want to store your data

### Google Drive — Recommended
Store Penny Pilot data in your own Google Drive.

**[Connect Google Drive]**

### This Device Only
Keep Penny Pilot data locally in this browser/device without connecting Google Drive.

**[Continue on this Device]**

Do not describe this only as "Opt out of backup." It is a separate storage mode.

---

# 5. Local-Only Warning

Before activating Local-Only Mode, show a prominent warning:

> ⚠️ **Important: Local-only storage**
>
> Your financial data will be stored only on this browser/device. Penny Pilot will not maintain a cloud backup of this data.
>
> If browser/site data is cleared, the device is lost, the browser profile is reset, or you switch devices/browsers, your data may be permanently lost unless you have exported a backup.

Require:

> ☐ I understand that local-only data may be permanently lost if I do not maintain my own backup.

Do not allow activation without acknowledgement.

---

# 6. Local Storage Requirements

Use **IndexedDB**, not localStorage, as the primary financial-data store.

Handle:

- IndexedDB unavailable
- browser storage disabled
- quota exceeded
- transaction aborted
- corrupted local data
- interrupted writes
- read failures
- write failures

Use versioned/atomic writes where practical.

A failed write must never silently appear successful.

Every financial operation must clearly resolve to:

- Saved
- Failed / not saved
- Outcome uncertain

---

# 7. Local Data UI

Add:

**Settings → Data & Storage**

Show:

- Storage mode
- Local/Drive status
- Last saved/synchronized time where applicable
- Export Backup
- Import Backup
- Switch to Google Drive

Clearly label Local-Only Mode throughout the application.

---

# 8. Secure Local Export/Import

Provide a versioned Penny Pilot backup format.

Backups must not contain:

- passwords
- JWTs
- OAuth access tokens
- refresh tokens
- encryption keys
- client secrets
- server secrets

Validate imported files before modifying existing local data.

A failed or malformed import must not partially overwrite existing data.

Where practical, make exported backups encrypted and clearly explain the user's responsibility for protecting the backup file.

---

# 9. Local → Google Drive Migration

Safe flow:

```text
Local-only
   ↓
Connect Google Drive
   ↓
Review data
   ↓
Explicit confirmation
   ↓
Write complete dataset to Drive
   ↓
Verify destination
   ↓
Switch active storage provider
```

Do not delete local data until the Drive workspace has been completely written and verified.

If migration fails:

- Local data remains active.
- No local data is deleted.
- Drive destination does not become authoritative.
- Show the actual safe reason.
- Allow retry.

---

# 10. Google Drive → New Google Drive Migration

Support moving Penny Pilot data from Drive A to Drive B.

Use wording such as:

> **Move your Penny Pilot data to another Google Drive**

Do not imply Penny Pilot is migrating the user's entire Google Drive.

## Safe flow

```text
Current Drive A
      ↓
Connect Drive B
      ↓
Identify destination workspace
      ↓
Explicit confirmation
      ↓
Read and validate current workspace
      ↓
Write complete workspace to Drive B
      ↓
Verify Drive B
      ↓
Switch source of truth
```

### Critical rule

Never switch the active source of truth before destination verification succeeds.

Never:

- delete Drive A automatically
- silently merge workspaces
- overwrite unrelated destination data
- switch before verification
- claim migration success after partial migration

If migration fails:

- Drive A remains active.
- Drive A remains untouched.
- Drive B does not become authoritative.
- Explain the safe reason.
- Allow retry.

---

# 11. Existing Destination Workspace

If Drive B already contains a Penny Pilot workspace, explicitly ask:

- Reuse the existing workspace
- Start a new empty workspace

Never silently merge two workspaces.

Follow existing account-change/workspace safety rules.

---

# 12. Drive Full — User Recovery

If Drive storage is full, do not show only:

> Can't connect to Drive

Instead:

> ⚠️ **Couldn't save this expense**
>
> Your Google Drive storage is full, so this expense has not been saved.
>
> Free up some space and try again, or move your Penny Pilot data to another Google Drive.

Actions:

**[Switch to another Google Drive]**

**[Free up Space]**

**[Try Again]**

If Local-Only Mode is available:

**[Continue on this Device]**

The most useful recovery action should be prominent.

---

# 13. Safe Financial Retry

Never blindly retry non-idempotent operations:

- expense creation
- income creation
- transaction creation
- investment creation
- bill creation
- goal creation

If the system cannot determine whether a timed-out operation succeeded, show:

> ⚠️ **We couldn't confirm whether this expense was saved.**
>
> Please check your Expenses before trying again to avoid creating a duplicate.

Only automatically retry when the operation is demonstrably safe or protected by appropriate idempotency.

---

# 14. Global Error Transparency

The application must not give ordinary users misleading generic messages when the backend knows the actual safe cause.

Principle:

> **If the application knows the safe reason for an error, tell the user the meaningful reason and what to do next.**

Do not expose internal technical details.

Examples of messages to audit:

- Something went wrong
- Request failed
- Operation failed
- Can't connect
- Unable to connect
- Failed to fetch
- Failed to save
- Failed to load
- Unknown error
- Server error

Replace generic messages wherever the actual cause is known.

---

# 15. Structured Error Contract

Create a centralized server → frontend error contract.

Example:

```json
{
  "error": {
    "code": "DRIVE_STORAGE_QUOTA_EXCEEDED",
    "message": "Your Google Drive storage is full.",
    "userMessage": "Your Google Drive storage is full, so Penny Pilot couldn't save your data.",
    "action": "FREE_DRIVE_SPACE",
    "requestId": "safe-reference-id"
  }
}
```

The exact implementation can differ, but error normalization must be centralized.

Never expose:

- stack traces
- SQL
- Prisma internals
- filesystem paths
- OAuth response bodies containing secrets
- tokens
- credentials
- encryption keys
- sensitive database information
- other users' information

---

# 16. Error Code Catalog

## Authentication

```text
AUTH_INVALID_CREDENTIALS
AUTH_SESSION_EXPIRED
AUTH_UNAUTHORIZED
AUTH_FORBIDDEN
```

## Validation

```text
VALIDATION_INVALID_INPUT
VALIDATION_REQUIRED_FIELD
```

## Network

```text
NETWORK_OFFLINE
NETWORK_TIMEOUT
SERVER_UNAVAILABLE
RATE_LIMITED
```

## Google Drive

```text
DRIVE_NOT_CONNECTED
DRIVE_AUTH_EXPIRED
DRIVE_PERMISSION_DENIED
DRIVE_STORAGE_QUOTA_EXCEEDED
DRIVE_FILE_NOT_FOUND
DRIVE_API_UNAVAILABLE
DRIVE_WRITE_FAILED
DRIVE_READ_FAILED
DRIVE_ACCOUNT_SWITCH_REQUIRED
DRIVE_MIGRATION_STARTED
DRIVE_MIGRATION_FAILED
DRIVE_MIGRATION_VERIFICATION_FAILED
DRIVE_MIGRATION_SUCCESS
```

## Local Storage

```text
LOCAL_STORAGE_UNAVAILABLE
LOCAL_STORAGE_QUOTA_EXCEEDED
LOCAL_STORAGE_CORRUPTED
LOCAL_STORAGE_WRITE_FAILED
LOCAL_STORAGE_READ_FAILED
```

## Import/Export/Migration

```text
MIGRATION_FAILED
MIGRATION_VERIFICATION_FAILED
IMPORT_INVALID_FILE
IMPORT_CORRUPTED_FILE
EXPORT_FAILED
```

## Backend

```text
DATABASE_UNAVAILABLE
INTERNAL_ERROR
```

Use specific codes whenever the real cause is known.

---

# 17. User-Facing Error Examples

### Drive full

**Google Drive storage is full**

> Your Google Drive has reached its storage limit, so Penny Pilot couldn't save your data.

Recovery:

- Switch Google Drive
- Free up space
- Try again

### Drive authorization expired

**Google Drive connection expired**

> Your Google Drive authorization has expired. Reconnect Google Drive to continue using cloud storage.

**[Reconnect Google Drive]**

### Drive permission denied

**Google Drive access denied**

> Penny Pilot no longer has permission to access the connected Google Drive. Reconnect Google Drive and grant the required permission.

### Drive unavailable

**Google Drive is temporarily unavailable**

> Google Drive isn't responding right now. Your data has not been intentionally deleted. Please try again shortly.

### Offline

**No internet connection**

> You're currently offline. Check your connection and try again.

### Local storage full

**Device storage is full**

> This browser has reached its available storage limit. Export your data or free up browser/device storage before continuing.

### Rate limited

**Too many attempts**

> Too many requests were made in a short period. Please wait a moment and try again.

---

# 18. Global Frontend Error Handler

Centralize:

```text
normalizeApiError(error)
        ↓
ApplicationError
        ↓
Toast / Inline Error / Alert / Recovery Panel
```

Do not make every page independently parse raw API errors.

---

# 19. Error Presentation Rules

### Minor operation failure
Toast.

### Form validation
Inline field error.

### Storage failure
Persistent alert/banner.

### Authentication/session issue
Dedicated message and recovery action.

### Critical data/storage problem
Prominent recovery panel.

Never silently swallow an important error.

---

# 20. Request/Correlation IDs

Unexpected server errors should have a safe request ID.

Example:

> Something went wrong. Please try again.
>
> Reference: PP-ABC123

Use the same ID in server logs.

Never put sensitive information in request IDs.

---

# 21. Admin Diagnostics

Users receive:

- accurate reason
- affected operation
- recovery action
- safe reference ID when useful

Admins may receive:

- error code
- endpoint
- HTTP status
- request ID
- timestamp
- service/component
- safe diagnostic metadata

Never expose to admins:

- passwords
- tokens
- OAuth secrets
- encryption keys
- ordinary users' financial records

---

# 22. HTTP Status Mapping

Use appropriate statuses:

```text
400 → validation
401 → unauthenticated/session expired
403 → forbidden
404 → resource not found
409 → conflict
413 → payload too large
429 → rate limited
500 → internal server error
502/503/504 → upstream/service unavailable
```

Do not turn every error into HTTP 500.

---

# 23. Google Drive Error Mapping

Audit actual Google Drive API responses and map known conditions:

- storage quota exceeded
- insufficient permissions
- expired authorization
- revoked authorization
- file not found
- rate limiting
- API unavailable
- network timeout
- read failure
- write failure

The frontend must receive the correct Penny Pilot error state.

---

# 24. Local Error Mapping

Distinguish:

- IndexedDB unavailable
- quota exceeded
- transaction aborted
- corrupted data
- browser storage disabled
- read failure
- write failure

Do not display "Something went wrong" when the actual cause is known.

---

# 25. Error Boundary

Implement/verify frontend error boundaries for unexpected rendering failures.

Provide:

> Something went wrong.

Actions:

**[Try Again]**

**[Go to Dashboard]**

Optional safe reference ID.

Never show stack traces.

---

# 26. Phase 1 — Critical Security Audit

## 26.1 Secret Exposure

Verify no frontend exposure of:

- service-role keys
- private OAuth secrets
- database credentials
- JWT secrets
- encryption keys
- access tokens
- refresh tokens
- server credentials

Audit all public environment variables.

---

# 27. Server-Side Authorization

Never trust client-supplied:

- userId
- accountId
- ownerId
- resource owner fields

Resolve authenticated identity from the server session.

Every user resource must perform server-side ownership validation.

Test IDOR scenarios.

---

# 28. Database Security

Penny Pilot uses a backend API + PostgreSQL architecture.

Do not blindly introduce Supabase-style RLS if the browser does not directly access PostgreSQL.

Instead verify:

- authenticated API access
- ownership checks
- least-privilege database access
- no cross-user queries
- no IDOR
- safe Prisma usage

If a table is directly exposed to an untrusted database client, apply appropriate strict row-level authorization.

Do not introduce unnecessary architecture.

---

# 29. Secure Sign-Out

Verify logout:

- destroys/invalidates server-side session state where applicable
- clears HTTP-only authentication cookies
- prevents reuse of the old session
- does not rely only on frontend state

Test the previous session after logout.

---

# 30. Authentication Error Messages

Prevent account enumeration.

Use:

> Invalid email or password

for invalid login credentials without revealing whether the account exists.

Audit:

- login
- signup
- password reset
- email verification
- OAuth
- Drive connection

---

# 31. Additional Security Audit

Audit for:

- IDOR
- broken access control
- privilege escalation
- mass assignment
- XSS
- SQL injection
- unsafe Prisma queries
- CSRF where applicable
- CORS
- insecure cookies
- security headers
- CSP feasibility
- path traversal
- unsafe file uploads
- unsafe imports
- malformed JSON
- prototype pollution
- brute force
- rate limiting
- sensitive logging
- error leakage
- stack traces
- OAuth state validation
- redirect validation
- token handling

Admin users must never be able to browse ordinary users' financial records.

---

# 32. Phase 2 — Launch Readiness

Implement/audit:

1. Privacy Policy
2. Terms of Service
3. Custom 404
4. Dynamic page metadata
5. Unique page titles
6. Unique descriptions
7. robots.txt
8. sitemap.xml
9. favicon
10. Open Graph/social preview image
11. descriptive alt text
12. HTTPS enforcement
13. media/asset optimization
14. broken links
15. broken forms
16. API rate limiting
17. signup/login abuse protection
18. honeypot where appropriate
19. privacy-safe analytics
20. mobile viewport/overflow

---

# 33. SEO and Indexing

Verify:

- page-specific titles
- descriptions
- canonical URLs where appropriate
- robots.txt
- sitemap.xml
- favicon
- Open Graph metadata
- social preview
- appropriate indexing rules

Do not unnecessarily expose authenticated financial pages to search engines.

---

# 34. Analytics Privacy

Penny Pilot handles financial information.

Analytics must never collect:

- transaction amounts
- income
- expenses
- budgets
- financial goals
- wallet/account names
- financial record contents
- user-entered financial text

Analytics must never become a financial-data collection mechanism.

---

# 35. Accessibility

Audit:

- semantic HTML
- keyboard navigation
- visible focus states
- correct labels
- screen-reader semantics
- contrast
- accessible dialogs
- accessible errors
- touch target size

Provide:

- skip-to-content
- keyboard-accessible menus
- keyboard-accessible dialogs
- appropriate focus management

---

# 36. Responsive Design

Test:

```text
375px
390px
430px
desktop
```

Verify:

- no horizontal scrolling
- no clipping
- no overlapping controls
- usable forms
- usable charts
- readable financial tables
- appropriate touch targets
- correct viewport scaling

---

# 37. Phase 3 — UI/UX

Implement/audit:

1. Dark mode toggle
2. Sticky header
3. Responsive mobile menu
4. Back-to-top button
5. Skip-to-content link
6. Hover states
7. Skeleton loaders
8. Empty states
9. Expandable FAQs
10. Toast notifications
11. Form validation indicators
12. Password visibility toggle
13. Copy buttons
14. Keyboard shortcuts
15. Mobile optimization
16. Accessibility improvements

---

# 38. Navigation

Verify:

- sidebar
- mobile menu
- header
- active states
- keyboard access
- responsive collapse
- no dead routes

---

# 39. Loading and Empty States

Use skeleton loaders for asynchronous data.

Every zero-data financial module should have a meaningful empty state and CTA.

Never populate an empty financial module with fake/sample financial records.

---

# 40. Form UX

Verify:

- field-level validation
- required indicators
- password visibility
- correct input types
- accessible labels
- mobile-friendly controls
- prevention of accidental duplicate submissions

---

# 41. Legal Consent

Signup must contain separate required controls:

```text
☐ I agree to the Terms of Service
☐ I acknowledge the Privacy Policy
```

Terms and Privacy links must open the real legal pages without losing signup state.

Typed full name is an:

> electronic signature/authorization

Do not overclaim that it is a cryptographic, qualified, or legally equivalent digital signature.

Server-side validation is mandatory.

ConsentRecord must contain:

- user/account ID
- signedName
- termsAccepted
- privacyAccepted
- termsVersion
- privacyVersion
- server timestamp

Consent should be persisted safely with account creation.

---

# 42. Legal Version Consistency

Local-Only Mode changes the application's storage behavior.

Therefore Terms and Privacy must accurately describe:

- Google Drive storage
- Local-Only storage
- local data-loss risks
- export responsibility
- storage switching
- migration behavior
- what remains server-side
- Google OAuth only when Drive is selected

Do not retain statements that Google Drive is mandatory once Local-Only Mode exists.

Update only necessary legal sections.

Bump versions appropriately, expected:

```text
Terms: 1.1
Privacy: 1.1
```

Keep these versions synchronized across:

- frontend constants
- backend constants
- legal pages
- ConsentRecord
- signed consent PDF

Do not invent legal claims.

---

# 43. Signed Consent PDF

The PDF must include:

1. User information
2. Signed name
3. Acceptance timestamp
4. Terms version
5. Privacy version
6. Consent status
7. Electronic signature/authorization explanation
8. Complete accepted Terms
9. Complete accepted Privacy Policy
10. Correct page numbering

PDF failure must not create duplicate accounts.

The consent record should persist before claiming consent was recorded.

PDF must never contain:

- passwords
- OAuth tokens
- secrets
- encryption keys

---

# 44. PDF Quality

Verify:

- no blank pages
- no page overflow
- no parser errors
- no truncated legal content
- correct footers
- correct page count
- readable text
- browser download
- authenticated re-download
- correct Content-Disposition behavior cross-origin

---

# 45. Database Migration Safety

If a migration is required:

**STOP before applying it.**

Report:

- migration name
- exact SQL
- reason
- affected tables
- additive/destructive status

Never:

- reset production
- truncate
- delete production users
- delete financial data
- silently repair unrelated drift
- modify migration history unnecessarily

If Prisma reports unrelated drift, STOP and show the exact SQL.

---

# 46. Existing Schema Drift

Do not automatically repair unrelated schema drift such as:

```text
app_profile
app_settings
```

or any other unrelated schema differences.

Separate approval is required.

---

# 47. Testing Strategy

Perform real behavioral tests, not only code inspection.

## Authentication

- signup
- login
- invalid credentials
- logout
- session expiry
- unauthorized request
- IDOR attempts

## Google Drive

- successful connection
- storage full
- revoked access
- expired authorization
- permission denied
- file missing
- API unavailable
- timeout
- read failure
- write failure
- account switching

## Drive-to-Drive

- connect Drive B
- review
- explicit migration confirmation
- complete copy
- destination verification
- source-of-truth switch
- old Drive preservation
- duplicate prevention
- simulated failure
- recovery/retry

## Local Mode

- activation
- warning
- acknowledgement
- create expense
- create income
- edit
- delete
- dashboard synchronization
- refresh
- browser reopen
- export
- import
- invalid import
- corrupted import
- quota failure
- storage unavailable

## Local → Drive

- complete migration
- verification
- source preservation
- source-of-truth switch
- failed migration recovery
- duplicate prevention

## Financial CRUD

Test create/read/update/delete and persistence for every major financial entity.

Verify dashboard and analytics synchronization.

## Consent

- Terms unchecked
- Privacy unchecked
- signature empty
- server-side bypass attempts
- valid consent
- ConsentRecord
- PDF
- version tracking
- re-download

## Mobile

375px / 390px / 430px.

## Accessibility

Keyboard-only navigation, focus states, labels and dialogs.

---

# 48. Error Test Matrix

For representative failures, record:

| Scenario | Backend error | User-facing result | Recovery |
|---|---|---|---|
| Drive full | `DRIVE_STORAGE_QUOTA_EXCEEDED` | Storage-full explanation | Switch / Free space / Retry |
| Drive revoked | appropriate Drive auth error | Reconnect explanation | Reconnect |
| Offline | `NETWORK_OFFLINE` | Offline explanation | Retry |
| Local quota | `LOCAL_STORAGE_QUOTA_EXCEEDED` | Device storage explanation | Export/free space |
| Session expired | `AUTH_SESSION_EXPIRED` | Session expired | Sign in |
| Rate limited | `RATE_LIMITED` | Too many attempts | Wait |
| Unknown server failure | `INTERNAL_ERROR` | Safe fallback + reference | Retry/support |

Exact mappings must reflect the real implementation.

---

# 49. Data Integrity Rules

For every financial operation verify:

```text
SUCCESS
FAILURE
UNKNOWN OUTCOME
```

Never claim "not saved" unless that is known.

Never claim "saved" unless persistence is confirmed.

Never blindly repeat uncertain financial mutations.

For failed migrations, imports and storage operations, preserve the last known-good state.

---

# 50. Performance

Audit:

- unnecessary API calls
- duplicate queries
- redundant requests
- expensive dashboard calculations
- chart rendering
- bundle size
- image sizes
- font loading
- unnecessary re-renders
- large JSON payloads
- loading waterfalls

Use caching/query invalidation carefully. Financial-data correctness takes priority over aggressive caching.

---

# 51. Web Security Headers

Review and implement where compatible:

- HTTPS enforcement
- secure cookies
- HTTP-only cookies
- SameSite
- CORS allowlist
- security headers
- CSP where feasible
- content-type protections
- frame protections
- referrer policy

Do not weaken protections to make functionality work.

---

# 52. OAuth Security

Verify:

- OAuth state validation
- redirect URI validation
- correct production redirect URI
- no frontend secrets
- token encryption at rest
- no token logging
- safe disconnect/revocation
- safe Drive account switching
- revoked-access handling

---

# 53. Final User-Facing Error Principle

Every important error should answer:

### What happened?

Example:

> Google Drive storage is full.

### Why?

When safe:

> Your Drive has reached its storage limit.

### What was affected?

> This expense was not saved.

### What should I do?

> Free up space or move Penny Pilot to another Drive.

### Can I retry safely?

Tell the user explicitly.

For uncertain outcomes:

> We couldn't confirm whether this expense was saved. Check Expenses before retrying to avoid a duplicate.

---

# 54. Launch Readiness Definition

Penny Pilot is launch-ready only when:

- no critical security issue remains
- authorization is server-side
- authentication errors resist enumeration
- secrets are protected
- Google Drive storage is reliable
- Drive-full errors are actionable
- Drive switching is safe
- Local-Only mode is safe
- migrations verify destinations before switching
- export/import are safe
- legal documents match actual behavior
- consent is versioned
- PDF generation is correct
- mobile UI is clean
- accessibility is reasonable
- SEO basics are implemented
- production builds pass
- important errors are tested
- no destructive migration is pending
- no unexpected git changes remain

---

# 55. Required Final Report

After implementation/testing, provide:

1. Executive summary
2. Existing architecture discovered
3. Storage architecture
4. Security findings
5. Security fixes
6. Global error system
7. Google Drive recovery
8. Drive-to-Drive migration
9. Local-only mode
10. Local-to-Drive migration
11. Export/import
12. Legal changes
13. Consent/PDF
14. SEO
15. Performance
16. Accessibility
17. UI/UX
18. Testing results
19. Mobile results
20. Build/typecheck/lint results
21. Exact files changed
22. Database changes, if any
23. Remaining risks
24. Production deployment checklist

Classify findings:

```text
CRITICAL
HIGH
MEDIUM
LOW
PASS
NOT VERIFIED
```

Never claim something is verified when it was only inferred from code.

---

# 56. Strict Safety Rules

DO NOT:

- reset the production database
- run `prisma migrate reset`
- run `prisma db push` against production
- delete production users
- delete financial records
- truncate tables
- revoke existing users' Drive access
- expose secrets
- commit secrets
- modify unrelated architecture
- silently repair unrelated schema drift
- modify migration history unnecessarily
- create unnecessary migrations
- store financial data in PostgreSQL as a fallback
- expose financial records to administrators
- automatically delete source data after migration
- blindly retry uncertain financial mutations

If Prisma generates unrelated SQL:

**STOP and show the SQL.**

If a migration is required:

**STOP before applying it and request explicit approval.**

---

# 57. Git Safety

Before changes:

```text
git status
git branch
git log -n 10
```

During implementation:

- preserve unrelated work
- keep changes scoped
- avoid unnecessary rewrites

Before commit:

```text
git diff
git diff --check
git status
```

List every changed file.

Do not automatically commit, push or deploy.

Stop for approval before commit/push/deploy.

---

# 58. Implementation Order

Use this sequence:

```text
1. Read-only architecture audit
        ↓
2. StorageProvider design
        ↓
3. Local-only storage
        ↓
4. Export/import
        ↓
5. Local → Google Drive migration
        ↓
6. Google Drive → Google Drive migration
        ↓
7. Global error contract
        ↓
8. Drive/local error mapping
        ↓
9. Financial mutation/retry safety
        ↓
10. Security audit and fixes
        ↓
11. Legal consistency/versioning
        ↓
12. Consent/PDF verification
        ↓
13. SEO/launch essentials
        ↓
14. UI/UX/accessibility
        ↓
15. Full regression testing
        ↓
16. Final diff review
        ↓
17. User approval
        ↓
18. Commit
        ↓
19. Push
        ↓
20. Production deployment
        ↓
21. Production smoke test
```

Do not skip the read-only audit.

Do not allow a broad implementation prompt to make uncontrolled destructive database changes.

---

# 59. Definition of Done

The final architecture should behave like:

```text
                  PENNY PILOT
                       │
              ┌────────┴────────┐
              │                 │
        Google Drive       This Device
        Recommended        Local-only
              │                 │
              └────────┬────────┘
                       │
                StorageProvider
                       │
          ┌────────────┴────────────┐
          │                         │
      Financial Data          Error System
          │                         │
   Accurate persistence       Clear reason
   Verified migration        Safe recovery
   Export/import             Admin diagnostics
          │                         │
          └────────────┬────────────┘
                       │
                Secure Penny Pilot
```

The application must never leave a user with a misleading:

> "Can't connect to Drive"

when the known condition is:

> "Your Google Drive storage is full."

Instead, the user must have a safe path such as:

> **Free space → Retry**

or:

> **Move Penny Pilot data to another Google Drive → Verify → Switch**

or, where appropriate:

> **Continue on this device**

All storage transitions must preserve data integrity and must never silently delete or overwrite financial data.

---

# 60. Final Engineering Standard

Do not claim something is:

- secure
- fixed
- migrated
- persisted
- recovered
- production-ready

merely because the code appears correct.

Where practical:

> **Test the behavior.**

Where testing is not possible:

> **NOT VERIFIED**

Do not hide failures.

Do not expose raw technical errors.

Give ordinary users accurate, understandable and actionable information.

Give administrators safe technical diagnostics.

For financial operations, **data integrity and recoverability take priority over convenience**.
