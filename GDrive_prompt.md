Modify the existing Penny Pilot application to change its data-storage architecture.

IMPORTANT: Google Drive must become the ONLY persistent storage for all user financial/application data. Do NOT use PostgreSQL, MongoDB, Redis, server files, or any other backend storage for the user's financial data. The existing database may retain only the minimum authentication/account information required to operate the application.

After a user creates a Penny Pilot account, Google Drive connection must be MANDATORY before they can access the main application, similar to a required setup step in WhatsApp.

FLOW:

Sign Up → Account Created → Connect Google Drive → Google OAuth → Initialize Penny Pilot Storage → Dashboard

There must be NO "Skip", "Later", or bypass option.

Implement secure Google OAuth 2.0 and request the minimum Google Drive permission required. Prefer Google's app-specific `appDataFolder` approach when appropriate; if users need to see/manage Penny Pilot files in their normal Drive, use the narrowest suitable Drive scope.

After successful connection, automatically initialize the user's Penny Pilot storage.

Store all user-owned application data in their Google Drive, including:

- Transactions
- Income
- Expenses
- Budgets
- Categories
- Subcategories
- Accounts
- Savings
- Investments
- SIPs
- Goals
- Bills
- EMIs
- Loans
- Recurring transactions
- Tags
- Financial preferences
- Other personal financial records

Use a structured, versioned storage format with metadata such as schemaVersion, dataVersion, lastUpdated, and checksum/integrity information.

Example storage structure if using a visible Drive folder:

Penny Pilot/
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
├── Reports/
└── Metadata/
    └── manifest.json

Adapt this structure if `appDataFolder` is used.

CRITICAL SECURITY RULE:

NEVER store the following in Google Drive:

- Passwords
- JWTs
- Refresh tokens
- Google OAuth tokens/credentials
- Google OAuth client secrets
- Encryption keys
- Authentication credentials
- Server secrets

Keep authentication credentials completely separate from the user's financial data.

When a user creates or updates financial data, persist it directly to their Google Drive. PostgreSQL must NOT receive or permanently store that financial data.

Google Drive is the authoritative source of truth.

If Google Drive is unavailable, do not silently claim that data was saved. Show an appropriate error and prevent unsafe writes. The application should gracefully handle network failures, OAuth expiration/revocation, permission errors, quota limits, missing files, corrupted data, rate limits, and Google API failures.

Implement safe synchronization with:

- Version checking
- Conflict detection
- Duplicate-write prevention
- Retry handling
- Integrity/checksum validation
- Safe updates
- Minimal Google API calls
- Temporary in-memory caching only where useful

Caching must never become permanent storage or replace Google Drive as the source of truth.

Add:

Settings → Data & Google Drive

with:

- Google Drive connection status
- Connected Google account
- Connect/Reconnect
- Disconnect
- Backup/Data status
- Storage status
- Export Data
- Import/Restore Data
- Verify Data

If the user disconnects Google Drive, immediately restrict access to financial features and show:

"Google Drive is disconnected. Reconnect your Google Drive to access your Penny Pilot data."

Do not delete their Drive data.

If the user connects a different Google account, never automatically merge or expose data from the previous account. Clearly detect the account change and provide safe options to connect, restore, or start a new Penny Pilot data space.

RESTORE:

Allow users to restore their Penny Pilot data from their Google Drive.

Before restoring:

- Validate the file
- Validate schema version
- Verify integrity/checksum
- Show backup/data date
- Show what will be restored
- Require confirmation
- Prevent duplicate transactions
- Preserve relationships between all entities
- Create a safe pre-restore state where possible

EXPORT:

Allow users to export their own data as:

- JSON
- CSV
- Excel
- PDF reports

Do not permanently retain unnecessary server-side copies.

ONBOARDING UI:

Create a clean mandatory onboarding screen immediately after registration:

"Penny Pilot"

"Your money. Your data."

"Penny Pilot stores your financial data directly in your Google Drive. Connect your Google account to securely create your personal financial workspace."

[ Connect Google Drive ]

There must be no skip button.

After successful connection:

"Google Drive Connected ✓"

"Your Penny Pilot workspace is ready."

[ Continue to Dashboard ]

Do not create any sample, demo, fake, or placeholder financial data.

The new workspace must start empty and show appropriate empty states such as:

"No transactions yet."
"Start by adding your first transaction."
"No budget created."
"Add your first investment."

All existing Penny Pilot modules must continue working, but their financial data must now be read from and written to the authenticated user's Google Drive:

Dashboard
Transactions
Income
Expenses
Budget Planner
Savings
Investments
Bills & EMI
Financial Goals
Analytics
Reports
Notifications
Settings

All dashboard KPIs, charts, analytics, reports, and calculations must operate on the user's Drive data.

IMPORTANT:

Do not redesign unrelated functionality.
Do not introduce sample data.
Do not remove the admin role.
Do not make Google Drive a secondary backup.
Do not keep financial data in the existing database.

First inspect the existing Penny Pilot codebase and identify:

1. Current authentication architecture.
2. Current database models.
3. Which models contain financial/user data.
4. All APIs that read/write financial data.
5. Frontend data services.
6. Existing settings/onboarding flow.

Then implement the Google Drive storage layer and migrate financial data access to it with minimal disruption to the existing application.

Use a clean storage abstraction/service so Google Drive implementation is isolated and another user-owned storage provider can be added later.

Finally:

- Test registration.
- Test mandatory Google Drive connection.
- Test OAuth.
- Test transaction CRUD.
- Test budgets.
- Test income/expenses.
- Test investments.
- Test bills.
- Test goals.
- Test dashboard analytics.
- Test export/import.
- Test reconnect/disconnect.
- Test expired/revoked authorization.
- Test Drive API failure.
- Test quota failure.
- Test different Google account.
- Verify that financial data is never stored in PostgreSQL.
- Verify that one user cannot access another user's Drive data.
- Run lint, tests, and production build.
- Update README.md and PROJECT_STATUS.md with the new architecture and Google Cloud OAuth configuration/setup instructions.

FINAL ARCHITECTURE:

Penny Pilot = Application + Authentication + Business Logic

User's Google Drive = ONLY persistent storage for user's financial/application data

Authentication credentials = Separate secure authentication storage

The core principle is:

"Your money. Your data. Your Google Drive."