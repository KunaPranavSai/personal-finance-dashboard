````markdown
# PENNY PILOT — COMPLETE PRE-USER AUDIT
## Codebase + Connections + Dead Features + Runtime + User Experience

You are performing a **COMPLETE pre-implementation audit** of the Penny Pilot application.

This is an **AUDIT ONLY**.

Your objective is to discover EVERYTHING that is:

- broken
- disconnected
- unused
- dead
- incomplete
- incorrectly wired
- duplicated
- obsolete
- unreachable
- inconsistently implemented
- incorrectly integrated
- visually broken
- functionally broken
- producing console/network errors
- implemented in frontend but missing backend support
- implemented in backend but unused by frontend
- referenced but missing
- present in navigation but not functional
- functional in code but inaccessible to users
- incorrectly connected to Google Drive
- incorrectly connected to authentication
- incorrectly connected to APIs
- incorrectly connected to database models
- incorrectly connected to state management
- likely to cause production issues

## IMPORTANT — DO NOT MODIFY THE PROJECT

Do **NOT**:

- Modify existing code
- Create new features
- Refactor code
- Delete files
- Rename files
- Modify database schema
- Run database migrations
- Modify Google Drive data
- Change environment variables
- Change production configuration
- Commit changes
- Push changes
- Deploy anything

The **ONLY file you may create** is:

`USER_SIDE_COMPLETE_AUDIT.md`

The purpose of this audit is to understand the current state of Penny Pilot before we begin implementation work.

---

# 1. TEST ACCOUNT

Use this dedicated test account for authenticated user-side testing:

**Email:** `auditestuser01@gmail.com`

**Password:** `Audit Test User 01`

### Rules

- Treat this as a disposable audit/test account.
- Do not change its password.
- Do not delete the account.
- Do not disconnect Google Drive unless absolutely necessary.
- Do not delete financial data.
- Do not intentionally corrupt data.
- Do not create large amounts of unnecessary test data.
- If testing requires creating data, create the minimum possible and document it.
- Never expose the password in the audit report.
- Never expose OAuth tokens, JWTs, refresh tokens, API keys, encryption keys, client secrets, or other credentials.
- Do not perform destructive security testing.

---

# 2. PROJECT DISCOVERY

Before testing anything, thoroughly inspect the repository.

Understand:

- Frontend architecture
- Backend architecture
- Routing
- API routes
- Controllers
- Services
- Database schema
- Prisma models
- Google Drive services
- Authentication
- Middleware
- Hooks
- Context/providers
- State management
- UI components
- Pages
- Layouts
- Utilities
- Types/interfaces
- Charts
- Forms
- Validation
- Configuration
- Environment variable usage

Build a clear understanding of how the application is actually connected.

Do not assume that filenames indicate functionality.

Trace actual imports and usage.

---

# 3. FRONTEND ↔ BACKEND CONNECTION AUDIT

This is one of the highest-priority sections.

Find **every frontend API call**.

For each API call determine:

- Frontend location
- HTTP method
- Endpoint
- Request body
- Expected response
- Actual backend route
- Controller
- Service
- Database/Google Drive operation
- Authentication requirement
- Error handling

Look for:

- Endpoint does not exist
- Wrong URL
- Wrong HTTP method
- Wrong request body
- Wrong response shape
- Renamed fields
- Outdated frontend types
- Missing authentication
- Incorrect auth headers
- Wrong environment URL
- Hard-coded localhost
- Old Vercel URLs
- Old Render URLs
- Stale API paths
- Frontend calling deleted backend functionality
- Backend functionality with no frontend consumer
- Frontend functionality with no backend implementation

Create this matrix:

| Frontend Feature | API | Backend Route | Controller/Service | Status | Problem |
|---|---|---|---|---|---|

---

# 4. FRONTEND ROUTE AUDIT

Enumerate **EVERY frontend route**.

For each route determine:

- Does it exist?
- Is it reachable?
- Is it linked from navigation?
- Is it protected?
- Is it public?
- What role is expected?
- Does it work?
- Is it orphaned?
- Is it duplicated?
- Is it obsolete?
- Is it incomplete?

Find:

- Pages not linked anywhere
- Pages linked but removed
- Routes returning 404
- Routes redirecting incorrectly
- Dead navigation items
- Duplicate pages
- Old pages
- Components referencing removed routes

Create:

| Route | Reachable | Navigation | Auth | Status | Notes |
|---|---|---|---|---|---|

---

# 5. NAVIGATION AUDIT

Inspect:

- Sidebar
- Header
- Mobile navigation
- Dropdown navigation
- Breadcrumbs
- Dashboard shortcuts
- Internal links
- Action buttons that navigate

For every navigation item verify that the destination actually exists.

Find:

- Dead links
- Incorrect paths
- Duplicate links
- Inaccessible features
- Links to removed functionality
- Links to unfinished pages
- Navigation items with no implementation

---

# 6. BACKEND API AUDIT

Enumerate every backend endpoint.

For each determine:

- Route
- HTTP method
- Authentication
- Role
- Controller
- Service
- Data source
- Frontend consumer
- Status

Find:

- Unused APIs
- Duplicate APIs
- Obsolete APIs
- Routes with no frontend consumer
- Frontend calls with no backend route
- Endpoints referencing deleted services
- Dead controllers
- Dead services
- Inconsistent response structures
- Inconsistent error handling

---

# 7. DEAD CODE AUDIT

Find code that appears unused.

Inspect:

- Components
- Pages
- Hooks
- Utilities
- Services
- Controllers
- Middleware
- Types
- Constants
- Schemas
- Helper functions
- API clients
- Old exports

For each suspected dead item classify it as:

- **CONFIRMED UNUSED**
- **LIKELY UNUSED**
- **USED INDIRECTLY**
- **UNCERTAIN**

Do NOT delete anything.

Pay particular attention to code left behind after previous architecture changes and admin redesigns.

---

# 8. UNUSED / INCOMPLETE FEATURE AUDIT

Identify features that are:

### A. Fully implemented and working
### B. Partially implemented
### C. Implemented but inaccessible
### D. Frontend-only
### E. Backend-only
### F. UI placeholder
### G. Dead/obsolete
### H. Broken

Look specifically for:

- Buttons that do nothing
- Dropdowns with no effect
- Filters that don't actually filter
- Search fields that don't search
- Export buttons that don't work
- Forms that don't submit
- Tabs that don't change content
- Modals that don't perform actions
- Notification controls that don't work
- Settings that aren't persisted
- Charts with fake/static data
- Dashboard cards with hard-coded values
- TODO/placeholder functionality
- Features visible in UI but not actually implemented

---

# 9. BUTTON / INTERACTION AUDIT

Inspect important interactive elements.

Find:

- `onClick` with no meaningful implementation
- Disabled buttons without explanation
- Buttons pointing to wrong handlers
- Submit buttons that don't submit
- Delete buttons without confirmation
- Edit buttons that don't load data
- Save buttons that don't persist
- Cancel buttons that don't restore state
- Dropdown actions that don't work
- Modal actions that don't work
- Links that appear clickable but have no action

---

# 10. DATA FLOW AUDIT

Trace important user data through the complete chain:

```text
USER ACTION
    ↓
FRONTEND STATE
    ↓
API REQUEST
    ↓
BACKEND ROUTE
    ↓
CONTROLLER
    ↓
SERVICE
    ↓
GOOGLE DRIVE / DATABASE
    ↓
RESPONSE
    ↓
FRONTEND STATE
    ↓
UI
````

Perform this analysis for:

* Authentication
* Profile
* Transactions
* Income
* Expenses
* Categories
* Budgets
* Savings
* Investments
* Bills/EMIs
* Financial Goals
* Analytics
* Reports
* Notifications
* Settings
* Google Drive connection
* Migration

Identify exactly where any data flow is broken.

---

# 11. GOOGLE DRIVE INTEGRATION AUDIT

Audit all Google Drive-related code.

Trace:

```text
OAuth
↓
Callback
↓
Token handling
↓
Drive connection
↓
Workspace setup
↓
Manifest
↓
Collections
↓
Reads
↓
Writes
↓
Migration
↓
Verification
↓
Disconnect
↓
Reconnect
↓
Account change
```

Look for:

* Unused Drive services
* Old backup architecture
* References to removed backup functionality
* Incorrect collection names
* Stale data models
* Frontend/backend mismatch
* Failure handling problems
* Missing retry behavior
* Incorrect connection status
* Obsolete PostgreSQL financial-data assumptions
* Dead Drive-related components
* Broken Drive-related routes

Do NOT modify Drive data.

---

# 12. AUTHENTICATION AUDIT

Trace:

```text
Signup
↓
Password handling
↓
Login
↓
JWT/session
↓
Protected routes
↓
Logout
↓
Session persistence
```

Check:

* Frontend/backend mismatch
* Stale auth code
* Unused auth utilities
* Incorrect redirects
* Protected routes without protection
* User routes accidentally accessible without authentication
* Admin routes accessible by normal users
* Logout inconsistencies
* Expired session handling
* Broken authentication states

Perform only safe authorization checks.

---

# 13. DATABASE ↔ APPLICATION AUDIT

Inspect Prisma schema and actual application usage.

Find:

* Unused models
* Unused fields
* References to deleted models
* References to deleted fields
* Stale Prisma queries
* Fields expected by frontend but no longer present
* Database structures that no longer match architecture
* Obsolete backup structures
* User financial data that appears unnecessarily persisted in PostgreSQL

Remember the intended architecture:

```text
USER FINANCIAL DATA
        ↓
USER'S GOOGLE DRIVE
```

and:

```text
MINIMAL AUTH / ACCOUNT /
ADMIN OPERATIONAL DATA
        ↓
POSTGRESQL
```

Do NOT change the schema.

---

# 14. ENVIRONMENT / CONFIGURATION AUDIT

Inspect code references to environment variables.

Find:

* Required variables
* Unused variables
* Missing variables
* Localhost references
* Old deployment URLs
* Hard-coded URLs
* Old Vercel domains
* Incorrect production URLs
* Development-only configuration accidentally used in production
* Inconsistent frontend/backend configuration

NEVER print secret values.

Only report:

* Variable name
* Where it is used
* Whether it appears required
* Whether it appears unused/missing

---

# 15. TYPESCRIPT / STATIC CODE AUDIT

Inspect for:

* TypeScript errors
* Unsafe `any`
* Nullability problems
* Incorrect interfaces
* Mismatched API types
* Stale types
* Impossible states
* Unused imports
* Unused variables
* Unreachable code
* Suspicious casts
* TODO markers
* FIXME markers

Run safe checks if available:

```text
typecheck
lint
production build
```

Do NOT modify code to make checks pass.

---

# 16. RUNTIME AUDIT

Run the application if possible.

Check:

* Application startup
* Frontend build
* Backend startup
* API availability
* Browser console
* Network requests
* Runtime exceptions
* 404 responses
* 401 responses
* 403 responses
* 500 responses
* Hydration errors
* Failed assets
* CORS
* Broken API calls

Distinguish genuine production problems from expected development warnings.

---

# 17. TEST ACCOUNT USER JOURNEY

Use:

`auditestuser01@gmail.com`

for safe authenticated testing.

Test:

1. Login
2. Dashboard
3. Navigation
4. Transactions
5. Income
6. Expenses
7. Budget Planner
8. Savings
9. Investments
10. Bills/EMIs
11. Financial Goals
12. Analytics
13. Reports
14. Notifications
15. Settings
16. Profile
17. Logout
18. Login again

Only test modules that actually exist.

Do not unnecessarily create or delete financial records.

---

# 18. DASHBOARD AUDIT

Pay special attention to the Dashboard.

Check:

* KPI accuracy
* Income
* Expenses
* Savings
* Balance/net worth
* Budgets
* Goals
* Bills/EMIs
* Investments
* Charts
* Recent transactions
* Financial insights
* Date/month selection
* Financial year handling
* Empty account state

Verify that the dashboard does NOT display fake/sample financial data.

Verify that displayed numbers are backed by actual user data.

Look for:

* `NaN`
* `undefined`
* `null`
* Incorrect zero handling
* Broken charts
* Incorrect percentages
* Divide-by-zero
* Stale values
* Incorrect totals
* Mismatched date ranges

---

# 19. TRANSACTIONS AUDIT

Test the transaction workflow carefully.

Check:

* Add transaction
* Edit transaction
* Delete transaction
* Income/expense classification
* Category selection
* Date
* Amount
* Description/notes
* Validation
* Duplicate handling
* Missing category handling
* Large amounts
* Decimal amounts
* Zero amounts
* Invalid amounts
* Future dates if allowed
* Search
* Filtering
* Sorting
* Mobile usability

A missing/null category must never crash the UI.

---

# 20. FINANCIAL LOGIC AUDIT

Verify:

* INR
* Indian number formatting
* DD-MM-YYYY
* April–March financial year
* Monthly calculations
* Yearly calculations
* Income totals
* Expense totals
* Savings calculations
* Budget calculations
* Percentages
* Chart calculations

Look for:

* NaN
* Null
* Undefined
* Division by zero
* Incorrect rounding
* Incorrect date boundaries
* Duplicate aggregation
* Stale values
* Hard-coded financial values

---

# 21. UI / UX AUDIT

Evaluate whether the user side feels like one professional SaaS product.

Check:

* Sidebar
* Header
* Cards
* Buttons
* Forms
* Tables
* Charts
* Dialogs
* Tabs
* Badges
* Typography
* Spacing
* Colors
* Loading states
* Empty states
* Error states
* Success feedback

Look for pages that feel like they belong to different applications.

---

# 22. RESPONSIVE AUDIT

Inspect approximately:

* 1440px desktop
* 1280px desktop
* 1024px tablet
* 768px tablet
* 430px mobile
* 390px mobile
* 375px mobile

Look for:

* Horizontal scrolling
* Broken tables
* Clipped text
* Oversized cards
* Unusable filters
* Inaccessible buttons
* Modal overflow
* Navigation problems
* Sidebar problems
* Charts overflowing
* Forms becoming unusable
* Poor mobile spacing
* Touch-target problems

---

# 23. ACCESSIBILITY AUDIT

Check:

* Keyboard navigation
* Focus states
* Form labels
* Button names
* Icon-only controls
* Contrast
* Semantic headings
* Modal behavior
* Error messaging
* Accessible interaction patterns

Report meaningful issues rather than theoretical nitpicks.

---

# 24. PERFORMANCE AUDIT

Inspect:

* Unnecessary API calls
* Duplicate requests
* Excessive re-renders
* Large client-side processing
* Dashboard loading
* Image/font problems
* Large bundles where obvious
* Slow interactions
* Loading waterfalls
* Unnecessary polling
* Expensive chart calculations

Do not optimize anything.

---

# 25. SECURITY / DATA EXPOSURE AUDIT

Perform SAFE inspection only.

Look for:

* Credentials accidentally exposed in frontend
* Secrets committed to source
* OAuth secrets in client code
* Tokens exposed to UI
* Financial records exposed through admin APIs
* Missing authentication on user endpoints
* Missing authorization
* Insecure route assumptions

Do NOT perform destructive penetration testing.

Never print actual secrets/tokens/passwords.

---

# 26. DUPLICATION / LEGACY CODE AUDIT

Identify:

* Duplicate components
* Duplicate APIs
* Duplicate utilities
* Duplicate business logic
* Duplicate pages
* Multiple implementations of the same feature
* Old architecture mixed with new architecture
* Legacy backup code
* Obsolete admin code
* Unused migration code
* Old user-side implementations

Do NOT clean them up.

---

# 27. PRODUCT QUALITY AUDIT

Think like a real Penny Pilot customer.

Ask:

> Would I trust this application with my personal finances?

> Would I understand what every number means?

> Could I complete common tasks without instructions?

> Would I know what happened if something failed?

> Does the application feel like a professional SaaS product?

> Are there places where the user has to think too much?

Identify concrete friction points.

---

# 28. ISSUE CLASSIFICATION

Every finding must have:

### Severity

* **P0 — Critical**
* **P1 — High**
* **P2 — Medium**
* **P3 — Low**

### Type

* BROKEN
* DISCONNECTED
* DEAD CODE
* UNUSED FEATURE
* INCOMPLETE
* DUPLICATE
* SECURITY
* DATA
* FINANCIAL LOGIC
* UX
* UI
* PERFORMANCE
* CONFIGURATION
* ACCESSIBILITY

### Confidence

* CONFIRMED
* LIKELY
* POSSIBLE / NEEDS VERIFICATION

Do not present assumptions as confirmed bugs.

---

# 29. FINAL REPORT

Create ONLY:

`USER_SIDE_COMPLETE_AUDIT.md`

Use this structure:

```markdown
# Penny Pilot — Complete User-Side Audit

## 1. Executive Summary

## 2. Architecture Understanding

## 3. Frontend ↔ Backend Connection Matrix

## 4. Frontend Route Audit

## 5. Navigation Audit

## 6. Backend API Audit

## 7. Dead Code Audit

## 8. Unused Feature Audit

## 9. Broken Interaction Audit

## 10. Data Flow Audit

## 11. Google Drive Integration Audit

## 12. Authentication Audit

## 13. Database/Application Audit

## 14. Environment/Configuration Audit

## 15. TypeScript/Static Analysis

## 16. Runtime Findings

## 17. User Journey Results

## 18. Module-by-Module Results

## 19. Dashboard Audit

## 20. Transactions Audit

## 21. Financial Logic Findings

## 22. UI/UX Findings

## 23. Responsive Findings

## 24. Accessibility Findings

## 25. Performance Findings

## 26. Security/Data Exposure Findings

## 27. Duplication/Legacy Code Findings

## 28. What Is Already Working

## 29. What Can Be Safely Removed Later

## 30. What Is Missing

## 31. Critical Bugs

## 32. Recommended Fix Roadmap

### P0 — Fix Immediately

### P1 — Fix Before Launch

### P2 — Improve Next

### P3 — Polish Later

## 33. Suggested Implementation Order

## 34. Final Verdict
```

For every important issue use:

```markdown
### ISSUE-001 — Short Title

**Severity:** P1  
**Type:** DISCONNECTED  
**Confidence:** CONFIRMED  
**Location:** `path/to/file`

**Evidence:**  
Explain exactly what was discovered.

**Steps to reproduce:**
1. ...
2. ...
3. ...

**Expected:**  
...

**Actual:**  
...

**Impact:**  
...

**Recommended action:**  
...
```

---

# 30. POSITIVE FINDINGS

Do not make the report purely negative.

Document systems that were actually tested and confirmed working.

Examples:

* Authentication works
* Drive connection works
* Dashboard loads
* API integration works
* Financial calculations work
* Responsive layout works
* Error handling works

Only report something as working if you actually verified it.

---

# 31. REMOVAL CANDIDATES

Create a separate list of things that appear safe to remove later:

| Item | Location | Why It Appears Unused | Confidence | Recommendation |
| ---- | -------- | --------------------- | ---------- | -------------- |

Do NOT remove them during this audit.

---

# 32. CONNECTION FAILURES

Create a dedicated table:

| ID | Frontend | Backend | Expected Connection | Actual State | Severity |
| -- | -------- | ------- | ------------------- | ------------ | -------- |

This section is especially important.

---

# 33. FINAL ROADMAP

Create the most efficient implementation order.

Do NOT simply sort issues by severity.

Group related changes together.

For example:

```text
Phase 1
├── Fix broken API connections
├── Fix shared API client
└── Fix authentication/session issues

Phase 2
├── Remove dead navigation
├── Repair broken interactions
└── Complete partially implemented workflows

Phase 3
├── Dashboard improvements
├── Transactions improvements
└── Budget improvements

Phase 4
├── UI consistency
├── Mobile polish
└── Accessibility

Phase 5
├── Analytics
├── Reports
└── Final production polish
```

Create the roadmap based on what you ACTUALLY discover.

---

# 34. FINAL VERDICT

Choose exactly ONE:

* **PRODUCTION READY**
* **NEARLY PRODUCTION READY**
* **NEEDS SIGNIFICANT WORK**
* **NOT PRODUCTION READY**

Explain the decision using evidence from the audit.

---

# 35. FINAL TERMINAL SUMMARY

After creating the report, print only a concise summary:

```text
PENNY PILOT — USER-SIDE AUDIT COMPLETE

Total findings:
P0:
P1:
P2:
P3:

Broken connections:
Dead/unused items:
Incomplete features:
Runtime errors:
Financial logic issues:
Security findings:

Top 10 Issues:

1.
2.
3.
4.
5.
6.
7.
8.
9.
10.

Overall Verdict:
```

---

# ABSOLUTE RULE

THIS IS AN AUDIT.

DO NOT FIX ANYTHING.

DO NOT MODIFY EXISTING FILES.

DO NOT DELETE ANYTHING.

DO NOT REFACTOR ANYTHING.

DO NOT MODIFY DATABASE.

DO NOT MODIFY GOOGLE DRIVE DATA.

DO NOT CHANGE ENVIRONMENT VARIABLES.

DO NOT COMMIT.

DO NOT PUSH.

DO NOT DEPLOY.

The ONLY file you may create is:

`USER_SIDE_COMPLETE_AUDIT.md`

The goal is to produce a **complete technical + functional + UX map of the current Penny Pilot user side**, so that implementation can begin from verified findings rather than assumptions.

```
```
