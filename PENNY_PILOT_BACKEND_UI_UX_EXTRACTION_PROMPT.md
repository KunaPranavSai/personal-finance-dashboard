# Penny Pilot — Backend-to-UI/UX Design Intelligence Extraction Prompt

## Purpose

You are a **senior product architect, UX researcher, UI/UX designer, frontend architect, and backend analyst** working on the existing **Penny Pilot** personal-finance application.

Your task is **READ-ONLY analysis only**.

Do **not** modify source code, database schemas, migrations, environment variables, configuration, Git state, or production data.

Your job is to inspect the **entire existing backend codebase first**, then cross-check the frontend where necessary, and produce an exhaustive **Backend-to-UI/UX Design Specification** that a professional frontend/UI/UX design team can use to redesign or implement the Penny Pilot interface without guessing about backend behavior.

The final document must describe **what the UI needs to represent because of the real backend**, not what you think a generic finance application should contain.

---

# 1. PRIMARY OBJECTIVE

Extract every UI/UX-relevant fact that can be determined from the existing implementation.

The final output must answer:

- What screens/pages are required?
- What user journeys exist?
- What actions can users perform?
- What API endpoints power each action?
- What request fields are required/optional?
- What data types and constraints exist?
- What validation rules exist?
- What success states exist?
- What loading states are needed?
- What empty states are needed?
- What error states are possible?
- What permissions/authorization rules affect UI?
- What storage mode affects UI?
- What Google Drive states affect UI?
- What Local-Only/IndexedDB states affect UI?
- What authentication/session states affect UI?
- What recovery/security states affect UI?
- What modals, confirmations, warnings, banners, toasts, tables, charts, forms, filters and navigation are required?
- What information should be visible to the user?
- What information must NEVER be exposed?
- What information is only relevant to admins?
- What mobile/responsive behavior is required?
- What accessibility behavior is required?
- What terminology and copy should the designers use?
- What UI requirements come directly from backend behavior?
- What requirements come from the Master Implementation Plan?
- What is already implemented?
- What is partially implemented?
- What is missing?
- What is uncertain and must not be invented?

---

# 2. SOURCE-OF-TRUTH RULE

Use this priority order:

1. Actual backend source code
2. Actual Prisma/database schema
3. Actual backend route/controller/service behavior
4. Actual frontend implementation where needed to understand current UX
5. Existing Penny Pilot Master Implementation Plan
6. Existing audit/report documents
7. Explicit current product requirements contained in this prompt

Do NOT replace actual implementation with generic assumptions.

If the backend behaves differently from the Master Plan:

- document the actual behavior;
- explicitly flag the discrepancy;
- preserve the planned requirement separately;
- do not silently reconcile the two.

If something cannot be determined from the repository:

> `NOT VERIFIED — requires product/design decision or further code investigation`

Never invent API behavior, fields, validation rules, states, permissions, or UI requirements.

---

# 3. CURRENT PRODUCT CONTEXT

Penny Pilot is a personal finance application for managing:

- Dashboard
- Expenses
- Income
- Transactions
- Budgets
- Savings
- Investments
- Bills / EMIs
- Financial Goals
- Categories
- Wallets
- Money Sources
- Analytics
- Reports
- Notifications
- Profile
- Security
- Account recovery
- Google Drive data storage
- Optional Local-Only storage
- Backup/export/import
- Storage migration

The product uses INR as the primary currency presentation requirement.

Use the application's actual terminology discovered in code, but preserve the current product terminology:

- Payment Method → Money Source
- Account → Wallet
- Local-Only → This Device / This Device Only where appropriate
- Google Drive → user's own Google Drive storage

Do not reintroduce outdated terminology if the current code has already migrated away from it.

---

# 4. CURRENT ARCHITECTURE CONTEXT

Known architecture that must be verified against the repository:

## Frontend

- Next.js 15
- App Router
- TypeScript
- Tailwind
- TanStack Query
- Framer Motion
- Recharts

Known route areas include:

- `/login`
- `/signup`
- `/forgot-password`
- `/admin-login`
- `/connect-drive`
- `/privacy-policy`
- `/terms`
- `/403`
- `/setup-2fa`
- `/~offline`
- authenticated application pages
- authenticated admin pages

Do not assume this list is complete. Inspect the repository and produce the authoritative route inventory.

## Backend

Known architecture:

- Express 5
- TypeScript
- Prisma
- PostgreSQL for account/auth/application operational data
- Google Drive for user financial data
- IndexedDB for Local-Only financial storage
- Resend for transactional email

Again, verify all of this against actual code.

---

# 5. STORAGE ARCHITECTURE — DESIGN IMPACT

The application is intended to support two financial-data storage modes:

## A. Google Drive

The user's Penny Pilot financial workspace is stored in their own Google Drive.

Financial data includes, where supported by the actual implementation:

- transactions
- expenses
- income
- budgets
- savings
- investments
- bills
- goals
- categories
- wallets/accounts
- money sources/payment methods

The UI must make the active storage state understandable.

## B. This Device / Local-Only

Financial data is stored in browser IndexedDB.

No Google Drive connection is required for Local-Only mode.

The UI must clearly communicate:

- local storage is active;
- data is device/browser-specific;
- clearing browser/site data can cause data loss;
- users are responsible for maintaining backups;
- export/import exists where implemented;
- switching storage modes is a data migration operation, not merely a preference toggle.

The Master Plan explicitly requires a clear onboarding choice between Google Drive and This Device Only and a warning before Local-Only activation.

---

# 6. STORAGE-PROVIDER UI REQUIREMENTS

Inspect the actual StorageProvider implementation and determine:

- storage mode resolver
- provider interface
- Google Drive provider
- Local provider
- local IndexedDB behavior
- provider-specific operations
- provider-specific errors
- mode switching
- migration status
- save-state behavior
- synchronization behavior
- last-saved timestamps
- offline behavior

For every financial screen, document whether it supports:

- Google Drive
- Local-Only
- both
- neither

Do not assume a module is Local-Only compatible merely because StorageProvider exists.

---

# 7. BACKEND ROUTE INVENTORY

Create a complete table of every backend route relevant to the user interface.

For each endpoint record:

| Field | Required information |
|---|---|
| HTTP method | GET/POST/PUT/PATCH/DELETE |
| Full route | Exact route |
| Auth required | Yes/No |
| Role required | Exact role if any |
| Drive required | Yes/No |
| Storage-mode aware | Yes/No |
| Request body | Exact fields |
| Query params | Exact fields |
| Path params | Exact fields |
| Required fields | Exact list |
| Optional fields | Exact list |
| Validation | Exact rules |
| Response | Relevant response shape |
| Success state | UI consequence |
| Error statuses | Actual statuses |
| Error codes | Actual codes |
| User-visible meaning | Safe interpretation |
| UI component | Suggested UI representation |
| Mutation type | Read/create/update/delete/action |
| Idempotency/retry | Safe or unsafe |
| Notes | Important implementation behavior |

Do this exhaustively.

---

# 8. PRISMA / DATA-MODEL EXTRACTION

Inspect the complete Prisma schema.

For every user-facing model identify:

- model name
- fields
- field types
- nullable fields
- defaults
- enums
- relations
- unique constraints
- indexes where UI-relevant
- ownership relationship
- lifecycle/state fields
- timestamps
- security-sensitive fields
- fields that must never reach the frontend

For every model, translate the backend model into UX implications.

Example:

```text
Backend:
amount Decimal
type enum
categoryId relation
date DateTime
notes optional

UI implications:
- currency input
- income/expense type selector
- category dropdown
- date picker
- optional notes field
- decimal validation
- localized INR display
```

Do this from the actual repository, not from assumptions.

---

# 9. FINANCIAL MODULES

Produce separate UI/UX specifications for each implemented financial area.

At minimum investigate:

## Dashboard

Extract:

- KPIs
- summaries
- totals
- date ranges
- charts
- category breakdowns
- recent transactions
- budget usage
- financial health calculations
- investment summaries
- bill summaries
- goals
- quick actions
- loading states
- empty states
- error states
- Drive/local differences

Document exactly what data powers each widget.

## Expenses

Document:

- table columns
- filters
- search
- pagination
- sorting
- create form
- edit form
- delete behavior
- categories
- wallets
- money sources
- date
- amount
- notes
- validation
- quick-create reference records
- success/error states
- local-mode behavior
- Drive-mode behavior

## Income

Perform the same analysis.

## Transactions

Determine whether this is a separate UI or underlying shared model/module.

Document the exact relationship between Transactions and Expenses/Income.

## Budgets

Extract:

- budget fields
- category relationships
- period handling
- limits
- utilization
- actual spending
- progress indicators
- create/edit/delete
- validation
- empty state
- dashboard relationship

## Investments

Extract every field and workflow from backend code.

Pay particular attention to:

- investment type
- units
- invested amount
- purchase price
- current value
- contribution fields
- dates
- returns
- performance calculations
- edit/delete behavior

Do not infer field meanings if the backend is ambiguous. Flag them.

## Bills / EMIs

Extract:

- bill type
- EMI-specific fields
- tenure
- interest
- due dates
- recurring behavior
- payment state
- validation
- optional fields
- UI conditional fields

Explicitly inspect for schema coercion/validation behavior that can affect form UX.

## Goals

Extract:

- goal fields
- target amounts
- current amounts
- target dates
- contribution behavior
- progress calculations
- CRUD
- dashboard representation

## Savings

Inspect actual implementation and document it even if it is less visible in navigation.

## Categories

Extract:

- creation
- editing
- deletion
- type
- color/icon if present
- relation to transactions
- default categories
- local seeding

## Wallets / Accounts

Document the actual current UI terminology and backend model.

## Money Sources / Payment Methods

Document:

- creation
- editing
- deletion
- type
- validation
- relationships

---

# 10. DASHBOARD DATA DEPENDENCIES

Trace dashboard calculations back to backend services.

For every dashboard widget document:

```text
Widget
↓
Frontend component
↓
Hook/query
↓
API endpoint
↓
Controller
↓
Service
↓
Data source
↓
Calculation
↓
UI representation
```

This is especially important for:

- total income
- total expenses
- balance
- transaction count
- budget usage
- investments
- bills
- goals
- financial health
- category breakdowns
- recent transactions

The designer must understand which widgets can become stale and which operations should trigger refresh.

---

# 11. AUTHENTICATION UI/UX

Inspect all authentication routes and document the complete UX.

Include:

- login
- signup
- logout
- session expiry
- unauthorized
- forbidden
- account approval if present
- password rules
- password visibility
- 2FA
- passkeys
- backup codes
- security settings
- change password
- change UID
- account recovery

For every auth state document:

- screen
- fields
- validation
- loading state
- success state
- failure state
- lockout state
- rate-limit state
- redirect
- security implications

---

# 12. ACCOUNT RECOVERY UX

Inspect the actual current recovery implementation in detail.

Known product direction includes a secure recovery state machine such as:

```text
REQUESTED
→ CHALLENGE SENT
→ OTP VERIFIED
→ SECURITY FACTOR REQUIRED
→ AUTHORIZED FOR PASSWORD RESET
→ PASSWORD RESET
→ COMPLETED
```

Failure states may include:

```text
EXPIRED
LOCKED
CONSUMED
```

Verify the actual implementation.

Document:

- forgot-password screen
- account identifier
- generic enumeration-safe response
- method selection
- email OTP
- resend OTP
- OTP expiration
- wrong attempts
- lockout
- security questions
- TOTP recovery if implemented
- password reset
- success screen
- expired-session screen
- invalid/consumed session
- rate limiting
- email delivery states

Do not expose implementation secrets in the UI.

---

# 13. EMAIL-DRIVEN UX

Inspect every `sendEmail()` call and map it to a user journey.

Known email categories include:

- recovery OTP
- password-changed notification
- security-event emails
- administrative account notifications
- migration-related notifications where implemented

For each:

- trigger
- recipient
- purpose
- expected user action
- UI state before email
- UI state after email
- failure behavior

The verified production sender domain is `pennypilot.pro`.

Do not expose Resend/API-key details to users.

---

# 14. GOOGLE DRIVE UX

Inspect all Drive-related routes/services.

Document every user-facing Drive state:

- not connected
- connecting
- OAuth redirect
- callback
- connected
- ready
- revoked
- expired authorization
- insufficient permissions
- Drive full
- network failure
- API unavailable
- timeout
- workspace missing
- workspace existing
- migration
- disconnect
- reconnect
- account switching
- restore previous revision
- initialization
- initialization failure
- partial migration protection

The UI must not show a misleading generic message when the backend knows the actual cause.

For example:

Instead of:

> Can't connect to Drive

when the actual condition is storage quota:

> Couldn't save this expense  
> Your Google Drive storage is full, so this expense has not been saved.

Possible actions:

- Switch to another Google Drive
- Free up Space
- Try Again
- Continue on this Device where appropriate

---

# 15. DRIVE-TO-DRIVE MIGRATION UX

Extract the actual implementation and compare it to the intended safe flow:

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

Document every UI state:

- discovery
- connecting
- destination detection
- existing workspace
- reuse existing workspace
- start new workspace
- review
- confirmation
- copying
- validation
- verification
- success
- failure
- retry
- cancellation

Never design a UI that implies a migration succeeded before destination verification.

---

# 16. LOCAL-ONLY UX

Document:

### Onboarding

Exact required concepts:

> Choose how you want to store your data

Google Drive — Recommended

> Store Penny Pilot data in your own Google Drive.

This Device Only

> Keep Penny Pilot data locally in this browser/device without connecting Google Drive.

### Warning

The user must acknowledge that local-only financial data may be permanently lost if browser/site data is cleared, the device is lost, the browser profile is reset, or the user changes browser/device without a backup.

### Settings

Data & Storage should expose, where implemented:

- storage mode
- Local/Drive status
- last saved/synchronized time
- export backup
- import backup
- switch to Google Drive

Clearly label Local-Only Mode throughout the application.

---

# 17. LOCAL BACKUP / IMPORT UX

Inspect the actual export/import implementation.

Document:

- export entry point
- file format
- version
- file picker
- encryption/password flow if implemented
- validation
- malformed-file behavior
- corrupted-data behavior
- duplicate behavior
- overwrite behavior
- success state
- failure state
- progress state
- import confirmation
- backup responsibility messaging

Backups must never expose:

- passwords
- JWTs
- OAuth tokens
- refresh tokens
- encryption keys
- client secrets
- server secrets

---

# 18. ERROR UX SYSTEM

Inspect all actual backend error handling.

Create a complete error-to-UI mapping.

Known conceptual categories include:

### Authentication

- AUTH_INVALID_CREDENTIALS
- AUTH_SESSION_EXPIRED
- AUTH_UNAUTHORIZED
- AUTH_FORBIDDEN

### Validation

- VALIDATION_INVALID_INPUT
- VALIDATION_REQUIRED_FIELD

### Network

- NETWORK_OFFLINE
- NETWORK_TIMEOUT
- SERVER_UNAVAILABLE
- RATE_LIMITED

### Drive

Inspect actual catalog.

### Local

Inspect actual catalog.

For each actual error code:

| Code | Backend condition | HTTP status | User message | Action | UI component |
|---|---|---|---|---|---|

Do not invent codes that do not exist.

---

# 19. ERROR PRESENTATION RULES

Map errors to UI according to severity:

### Minor operation failure

Toast.

### Form validation

Inline field error.

### Storage failure

Persistent banner/alert.

### Authentication/session issue

Dedicated message and recovery action.

### Critical data/storage issue

Prominent recovery panel.

Every important error should communicate:

1. What happened?
2. Why, when safe?
3. What was affected?
4. What should the user do?
5. Can the operation be retried safely?

For uncertain financial outcomes, the UI should not say "not saved" unless that is known.

Example:

> We couldn't confirm whether this expense was saved. Check Expenses before trying again to avoid creating a duplicate.

---

# 20. SUCCESS / FAILURE / UNKNOWN STATES

For every financial mutation determine whether the UI needs:

```text
SUCCESS
FAILURE
UNKNOWN OUTCOME
```

Document exact UI treatment for each.

Never design a success toast merely because an API request returned without a known persistence guarantee.

---

# 21. FORM DESIGN EXTRACTION

For every form inspect:

- field order
- labels
- placeholders
- helper text
- required/optional
- input type
- min/max
- decimal handling
- date handling
- enums
- conditional fields
- validation messages
- submit state
- duplicate-submit prevention
- cancel behavior
- reset behavior
- optimistic/pessimistic behavior
- error handling
- success behavior

Create a field-level design table:

| Screen | Field | Backend field | Type | Required | Validation | UI control | Help text | Error | Conditional |
|---|---|---|---|---|---|---|---|---|---|

---

# 22. TABLE UX EXTRACTION

For every table/list determine:

- columns
- mobile behavior
- sorting
- filtering
- search
- pagination
- row actions
- bulk actions
- empty state
- loading state
- error state
- delete confirmation
- edit behavior
- expandable rows
- responsive transformation

Do not force desktop financial tables onto small screens if the data requires a mobile card/list representation.

---

# 23. CHART / ANALYTICS UX

Inspect all Recharts/analytics components.

For every chart identify:

- chart type
- data source
- x-axis
- y-axis
- legend
- tooltip
- filters
- date range
- empty state
- no-data state
- loading state
- error state
- mobile behavior
- accessibility alternative

Document what happens if there is no data.

Never instruct designers to create fake/sample financial records merely to make charts look populated.

---

# 24. NAVIGATION ARCHITECTURE

Inspect the actual route tree and current navigation.

Produce:

- information architecture
- sidebar structure
- header structure
- active route states
- nested routes
- mobile navigation
- authenticated vs public navigation
- admin navigation
- dead routes
- redirects
- breadcrumbs if present
- back behavior

Known desired navigation principles:

- clean flat sidebar
- clear active states
- responsive mobile menu
- no dead routes
- keyboard accessibility

Do not invent navigation items that have no corresponding functionality.

---

# 25. SETTINGS INFORMATION ARCHITECTURE

Inventory every settings section.

Potential areas include:

- Profile
- Security
- 2FA
- Passkeys
- Password
- UID
- Data & Storage
- Google Drive
- Notifications
- Customizations
- Theme
- Legal
- Account

For each setting identify:

- current location
- controls
- dependencies
- confirmation requirements
- re-authentication requirements
- dangerous actions
- success/error states

---

# 26. NOTIFICATIONS UX

Inspect:

- notification model
- notification endpoints
- unread/read state
- mark all read
- deletion if present
- pagination if present
- security notifications
- financial notifications

Document:

- notification list
- unread indicators
- timestamps
- grouping
- empty state
- loading
- errors
- action links

---

# 27. ADMIN UX

Inspect all admin routes and components.

Document:

- admin login
- dashboard
- users
- migration status
- system health
- activity/audit logs
- application settings
- platform settings
- diagnostics

Critical rule:

Administrators must never be able to browse ordinary users' financial records.

Document exactly what admins can and cannot see.

Do not design financial-data browsing capabilities for admins if the backend does not permit them.

---

# 28. SECURITY-DRIVEN UI REQUIREMENTS

Extract UI implications from backend security.

Inspect:

- authentication
- authorization
- IDOR protection
- ownership checks
- rate limiting
- CSRF
- CORS
- cookies
- session expiry
- password rules
- 2FA
- passkeys
- OAuth
- token handling
- file upload/import
- error leakage
- sensitive logging

For every security feature state:

- what the user sees
- what the user can do
- what confirmation is required
- what error states exist

Never expose:

- passwords
- OTPs
- JWTs
- OAuth access tokens
- refresh tokens
- API keys
- encryption keys
- database credentials
- stack traces
- SQL
- internal filesystem paths
- sensitive database details
- other users' information

---

# 29. RESPONSIVE DESIGN REQUIREMENTS

The Master Plan explicitly requires testing at:

- 375px
- 390px
- 430px
- desktop

For each screen document responsive behavior.

Verify:

- no horizontal scrolling
- no clipping
- no overlapping controls
- usable forms
- usable charts
- readable financial tables
- touch-friendly controls
- correct viewport scaling

Specify exactly what should collapse, stack, scroll, transform, or disappear at each breakpoint based on the actual UI/data.

---

# 30. ACCESSIBILITY REQUIREMENTS

Extract accessibility implications from the implementation and Master Plan.

Audit:

- semantic HTML
- keyboard navigation
- focus states
- labels
- screen reader semantics
- contrast
- dialogs
- error announcements
- touch target size
- menus
- focus management

Required concepts include:

- skip-to-content
- keyboard-accessible menus
- keyboard-accessible dialogs
- visible focus
- accessible validation errors
- accessible loading states

---

# 31. VISUAL DESIGN SYSTEM EXTRACTION

Inspect the current frontend implementation and extract, do not invent:

- typography
- font families
- font weights
- heading hierarchy
- spacing system
- border radius
- shadows
- cards
- buttons
- inputs
- selects
- dialogs
- badges
- alerts
- toasts
- tables
- tabs
- navigation
- icons
- colors
- light/dark themes
- motion/animation
- hover/focus states

Then recommend a **coherent design-system specification** that preserves existing product identity while fixing inconsistencies.

Clearly separate:

`CURRENTLY IMPLEMENTED`

from:

`DESIGN RECOMMENDATION`

---

# 32. DARK MODE

Inspect the actual theme implementation.

Document:

- light mode
- dark mode
- persistence
- system preference if supported
- contrast
- inputs
- dropdowns
- dialogs
- tables
- charts
- navigation
- status indicators

Pay special attention to form text visibility in dark mode.

---

# 33. MOTION / INTERACTION DESIGN

Inspect Framer Motion and existing transitions.

Document:

- page transitions
- modal animations
- loading transitions
- skeletons
- success animations
- hover states
- expandable content
- reduced-motion considerations

Do not over-animate financial workflows.

Motion must communicate state, not distract from financial information.

---

# 34. LOADING / EMPTY / ERROR / SUCCESS STATE LIBRARY

Build a reusable state catalog.

For each component/page define:

```text
INITIAL
LOADING
SUCCESS WITH DATA
SUCCESS EMPTY
VALIDATION ERROR
AUTH ERROR
PERMISSION ERROR
NETWORK ERROR
STORAGE ERROR
UNKNOWN ERROR
RETRYING
UNKNOWN OUTCOME
```

Specify the correct UI component:

- skeleton
- spinner
- inline message
- toast
- banner
- dialog
- full-page state
- recovery panel

---

# 35. MICROCOPY SYSTEM

Extract existing user-facing copy from frontend/backend.

Then create a centralized UX copy guide.

Include:

- page titles
- subtitles
- button labels
- form labels
- helper text
- confirmation messages
- destructive action warnings
- error messages
- storage warnings
- migration warnings
- success messages
- empty states

Use plain, calm, trustworthy financial language.

Do not expose technical implementation terminology unless necessary.

---

# 36. FINANCIAL DATA PRESENTATION

Determine the correct representation for:

- INR amounts
- positive/negative values
- income
- expense
- balances
- percentages
- dates
- recurring values
- investment returns
- budget utilization
- bill amounts
- goal progress

Document:

- currency formatting
- decimal behavior
- rounding
- sign conventions
- color semantics if currently implemented
- accessible non-color alternatives

Do not change financial calculations during design analysis.

---

# 37. USER JOURNEY MAPS

Produce detailed UX flows for:

1. New user signup
2. Consent acceptance
3. Account creation
4. Google Drive onboarding
5. This Device onboarding
6. Local-only warning
7. First financial record
8. Add expense
9. Add income
10. Create budget
11. Add investment
12. Add bill/EMI
13. Create goal
14. View dashboard
15. Search/filter financial records
16. Edit financial record
17. Delete financial record
18. Export backup
19. Import backup
20. Local → Drive migration
21. Drive → Drive migration
22. Drive full recovery
23. Drive revoked recovery
24. Offline behavior
25. Password recovery
26. OTP recovery
27. Security-question recovery
28. TOTP recovery if supported
29. Password reset
30. Change password
31. Change UID
32. Enable/disable 2FA
33. Passkey setup/removal
34. Notifications
35. Profile changes
36. Logout
37. Session expiry
38. Admin workflows

For each flow provide:

```text
Entry point
↓
User action
↓
UI state
↓
Backend request
↓
Possible response
↓
Next UI state
↓
Failure paths
↓
Recovery action
↓
Completion state
```

---

# 38. SCREEN INVENTORY

Create a definitive screen inventory.

For every screen include:

| Screen | Route | User type | Purpose | Data | Actions | Dependencies | States | Mobile behavior |
|---|---|---|---|---|---|---|---|---|

Separate:

- Public
- Authentication
- Onboarding
- Authenticated user
- Settings
- Recovery
- Admin
- Error/system
- Legal

---

# 39. COMPONENT INVENTORY

Create a reusable component inventory.

Examples:

- App shell
- Sidebar
- Header
- Mobile menu
- Page header
- KPI card
- Chart card
- Data table
- Financial row
- Search
- Filter bar
- Date range picker
- Currency input
- Select
- Modal
- Confirmation dialog
- Toast
- Alert
- Banner
- Empty state
- Skeleton
- Error state
- Recovery panel
- Progress indicator
- Tabs
- Dropdown
- Badge
- Status indicator
- Password input
- OTP input
- Security question selector
- Drive connection card
- Storage mode card
- Migration wizard
- Backup/import panel

Only include components supported by actual requirements or clearly label new recommendations.

---

# 40. UI STATE MATRIX

Create a large matrix:

| Screen/Component | Loading | Empty | Success | Validation Error | Auth Error | Network Error | Storage Error | Unknown Outcome | Recovery |
|---|---|---|---|---|---|---|---|---|---|

This must be exhaustive.

---

# 41. BACKEND → FRONTEND TRACEABILITY

Create a traceability matrix:

| Backend feature | Backend file | Endpoint/service | Data model | Frontend screen | UI component | User action | Current status | Design requirement |
|---|---|---|---|---|---|---|---|---|

This is one of the most important deliverables.

Every significant backend capability should map to a frontend representation.

---

# 42. CURRENT VS REQUIRED VS RECOMMENDED

Every finding must be classified as one of:

### CURRENT
Already implemented.

### PARTIAL
Partially implemented.

### MISSING
Required but not implemented.

### DESIGN RECOMMENDATION
A UX improvement that does not necessarily represent a missing backend feature.

### NOT VERIFIED
Cannot be confirmed from available code.

Do not call a recommendation a requirement.

---

# 43. MASTER PLAN ALIGNMENT

Cross-reference the extracted design requirements against the Penny Pilot Master Implementation Plan.

The Master Plan specifically includes:

- StorageProvider
- Google Drive
- Local IndexedDB
- Local-only onboarding
- local warning
- export/import
- local → Drive migration
- Drive → Drive migration
- global error contract
- error mapping
- financial mutation/retry safety
- security audit
- legal consistency
- consent/PDF
- SEO
- accessibility
- responsive design
- UI/UX
- performance
- testing

The final design specification must show how each of these affects the UI.

The implementation plan's intended UI/UX requirements include:

- dark mode toggle
- sticky header
- responsive mobile menu
- back-to-top
- skip-to-content
- hover states
- skeleton loaders
- empty states
- expandable FAQs where applicable
- toast notifications
- form validation indicators
- password visibility toggle
- copy buttons
- keyboard shortcuts where supported
- mobile optimization
- accessibility improvements
- sidebar
- active navigation states
- responsive collapse
- no dead routes
- meaningful zero-data CTAs
- no fake/sample financial records

---

# 44. LEGAL / CONSENT UX

Inspect actual legal and consent implementation.

Document:

- Terms acceptance
- Privacy acknowledgement
- electronic signature/name
- version displayed
- timestamp
- legal links
- signup state preservation
- consent PDF
- legal version changes

The UI must not claim that a typed name is a cryptographic or qualified digital signature.

The current product direction requires Terms and Privacy to accurately reflect both Google Drive and Local-Only storage.

---

# 45. PRIVACY UX

Document privacy-sensitive UI behavior.

Users should understand:

- financial data storage location
- Google Drive permissions
- local-only risks
- export responsibility
- what data remains server-side
- what admins can see
- what third-party services are involved

The privacy documentation indicates Google Drive uses the `drive.file` scope and Penny Pilot's own workspace rather than unrestricted Drive browsing. Verify the actual implementation before treating this as current UI copy.

---

# 46. PERFORMANCE-DRIVEN UX

Inspect:

- duplicate API calls
- query waterfalls
- caching
- invalidation
- dashboard calculations
- chart rendering
- large payloads
- loading states
- unnecessary re-renders

Document where the UI needs:

- skeletons
- deferred loading
- progressive rendering
- pagination
- virtualization
- caching indicators
- explicit refresh
- stale-data messaging

Financial-data correctness has priority over aggressive caching.

---

# 47. FINAL DESIGN DELIVERABLE

Create a single Markdown file:

`PENNY_PILOT_BACKEND_UI_UX_DESIGN_SPEC.md`

The document must contain:

1. Executive summary
2. Product overview
3. Architecture overview
4. Backend architecture
5. Data architecture
6. Storage modes
7. Complete route inventory
8. Complete API inventory
9. Complete Prisma/data-model inventory
10. Financial module specifications
11. Dashboard data mapping
12. Authentication UX
13. Account recovery UX
14. Google Drive UX
15. Local-Only UX
16. Backup/import UX
17. Migration UX
18. Error system
19. Error-to-UI matrix
20. Form specification
21. Table specification
22. Chart specification
23. Navigation architecture
24. Settings architecture
25. Notifications
26. Admin UX
27. Security-driven UX
28. Responsive requirements
29. Accessibility requirements
30. Dark mode
31. Motion/interaction
32. Loading/empty/error/success states
33. Microcopy guide
34. Financial data presentation rules
35. User journey maps
36. Screen inventory
37. Component inventory
38. UI state matrix
39. Backend-to-frontend traceability
40. Current vs Partial vs Missing vs Recommended
41. Master Plan alignment
42. Legal/consent UX
43. Privacy UX
44. Performance UX
45. Open questions
46. Design decisions required
47. Final implementation priorities

---

# 48. DEPTH REQUIREMENT

Do NOT produce a shallow summary.

The objective is to extract **each and every UI/UX-relevant detail that can reasonably be discovered from the codebase**.

Inspect:

- every route
- every controller
- every service
- every Prisma model
- every enum
- every validation schema
- every middleware affecting UX
- every response type
- every error path
- every frontend API call
- every financial form
- every hook
- every table
- every chart
- every modal
- every settings screen
- every auth flow
- every Drive flow
- every local-storage flow

Follow references across files until the behavior is understood.

Do not stop after finding the first relevant file.

---

# 49. IMPORTANT: DO NOT IMPLEMENT

This task is an **analysis and documentation task only**.

Do not:

- edit application code
- edit backend code
- edit frontend code
- change Prisma schema
- create migrations
- apply migrations
- change environment variables
- change secrets
- deploy
- commit
- push
- delete data
- modify production
- modify user data

You may run read-only inspection commands, searches, type/reference analysis, and safe static analysis.

---

# 50. GIT / SAFETY

Before analysis run:

```text
git status
git branch
git log -n 10
```

Do not alter the working tree.

Do not automatically commit, push, or deploy.

Preserve all existing work.

---

# 51. REPORTING DISCIPLINE

Every factual claim must be traceable to:

- file path
- route
- function
- model
- component
- relevant line/range where practical

Use exact source references throughout the generated Markdown.

For example:

```text
Backend:
backend/src/routes/auth.routes.ts
POST /forgot-password
```

Do not fabricate line numbers.

---

# 52. PRIORITY CLASSIFICATION

Classify design requirements as:

- CRITICAL
- HIGH
- MEDIUM
- LOW
- CURRENT
- PARTIAL
- MISSING
- DESIGN RECOMMENDATION
- NOT VERIFIED

---

# 53. FINAL EXECUTION INSTRUCTION

Work continuously until the entire repository has been analyzed and the Markdown design specification has been generated.

Do not stop midway to ask what to inspect next.

If you encounter ambiguity:

1. inspect more code;
2. search related routes/models/components;
3. cross-reference the Master Plan;
4. record the ambiguity if still unresolved;
5. continue with the rest of the analysis.

Do not pause merely because the repository is large.

Only stop when the final Markdown specification is complete.

At the end, provide:

```text
ANALYSIS COMPLETE

Output:
PENNY_PILOT_BACKEND_UI_UX_DESIGN_SPEC.md

Repository coverage:
- Backend routes: X
- Prisma models: X
- Frontend routes/screens: X
- Financial modules: X
- API endpoints mapped: X
- Forms mapped: X
- UI states mapped: X
- Error codes mapped: X

Status:
COMPLETE / PARTIAL

Unverified areas:
[list]

Critical design decisions:
[list]
```

The resulting document is intended to be handed directly to a professional frontend/UI/UX team as the **source specification for designing the Penny Pilot website/application**.

Do not design a generic finance dashboard.

Design Penny Pilot from its **real backend contracts, real product requirements, real security model, real storage architecture, and real user workflows**.
