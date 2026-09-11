# PENNY PILOT — USER-SIDE BUG HUNT & IMMEDIATE FIX

You are now working on Penny Pilot's USER SIDE.

The previous audit confirmed that the underlying frontend/backend wiring is generally healthy, but the authenticated user experience was NOT sufficiently tested.

We now know there are real user-side bugs/glitches such as:

- Profile/name update not actually updating
- UI showing a successful action while data does not persist
- Forms behaving incorrectly
- State not refreshing after updates
- Values reverting after page refresh
- Buttons/actions appearing to work but backend data remaining unchanged
- UI inconsistencies
- Broken loading/error/success states
- Other similar user-facing bugs

Your task is now:

> FIND AND FIX USER-SIDE BUGS IMMEDIATELY.

This is NOT another documentation-only audit.

You MUST inspect, reproduce, diagnose, fix, and verify issues.

==================================================
# 1. TEST ACCOUNT
==================================================

Use the dedicated test account:

Email:
auditestuser01@gmail.com

Password:
Audit Test User 01

IMPORTANT:

- Use this account only for testing.
- Do not change its password.
- Do not delete the account.
- Do not disconnect Google Drive unless absolutely necessary.
- Do not intentionally corrupt data.
- Avoid creating unnecessary financial records.
- Use small, controlled test values.
- Never expose credentials, tokens, secrets, or OAuth data in logs or reports.

If data must be created to test a CRUD workflow, create the minimum required test record and clean it up safely afterward.

==================================================
# 2. PRIMARY OBJECTIVE
==================================================

Do NOT assume that a feature works because:

- the API exists
- the button exists
- the request returns 200
- the UI displays a success message
- TypeScript passes
- the component renders

A feature is considered WORKING only if:

USER ACTION
→ API REQUEST
→ BACKEND PROCESSING
→ DATA PERSISTENCE
→ UI STATE UPDATE
→ PAGE REFRESH
→ DATA STILL CORRECT

Verify the entire lifecycle.

==================================================
# 3. FIRST — READ THE PREVIOUS AUDIT
==================================================

Read:

USER_SIDE_COMPLETE_AUDIT.md

Use it as background context.

Important findings from that audit:

- Frontend/backend connections were generally found intact.
- TypeScript builds passed.
- No confirmed dead frontend components were found.
- No confirmed runtime errors were found in the unauthenticated areas.
- Authenticated user-side testing was incomplete.
- Several low-priority cleanup items were identified.

DO NOT assume the previous audit means the user-side UI is bug-free.

The purpose of this task is to uncover bugs through REAL INTERACTION.

==================================================
# 4. DO NOT BLINDLY REDESIGN
==================================================

Do NOT perform a broad redesign.

Do NOT change the application's visual identity unless required to fix a bug.

Do NOT rewrite working components unnecessarily.

Do NOT refactor unrelated code.

Fix actual problems discovered during testing.

Prioritize correctness and reliability over cosmetic changes.

==================================================
# 5. FULL AUTHENTICATED USER JOURNEY
==================================================

Log into the application and test the complete user journey.

Test:

1. Login
2. Dashboard
3. Sidebar/navigation
4. Profile
5. Settings
6. Transactions
7. Income
8. Expenses
9. Categories
10. Accounts
11. Payment methods
12. Budget Planner
13. Savings
14. Investments
15. Bills/EMIs
16. Financial Goals
17. Analytics
18. Reports
19. Notifications
20. Google Drive connection/status
21. Logout
22. Login again

Only test modules that actually exist.

==================================================
# 6. PROFILE — DEEP TEST
==================================================

START HERE.

Test the user's profile completely.

Especially test:

- Name update
- Email display
- Profile information
- Avatar/profile image if implemented
- Save button
- Cancel button
- Loading state
- Success state
- Error state

For NAME UPDATE specifically:

1. Record current name.
2. Change name to a temporary test value.
3. Click Save.
4. Verify API request.
5. Verify backend response.
6. Navigate away.
7. Return to Profile.
8. Refresh browser.
9. Check whether the new name remains.
10. Check dashboard/header/sidebar/profile display.
11. Log out.
12. Log back in if safe.
13. Verify the name still persists.

If it does not persist:

TRACE THE COMPLETE DATA FLOW.

Find exactly where the failure occurs:

Frontend form
→ local state
→ API request
→ backend route
→ controller
→ Prisma/service
→ database
→ response
→ frontend cache/state
→ rendered UI

Then FIX THE ROOT CAUSE.

Do NOT simply force the UI to display the new value.

The persisted source of truth must actually be updated.

==================================================
# 7. CRUD TESTING
==================================================

For EVERY financial CRUD module, test:

CREATE
READ
UPDATE
DELETE

For example:

Transactions:
- Create
- Verify
- Refresh
- Edit
- Refresh
- Delete
- Verify deletion

Repeat for:

- Income
- Expenses
- Categories
- Accounts
- Payment Methods
- Budgets
- Savings
- Investments
- Bills/EMIs
- Goals

Do not create excessive data.

Use one controlled temporary record at a time.

==================================================
# 8. THE "REFRESH TEST"
==================================================

This is extremely important.

After EVERY important mutation:

- Save
- Refresh
- Navigate away and return
- Check whether the change remains

A UI is NOT considered fixed merely because it updates instantly.

Examples:

Name:
Save → Refresh → name remains

Transaction:
Create → Refresh → transaction remains

Budget:
Update → Refresh → new value remains

Goal:
Update → Refresh → new value remains

Settings:
Change → Refresh → setting remains

==================================================
# 9. THE "RE-LOGIN TEST"
==================================================

For important account-level changes:

1. Perform change.
2. Verify immediately.
3. Refresh.
4. Navigate away.
5. Logout.
6. Login again.
7. Verify again.

This catches frontend-only state bugs.

==================================================
# 10. FORM BUG HUNT
==================================================

Inspect every user-facing form.

Test:

- Empty submission
- Valid submission
- Invalid submission
- Required fields
- Optional fields
- Zero
- Negative values
- Decimal values
- Large values
- Very long text
- Special characters
- Date input
- Dropdown selection
- Cancel
- Save
- Double-click Save
- Submit while loading
- API failure

Look for:

- Form doesn't submit
- Form submits twice
- Form closes without saving
- Success message appears without persistence
- Incorrect validation
- Validation doesn't clear
- Error messages disappear
- Loading state missing
- Buttons remain enabled during submission
- Modal closes before request finishes
- Stale values after editing

FIX CONFIRMED BUGS.

==================================================
# 11. STALE STATE / CACHE BUG HUNT
==================================================

Pay special attention to TanStack Query/state synchronization.

After:

CREATE
UPDATE
DELETE

check whether:

- list updates
- dashboard updates
- counts update
- charts update
- totals update
- sidebar/header values update
- related pages update

Look for:

- missing query invalidation
- stale cached data
- optimistic updates that are incorrect
- UI reverting after refresh
- multiple components showing different values

Fix the underlying state synchronization.

==================================================
# 12. DASHBOARD BUG HUNT
==================================================

Test the Dashboard using the test account.

Check:

- KPIs
- totals
- income
- expenses
- savings
- balance
- budgets
- goals
- investments
- bills
- recent transactions
- charts
- trends
- category breakdowns

Create minimal test data if required.

Verify that dashboard values change correctly after transactions are created/updated/deleted.

Look for:

- incorrect totals
- stale totals
- wrong percentages
- broken charts
- NaN
- undefined
- null
- wrong dates
- wrong month
- wrong financial year
- inconsistent numbers between pages

FIX confirmed problems.

==================================================
# 13. TRANSACTIONS BUG HUNT
==================================================

Test:

- Create expense
- Create income
- Edit
- Delete
- Category
- Date
- Amount
- Description
- Search
- Filter
- Sort
- Pagination if available

Verify the transaction:

1. Appears after creation.
2. Remains after refresh.
3. Can be edited.
4. Updated value persists.
5. Can be deleted.
6. Disappears after deletion.
7. Dashboard reflects the change.

Check null/missing categories.

No transaction should crash the application.

==================================================
# 14. INCOME / EXPENSE BUG HUNT
==================================================

Test the complete workflow.

Check:

- Forms
- Categories
- Amounts
- Dates
- Persistence
- Editing
- Deletion
- Totals
- Dashboard integration
- Analytics integration

Ensure income and expense calculations are consistent everywhere.

==================================================
# 15. BUDGET BUG HUNT
==================================================

Test:

- Create budget
- Edit budget
- Delete budget
- Category selection
- Month/year
- Amount
- Progress
- Remaining amount
- Percentage

Then create a matching expense and verify budget utilization changes.

Check:

- 0%
- partial usage
- 100%
- over-budget

Ensure percentages never produce NaN or invalid values.

==================================================
# 16. SAVINGS BUG HUNT
==================================================

Test:

- Display
- Data loading
- Calculations
- Updates if supported
- Dashboard integration

Check whether values remain correct after refresh.

==================================================
# 17. INVESTMENTS BUG HUNT
==================================================

Test:

- Create
- Edit
- Delete
- Amount/value fields
- Dates
- Categories/types
- Returns if implemented
- Dashboard integration
- Analytics

Verify persistence after refresh.

==================================================
# 18. BILLS / EMI BUG HUNT
==================================================

Test:

- Create bill/EMI
- Edit
- Delete
- Amount
- Due date
- Recurring behavior if implemented
- Status
- Dashboard display

Check date handling carefully.

==================================================
# 19. GOALS BUG HUNT
==================================================

Test:

- Create goal
- Edit goal
- Delete goal
- Target amount
- Current amount
- Target date
- Progress

Verify progress calculations.

==================================================
# 20. ANALYTICS BUG HUNT
==================================================

Verify analytics against actual transaction data.

Check:

- Monthly totals
- Category breakdown
- Income vs expenses
- Savings
- Trends
- Date ranges
- Empty states

Compare analytics values against the underlying records.

If numbers don't match, trace the calculation and FIX it.

==================================================
# 21. REPORTS BUG HUNT
==================================================

Test available reports.

Check:

- Monthly report
- Categories report
- Budget report
- Filters
- Date ranges
- Data accuracy
- Empty states
- Loading
- Errors
- Export if available

Ensure reports don't display stale or incorrect data.

==================================================
# 22. NOTIFICATIONS BUG HUNT
==================================================

Test:

- Load notifications
- Read/unread
- Mark read
- Delete if supported
- Empty state
- Badge count

Verify state after refresh.

==================================================
# 23. SETTINGS BUG HUNT
==================================================

Test every user-facing setting.

For each setting:

1. Record current value.
2. Change it.
3. Save.
4. Refresh.
5. Verify persistence.
6. Navigate away.
7. Return.
8. Verify again.

Look for UI settings that only change local state but never persist.

==================================================
# 24. GOOGLE DRIVE USER EXPERIENCE
==================================================

Safely inspect:

- Connection state
- Connected state
- Disconnected state
- Loading
- Error
- Retry
- Reconnect
- Account change

Do not intentionally revoke or corrupt access unless a safe existing test path allows it.

Check whether Drive status shown in the UI accurately reflects backend state.

==================================================
# 25. NAVIGATION BUG HUNT
==================================================

Click every user-side navigation item.

Verify:

- Correct destination
- Correct active state
- Correct page title
- No 404
- No blank page
- No redirect loop
- No incorrect authentication redirect
- Browser back works
- Browser forward works

Test mobile navigation too.

==================================================
# 26. MOBILE BUG HUNT
==================================================

Test approximately:

- 375px
- 390px
- 430px
- 768px
- desktop

Look for:

- horizontal scrolling
- broken sidebar
- clipped buttons
- modal overflow
- tables breaking
- charts overflowing
- forms becoming unusable
- text clipping
- inaccessible controls

FIX confirmed functional/responsive bugs.

Do not redesign the entire mobile UI.

==================================================
# 27. LOADING STATE BUG HUNT
==================================================

Every asynchronous operation should have appropriate feedback.

Look for:

- blank screen
- frozen button
- duplicate submission
- infinite spinner
- missing skeleton
- stale content
- modal closing too early

Fix broken loading states.

==================================================
# 28. ERROR STATE BUG HUNT
==================================================

Check behavior when APIs fail.

Look for:

- raw error objects
- stack traces
- blank screen
- generic errors with no recovery
- failed save with success message
- modal stuck open
- application crash

Errors should be:

- understandable
- actionable
- recoverable

==================================================
# 29. CONSOLE / NETWORK MONITORING
==================================================

During testing continuously inspect:

Browser console
Network requests
API responses

Record:

- JS errors
- React errors
- failed requests
- 401
- 403
- 404
- 409
- 422
- 500
- repeated requests
- failed assets

Investigate actual errors.

Do not dismiss them automatically.

==================================================
# 30. NULL / UNDEFINED / EDGE DATA
==================================================

Look for UI crashes caused by:

- null
- undefined
- missing optional fields
- deleted categories
- missing relationships
- empty arrays
- zero values

Every user-facing page should gracefully handle empty/partial data.

==================================================
# 31. FINANCIAL FORMATTING
==================================================

Verify consistently:

Currency:
INR

Number formatting:
Indian numbering system

Date:
DD-MM-YYYY

Financial Year:
April → March

Check every user-facing financial value.

==================================================
# 32. FIXING RULES
==================================================

When a bug is confirmed:

1. Reproduce it.
2. Identify root cause.
3. Fix the root cause.
4. Do not hide the symptom.
5. Do not introduce unrelated changes.
6. Re-run the affected workflow.
7. Refresh.
8. Navigate away and return.
9. Re-test related functionality.
10. Run typecheck/build after meaningful changes.

Example:

BAD FIX:

"Update the displayed name locally after clicking Save."

GOOD FIX:

"Fix the profile PATCH request/backend persistence/query invalidation so the name is stored and reflected everywhere."

==================================================
# 33. REGRESSION CHECK
==================================================

After fixes:

Run:

- frontend typecheck
- backend typecheck
- lint if configured
- production build

Then re-test all affected workflows.

Make sure fixes don't break:

- authentication
- Drive integration
- dashboard
- transactions
- navigation
- settings
- profile

==================================================
# 34. DO NOT TOUCH UNRELATED SYSTEMS
==================================================

Do NOT modify:

- Admin UI unless a user-side issue directly depends on it
- Google Cloud configuration
- Render configuration
- Vercel configuration
- production environment variables
- database schema
- OAuth configuration

Do not make architectural changes unless absolutely required to fix a confirmed bug.

==================================================
# 35. BUG TRACKING
==================================================

Create:

`USER_SIDE_BUG_FIX_REPORT.md`

Document every bug discovered.

Use:

### BUG-001 — Name Update Does Not Persist

**Severity:** P1

**Module:** Profile

**Status:** FIXED

**Root Cause:**
...

**Fix:**
...

**Verification:**
...

**Regression Test:**
...

For each bug include:

- ID
- Severity
- Module
- Description
- Reproduction steps
- Expected behavior
- Actual behavior
- Root cause
- Files changed
- Fix implemented
- Verification performed
- Regression status

==================================================
# 36. SEVERITY
==================================================

Use:

P0 — Critical

Examples:
- Data loss
- Security issue
- Application crash
- Cannot access application
- Financial data corruption

P1 — High

Examples:
- Important feature doesn't save
- User changes disappear
- Major workflow broken
- Incorrect financial calculation
- Major mobile usability issue

P2 — Medium

Examples:
- Feature partially broken
- Stale UI
- Minor calculation/display issue
- Recoverable workflow problem

P3 — Low

Examples:
- Cosmetic glitch
- Minor spacing
- Minor copy issue
- Small UX inconsistency

==================================================
# 37. IMPORTANT — FIND MORE THAN THE KNOWN BUG
==================================================

The name-update issue is only an example.

Do NOT stop after fixing it.

Assume there may be many similar bugs.

Actively search for:

- Save buttons that don't persist
- Delete actions that don't delete
- Edit actions that don't update
- Stale dashboard values
- Broken filters
- Broken search
- Broken pagination
- Incorrect totals
- Incorrect charts
- Missing loading states
- Incorrect success messages
- Incorrect error messages
- Mobile glitches
- Modal problems
- Navigation problems
- Authentication state problems
- Profile inconsistencies
- Settings persistence problems
- Drive status inconsistencies
- Null/undefined crashes

==================================================
# 38. FINAL VALIDATION
==================================================

At the end verify:

- No new TypeScript errors
- Production builds pass
- No new console errors
- No new API errors
- Fixed workflows persist after refresh
- Important account changes persist after logout/login
- Financial CRUD works
- Dashboard reflects changes
- Navigation works
- Mobile layouts remain functional

==================================================
# 39. FINAL REPORT
==================================================

Create:

`USER_SIDE_BUG_FIX_REPORT.md`

Include:

# Penny Pilot — User-Side Bug Fix Report

## Executive Summary

## Bugs Found

| ID | Severity | Module | Problem | Status |
|---|---|---|---|---|

## P0 Bugs

## P1 Bugs

## P2 Bugs

## P3 Bugs

## Detailed Fixes

For every fixed bug:

- Problem
- Reproduction
- Root cause
- Files changed
- Fix
- Verification
- Regression test

## Remaining Issues

List anything discovered but intentionally not fixed.

Explain why.

## Areas Tested

List every module actually tested.

## Validation Results

- Frontend typecheck
- Backend typecheck
- Lint
- Production build
- Runtime
- Console
- Network
- Mobile

## Final User-Side Status

Choose:

- Production Ready
- Nearly Production Ready
- Needs More Fixes
- Not Production Ready