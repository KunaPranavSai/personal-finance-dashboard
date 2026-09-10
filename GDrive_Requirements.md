Understood. In your revised architecture, **Google Drive is not a backup of the application's database — it is the actual persistent storage for the user's financial data.**

The only data your backend should retain is the minimum required for authentication/application operation. **No financial/user application data should be stored in PostgreSQL or any other server-side database.**

Also, after registration, connecting Google Drive should be **mandatory**, similar to the way WhatsApp requires completing its setup before the user can use the application.

Use this prompt with Claude Code:

---

# Claude Code Prompt — Penny Pilot: Google Drive as Primary User Data Storage

Modify the existing **Penny Pilot** application to implement a **Google Drive–based user data architecture**.

## CRITICAL ARCHITECTURE REQUIREMENT

**Google Drive must be the ONLY persistent storage location for the user's financial/application data.**

Do **NOT** store user financial data in PostgreSQL, MongoDB, Redis, local server files, or any other backend database/storage.

The application backend should act as an API/application layer, while the user's Google Drive acts as their personal data storage.

Architecture:

```text
                    PENNY PILOT
                         │
                 Authentication
                         │
                         ▼
                 Application API
                         │
                         ▼
                  User's Google Drive
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   Transactions       Budgets        Investments
   Income             Expenses       Savings
   Bills              EMIs           Goals
   Categories         Accounts       Settings
   Reports            Other Data
```

PostgreSQL, if currently present, must **NOT contain the user's financial/application data**.

---

# DATA OWNERSHIP

The user's financial data must belong to the user and remain inside their own Google Drive.

Penny Pilot should not maintain a centralized database containing:

* Transactions
* Income
* Expenses
* Budgets
* Investments
* Savings
* Bills
* EMIs
* Financial Goals
* Accounts
* Categories created by the user
* Financial reports
* User financial preferences
* Other personal financial records

These must be stored in the user's Google Drive.

The application should retrieve the required data from Google Drive when necessary and maintain only temporary/in-memory application state where required for performance.

---

# AUTHENTICATION VS USER DATA

Keep authentication completely separate from financial data.

The application may maintain the **minimum necessary authentication/account information** required to identify and authenticate a Penny Pilot account.

However:

**Never store financial/application data in the authentication database.**

Do NOT store the following in Google Drive:

* Passwords
* JWTs
* Refresh Tokens
* Google OAuth Client Secrets
* Google OAuth credentials
* Encryption keys
* Authentication credentials
* Server secrets

Google OAuth credentials/tokens must be handled securely by the application authentication layer and must never be written into the user's financial-data files.

---

# MANDATORY GOOGLE DRIVE CONNECTION

Google Drive connection is **mandatory immediately after account creation**.

The registration flow should be:

```text
Create Account
      ↓
Account Created
      ↓
Connect Google Drive
      ↓
Google OAuth Authorization
      ↓
Drive Successfully Connected
      ↓
Initialize Penny Pilot Storage
      ↓
Create User's Penny Pilot data structure
      ↓
Enter Dashboard
```

The user must **NOT be allowed to use the main Penny Pilot application until Google Drive has been successfully connected and initialized.**

This should work similarly to a mandatory setup/onboarding flow.

---

# REGISTRATION FLOW

After the user completes standard account registration:

Show a dedicated screen:

## "Connect Your Google Drive"

Explain clearly:

> "Penny Pilot stores your financial data directly in your Google Drive. Connect your Google account to securely store and access your Penny Pilot data."

Show:

**[ Connect Google Drive ]**

Do not provide a "Skip for now" option.

Do not provide a "Maybe later" option.

Do not allow access to the main dashboard before successful connection.

---

# GOOGLE OAUTH

Implement secure Google OAuth 2.0.

Request the **minimum Google Drive permission necessary**.

Prefer Google's application-specific `appDataFolder` approach when it satisfies the product requirements.

If users need to manually see/manage their Penny Pilot files in their normal Google Drive, use the narrowest appropriate user-authorized Drive scope.

Do NOT request unrestricted access to the user's entire Google Drive unless absolutely necessary.

Clearly explain why Drive access is required.

---

# INITIAL DRIVE SETUP

After successful authorization:

Automatically create/initialize Penny Pilot's storage structure.

If using a user-visible Drive folder:

```text
Penny Pilot/
│
├── Data/
│   ├── transactions.json
│   ├── income.json
│   ├── expenses.json
│   ├── budgets.json
│   ├── investments.json
│   ├── savings.json
│   ├── bills.json
│   ├── emi.json
│   ├── goals.json
│   ├── accounts.json
│   ├── categories.json
│   └── settings.json
│
├── Reports/
│
└── Metadata/
    └── manifest.json
```

If `appDataFolder` is used, adapt the structure to Google's application-data storage model.

Choose the implementation that provides the best combination of privacy, security, reliability, and user ownership.

---

# DATA FORMAT

Use a versioned and structured format.

Each data file should contain appropriate metadata such as:

* schemaVersion
* lastUpdated
* dataVersion
* records

Example:

```json
{
  "schemaVersion": 1,
  "lastUpdated": "2026-09-09T18:00:00Z",
  "records": []
}
```

Do not hardcode example financial records.

---

# TRANSACTION STORAGE

When a user creates a transaction:

```text
User
 ↓
Penny Pilot API
 ↓
Google Drive
 ↓
transactions.json
```

The transaction must be persisted to the user's Google Drive.

When the dashboard needs transaction data:

```text
Google Drive
 ↓
Penny Pilot API
 ↓
Dashboard
```

Do not write the transaction into PostgreSQL.

---

# ALL USER DATA

Apply the same architecture to:

### Transactions

Income

Expenses

Transfers

Recurring Transactions

### Budget

Monthly Budgets

Quarterly Budgets

Yearly Budgets

### Investments

Stocks

Mutual Funds

SIPs

Gold

Silver

Crypto

PPF

EPF

NPS

FD

RD

ETF

Real Estate

### Savings

Emergency Fund

Savings Goals

### Bills

EMIs

Loans

Subscriptions

Utilities

Insurance

Credit Cards

### Goals

Vacation

Vehicle

Home

Education

Retirement

Emergency Fund

### User Configuration

Accounts

Categories

Subcategories

Tags

Payment Methods

Preferences

Financial Settings

All of these must reside in the user's Google Drive.

---

# OFFLINE / FAILURE HANDLING

Penny Pilot must gracefully handle:

* Google Drive unavailable
* Internet interruption
* OAuth expiration
* OAuth revoked
* Permission denied
* Drive quota exceeded
* File deleted
* File corrupted
* Network timeout
* Google API rate limit

Do not silently lose user data.

If a write fails, clearly tell the user that the data could not be saved.

Do not report a transaction as successfully saved until the Drive operation has succeeded.

---

# DATA INTEGRITY

Implement:

* Atomic-style writes where possible
* Version numbers
* Schema versions
* Checksums/integrity validation
* Conflict detection
* Safe retries
* Duplicate-write prevention
* File locking/version checking where applicable

Avoid overwriting newer user data with stale data.

---

# GOOGLE DRIVE DISCONNECT

If the user disconnects Google Drive:

Immediately restrict access to financial functionality.

Show:

> "Google Drive is disconnected. Reconnect your Google Drive to access your Penny Pilot data."

Do not delete the user's Google Drive data.

Do not automatically delete their Penny Pilot files.

Allow them to reconnect the same Google account.

---

# GOOGLE ACCOUNT CHANGE

If a user connects a different Google account:

Do not automatically merge data.

Clearly detect the account change.

Ask the user whether they want to:

* Connect the new Drive
* Restore existing Penny Pilot data
* Start a new Penny Pilot data space

Never accidentally expose data from one Google account to another.

---

# RESTORE / DATA IMPORT

Provide:

**Settings → Data Management**

Options:

* Restore Data
* Import Penny Pilot Data
* Export Data
* Verify Data
* View Storage Status

The user should be able to restore their Penny Pilot data from their Google Drive.

---

# EXPORT

Allow users to export their own data as:

* JSON
* CSV
* Excel
* PDF reports

Exported files should be generated on demand.

Do not maintain unnecessary server-side copies.

---

# SECURITY

Treat all financial information as highly sensitive.

Implement:

* HTTPS
* Secure OAuth
* Server-side credential handling
* Proper authorization
* User isolation
* Input validation
* Encryption where appropriate
* Secure API endpoints
* Rate limiting
* Audit logging

Never expose OAuth credentials or tokens to other users.

Never allow one Penny Pilot user to access another user's Drive data.

Never put Google OAuth secrets inside frontend code.

---

# PERFORMANCE

Because Google Drive is now the persistent data layer:

Optimize Drive access carefully.

Implement:

* Intelligent caching
* In-memory caching where appropriate
* Batch operations
* Minimal API calls
* Lazy loading
* Pagination
* Efficient JSON structures
* Optimistic UI only when safe
* Data synchronization
* Retry mechanisms

**Important:** Cache must be temporary and must never become the permanent source of truth.

Google Drive remains the authoritative persistent storage.

---

# DASHBOARD

All existing Penny Pilot dashboard functionality must continue working.

The dashboard should retrieve data from the user's Google Drive and calculate:

* Income
* Expenses
* Savings
* Cash Flow
* Net Worth
* Budget Utilization
* Savings Rate
* Investment Growth
* Financial Health
* Spending Trends
* Category Analysis
* Forecasts
* Goals
* Bills

Charts and KPI cards should update based on the user's Drive data.

---

# EMPTY ACCOUNT

After connecting a new Google Drive:

The user's Penny Pilot data should initially be empty.

Show:

> "Welcome to Penny Pilot"

> "Your financial workspace is ready."

> "Start by adding your first transaction."

Do NOT create:

* Sample transactions
* Demo income
* Demo expenses
* Fake investments
* Example budgets
* Example goals
* Fake charts

---

# UI

Create a clean onboarding experience:

```text
┌──────────────────────────────────────┐
│                                      │
│             Penny Pilot              │
│                                      │
│       Your money. Your data.         │
│                                      │
│  Penny Pilot securely stores your    │
│  financial data in your Google Drive │
│                                      │
│       [ Connect Google Drive ]       │
│                                      │
│  Your data remains under your        │
│  Google account.                     │
│                                      │
└──────────────────────────────────────┘
```

Use the existing Penny Pilot design system.

Do not redesign unrelated features.

---

# IMPORTANT ARCHITECTURAL RULES

**DO NOT:**

* Store financial data in PostgreSQL.
* Store financial data in MongoDB.
* Store financial data in server files.
* Store financial data in Redis permanently.
* Use Google Drive merely as a backup.
* Allow users to bypass Drive connection.
* Store passwords in Drive.
* Store JWTs in Drive.
* Store refresh tokens in Drive.
* Store OAuth secrets in Drive.
* Store encryption keys in Drive.
* Store authentication credentials in Drive.

**DO:**

* Use Google Drive as the authoritative persistent storage for user financial data.
* Make Google Drive connection mandatory after registration.
* Keep authentication separate from financial data.
* Keep sensitive credentials outside Drive.
* Handle Drive failures gracefully.
* Preserve data integrity.
* Ensure strict user isolation.
* Provide restore/export functionality.

---

# DEVELOPMENT PROCESS

Before modifying code:

1. Inspect the entire existing Penny Pilot architecture.
2. Identify the current database usage.
3. Identify all models containing user financial data.
4. Identify authentication-related data.
5. Identify all APIs that read/write financial information.
6. Identify all frontend data services.
7. Design the Google Drive storage abstraction.
8. Implement the Drive integration.
9. Migrate financial data access from the existing database to Drive.
10. Update authentication/onboarding.
11. Update dashboard and all modules to use Drive data.
12. Remove unnecessary financial-data database dependencies.
13. Test every CRUD operation.
14. Test Google OAuth.
15. Test reconnect/disconnect.
16. Test Drive failures.
17. Test account isolation.
18. Test restore/import/export.
19. Run lint, tests, and production build.

Do not make unrelated changes.

---

# FINAL REQUIREMENT

The final Penny Pilot architecture must follow this principle:

> **"Penny Pilot provides the application, while the user's Google Drive owns and stores the user's financial data."**

The user's financial data must never become part of a centralized Penny Pilot database.

Build this carefully with a clean storage abstraction so that the application can later support additional user-owned storage providers without rewriting the entire application.
