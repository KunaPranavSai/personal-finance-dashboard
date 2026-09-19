````markdown
# Penny Pilot — Super Admin Command Center: Full Platform Control, User Entitlements & Complete Email Management

Continue from the current Penny Pilot Super Admin Command Center implementation.

This is a **functional completion and architecture pass**, not another UI-only redesign.

Preserve the existing Cyber Command Center visual system, but make the admin console a complete, backend-enforced platform-management system.

## 1. SUPER ADMIN = COMPLETE PLATFORM CONTROL

`SUPER_ADMIN` must have the highest administrative access level.

Super Admin must be able to manage all legitimate platform-level operations:

- Users
- Admins
- Roles
- Access & Entitlements
- Account status
- Authentication
- Sessions
- Security
- Notifications
- Announcements
- Email Templates
- Automated Emails
- Email Sending
- Application Settings
- Integrations
- Migration/Backup operations
- Audit
- System Health
- Platform configuration

Do not artificially restrict legitimate Super Admin operations.

Protect only security-critical scenarios such as:
- self privilege escalation
- removing/demoting the final Super Admin
- accidental self-lockout

All authorization must be enforced by the backend, not merely hidden in the frontend.

---

# 2. ADMIN AUTHENTICATION

Keep the dedicated admin authentication boundary:

`/admin-login`

Rules:

```text
USER
/login → normal Penny Pilot application

ADMIN
/admin-login → Command Center

SUPER_ADMIN
/admin-login → Command Center
````

Do not allow Admin/Super Admin to authenticate into the normal user portal.

Do not allow USER accounts into the admin portal.

Apply the same rule to:

* password login
* 2FA login
* passkey login

The portal check must happen before token/session issuance.

Preserve the existing `sessionId` JWT and per-session revoke enforcement.

---

# 3. USER MANAGEMENT + USER 360

Users must have a complete administrative control center.

`/admin/users`

must support:

* search
* filtering
* sorting
* pagination
* create user
* view user
* edit user
* suspend
* restore
* delete
* reset password
* reset UID
* force logout
* session management
* role management
* access management

Clicking a user must open:

`/admin/users/[id]`

and remain entirely inside the Command Center.

User 360 should include:

* Overview
* Profile
* Account
* Authentication
* Security
* Sessions
* Access & Entitlements
* Storage
* Notifications
* Preferences
* Activity
* Audit

All controls must connect to real APIs.

No placeholder buttons.

---

# 4. ROLE MANAGEMENT

Support the existing role hierarchy:

```text
USER
ADMIN
SUPER_ADMIN
```

Super Admin can manage legitimate role assignments.

Rules:

* USER has no admin access.
* ADMIN has normal admin capabilities.
* SUPER_ADMIN has complete platform administration.
* ADMIN cannot escalate itself.
* ADMIN cannot promote itself to SUPER_ADMIN.
* SUPER_ADMIN can manage administrative roles.
* Protect the final Super Admin account from accidental removal/demotion.

Use backend authorization as the source of truth.

---

# 5. ACCESS & ENTITLEMENTS

Penny Pilot currently does not have a billing/subscription system.

Do NOT fabricate billing.

Instead create an extensible:

`Access & Entitlements`

system that can later support subscriptions.

Super Admin must be able to configure user-level:

* plan/entitlement label
* feature access
* enabled/disabled features
* configurable limits
* storage allowance
* API allowance if applicable
* account restrictions
* notification eligibility
* email eligibility

The architecture should allow future plans such as:

```text
FREE
PRO
BUSINESS
ENTERPRISE
```

without requiring a rewrite.

Do not claim a subscription exists unless an actual billing system exists.

All entitlement changes must be:

* backend-authorized
* validated
* auditable
* visible in User 360

Do not expose financial records.

---

# 6. COMPLETE EMAIL MANAGEMENT

This is a major requirement.

The Super Admin must be able to both:

1. **Configure email templates**
2. **Send emails directly from the Admin Command Center**
3. **Configure automated/system emails**
4. **Perform full CRUD on email configuration**

Create:

`/admin/email-templates`

and, where useful:

`/admin/email`

for sending and delivery management.

Reuse the existing email infrastructure/provider.

Do NOT create a second mail-delivery system.

---

# 7. EMAIL TEMPLATE MANAGEMENT

Provide configurable templates for:

```text
Email Templates
├── Welcome
├── Password Reset
├── Security Alert
├── Account Notification
├── Migration Notification
├── Announcement
└── Custom Templates
```

These must be real configurable templates, not hardcoded UI cards.

## Template CRUD

Super Admin must be able to:

* Create
* Read
* Edit
* Duplicate
* Enable
* Disable
* Delete where safe
* Restore Default
* Preview
* Send Test Email
* Configure subject
* Configure HTML/body
* Configure text fallback where supported
* Manage supported placeholders
* View created/updated metadata

Persist templates in the database.

Do not keep editable templates only in source code.

Existing default templates should remain available as fallback/default content.

---

# 8. TEMPLATE VARIABLES

Show the actual variables supported by the backend.

Examples only where genuinely supported:

```text
{{name}}
{{email}}
{{uid}}
```

Do NOT invent variables.

Validate variables before saving.

Provide an easy variable insertion/helper UI.

Prevent unsupported placeholders from silently reaching production emails.

---

# 9. AUTOMATED EMAIL MANAGEMENT — FULL CRUD

Create a dedicated:

`Automated Emails`

management area.

Super Admin must be able to configure automated emails triggered by real platform events.

Examples:

* Welcome email
* Password reset email
* Security alert
* Account notification
* Migration notification
* Announcement email
* Other existing automated system emails

First inspect the existing email service and identify the actual automated email triggers.

Do not invent triggers that do not exist.

For every supported automated email rule, provide:

### CREATE

Create an automation configuration where the platform supports it.

### READ

View:

* trigger
* template
* enabled/disabled
* recipient rule
* timing
* configuration
* last updated

### UPDATE

Change:

* associated template
* enabled/disabled
* supported configuration
* timing/delay where supported
* recipient behavior where supported

### DELETE

Remove an automation configuration where safe.

For mandatory security/system emails, deletion may instead mean:

`Disable`

rather than physically deleting the system trigger.

### TEST

Provide a safe test action where supported.

### RESET

Restore the platform default automation configuration.

Every mutation must be audited.

---

# 10. EMAIL AUTOMATION ARCHITECTURE

Separate:

```text
Email Template
      ↓
Email Automation / Trigger
      ↓
Email Delivery Service
      ↓
Recipient
```

Do not mix templates and triggers into one model.

A template defines:

* content

An automation defines:

* when it is triggered
* which template is used
* whether it is enabled
* supported recipient/configuration rules

The existing email delivery service remains responsible for actually sending the email.

---

# 11. SEND EMAIL DIRECTLY FROM ADMIN

Super Admin must be able to send an email from the Command Center.

Create an Admin Email Composer.

Support:

* recipient
* subject
* template selection
* custom message where permitted
* HTML/body
* preview
* send
* test/send-to-self
* confirmation before sending

Recipient selection should support safe options such as:

* selected user
* multiple selected users
* manually entered validated email addresses
* supported platform audience where appropriate

Do NOT expose user financial data while composing emails.

Do not allow the admin UI to reveal passwords, tokens, or private financial information.

Before sending:

* validate recipients
* validate subject/body
* show confirmation
* show sending state
* return delivery result/error

Record the administrative send action in `ActivityLog`.

Never silently send bulk mail.

For bulk sends, show:

* recipient count
* audience
* template/content
* confirmation

---

# 12. EMAIL SAFETY

Never expose:

* Resend API keys
* SMTP passwords
* OAuth tokens
* refresh tokens
* provider secrets
* encryption keys

Admin may configure supported provider settings only through the existing secure configuration mechanism.

Secrets must remain server-side.

---

# 13. EMAIL HISTORY / DELIVERY STATUS

Where the current backend/provider exposes real information, provide:

* send status
* success/failure
* timestamp
* recipient
* template
* error
* test/production indicator

Do NOT fabricate delivery metrics.

If delivery analytics are unavailable:

`Not monitored`

Do not pretend an email was delivered merely because an API request was created.

---

# 14. ANNOUNCEMENTS

Keep Announcements separate from personal Notifications.

Admin:

`Communication → Announcements`

must support:

* Create
* Read
* Edit
* Delete
* Draft
* Schedule
* Publish
* Expire

Fields:

* title
* body
* type
* priority
* audience
* publishAt
* expireAt

User side:

```text
Notifications
├── Personal
└── Announcements
```

Do not create per-user Notification rows for platform announcements.

---

# 15. NOTIFICATION MANAGEMENT

Provide appropriate administrative notification controls.

Support real operations such as:

* view
* inspect
* create platform notification where supported
* configure notification behavior
* enable/disable supported notification channels

Do not confuse personal user notifications with platform announcements.

---

# 16. COMPLETE ADMIN CRUD SWEEP

Audit every Command Center resource.

For every resource, implement all legitimate operations.

### Users

```text
CREATE
READ
UPDATE
DELETE
SUSPEND
RESTORE
RESET PASSWORD
RESET UID
FORCE LOGOUT
ROLE CHANGE
SESSION MANAGEMENT
ENTITLEMENT MANAGEMENT
```

### Roles

```text
READ
UPDATE
ASSIGN
REMOVE
```

subject to security rules.

### Entitlements

```text
CREATE
READ
UPDATE
DELETE
ENABLE
DISABLE
```

### Sessions

```text
READ
REVOKE
FORCE LOGOUT ALL
```

Sessions are system-created; do not provide arbitrary manual session creation.

### Announcements

```text
CREATE
READ
UPDATE
DELETE
PUBLISH
SCHEDULE
EXPIRE
```

### Email Templates

```text
CREATE
READ
UPDATE
DELETE
DUPLICATE
ENABLE
DISABLE
RESTORE DEFAULT
PREVIEW
SEND TEST
```

### Automated Emails

```text
CREATE
READ
UPDATE
DELETE
ENABLE
DISABLE
TEST
RESET DEFAULT
```

### Platform Settings

```text
READ
UPDATE
RESET where supported
```

### Integrations

Use only operations actually supported by the integration:

```text
READ
CONFIGURE
ENABLE
DISABLE
TEST
```

Do not expose credentials.

### Audit

```text
READ
FILTER
SEARCH
PAGINATE
VIEW DETAIL
```

Audit records must not be editable/deletable through the normal admin UI.

### System Health

```text
READ
REFRESH
RUN SAFE HEALTH CHECKS where supported
```

### Migration/Backup

Expose legitimate existing operations only.

Do not create fake migration/restore buttons.

---

# 17. ADMIN ACTION CENTER

All dangerous actions must use the shared:

`AdminActionConfirm`

Examples:

* Delete user
* Suspend user
* Reset password
* Reset UID
* Change privileged role
* Revoke session
* Force logout
* Delete email template
* Disable security automation
* Delete announcement
* Delete entitlement
* Global configuration changes
* Bulk email send

High-risk operations require typed confirmation where appropriate.

Every mutation must create an `ActivityLog`.

---

# 18. REFRESH

The Command Center header must contain:

**Refresh**

NOT Sync.

Refresh must:

* refetch real admin queries
* show loading/spinner state
* disable duplicate clicks while running
* update dashboard data
* update health/status panels

Do not describe this as Google Drive synchronization.

---

# 19. ADMIN ANALYTICS

Use real operational/account data for:

* signup trends
* active users
* admin/Super Admin counts
* authentication activity
* failed authentication
* system errors
* migration activity
* Drive connection status
* email operational status
* admin activity

Allow useful:

* date filters
* severity filters
* resource filters
* user filters

No financial analytics.

---

# 20. CONFIGURATION MANAGEMENT

Provide centralized administrative configuration for supported platform settings.

Organize into:

```text
Application
Security
Authentication
Email
Notifications
Integrations
Platform
Access & Entitlements
```

Use existing APIs/services first.

Do not hardcode configuration into frontend code.

Global/high-risk changes require confirmation and audit logging.

---

# 21. SECURITY + AUDIT

Use the existing:

`logActivity()`

as the single audit writer.

Audit:

* user creation/deletion
* user status changes
* role changes
* entitlement changes
* password reset
* UID reset
* session revoke
* force logout
* announcement mutations
* email template mutations
* automated email configuration
* direct email sends
* platform settings
* integration changes
* migration/backup administrative actions
* security events

---

# 22. BACKUP + RESTORE

Reuse existing Penny Pilot backup/migration infrastructure.

Super Admin can manage operational backup/migration functionality supported by the current system.

Show:

* status
* connected users
* migration state
* errors
* connection attempts
* operational events

Never expose private Drive file contents.

---

# 23. FILE MANAGEMENT

If an existing platform-level asset/file system exists, expose it to Super Admin.

Support legitimate:

* upload
* list
* view metadata
* rename
* organize
* delete

Only platform/admin-owned files.

Do NOT build access to private user Google Drive files.

If no platform asset system exists, do not fabricate one.

---

# 24. ADMIN UI

Preserve the current cyber Command Center theme.

Every page must use consistent:

* header
* sidebar
* cards
* tables
* buttons
* forms
* tabs
* modals
* toasts
* loading states
* empty states
* error states
* confirmation patterns

Add subtle micro-animations and clear feedback.

Do not change the normal Penny Pilot user-facing design.

---

# 25. RESPONSIVE ADMIN

Support:

* 375×812
* 390×844
* desktop

Ensure:

* no horizontal overflow
* collapsible sidebar
* compact header
* usable tables
* sticky first column where appropriate
* 44px minimum touch targets
* safe-area support
* User 360 works on mobile
* email editor works on mobile
* announcement composer works on mobile

Do NOT reuse `MobileShell`.

---

# 26. ABSOLUTE PRIVACY BOUNDARY

Even SUPER_ADMIN must NOT access:

* Transaction
* Budget
* Investment
* Bill
* Goal
* wallet balances
* private financial history
* Google Drive file contents
* passwords/password hashes
* 2FA secrets
* backup codes
* passkey public keys
* credential IDs

Super Admin has:

**complete platform control**

but NOT:

**access to private financial records.**

---

# 27. DATABASE SAFETY

Inspect the current Prisma schema before adding anything.

Only add models genuinely required for:

* persistent email templates
* email automation configuration
* user entitlements/access configuration
* any other missing persistent admin functionality

Generate migration SQL only.

DO NOT:

* `prisma migrate deploy`
* `prisma db push`
* migration resolve
* modify the live database

`prisma generate` is allowed.

---

# 28. FINAL VERIFICATION

Do not declare completion because the UI exists.

Verify the complete chain:

```text
Admin UI
↓
Frontend API call
↓
Backend authentication
↓
Role/permission check
↓
Validation
↓
Database/service operation
↓
Response
↓
UI update
↓
ActivityLog
```

Check every admin action.

Check every sidebar route.

Search for:

* dead buttons
* TODO
* Coming Soon
* fake CRUD
* old UI redirects
* missing API calls
* missing authorization
* missing audit logging
* fake metrics
* hardcoded editable email templates

## Required final capability matrix

Return:

```text
Resource
Create
Read
Update
Delete
Special Actions
API Endpoint
Required Role
Audit Logging
Frontend Route
Persistence
```

Include:

* Users
* Roles
* Access & Entitlements
* Sessions
* Announcements
* Notifications
* Email Templates
* Automated Emails
* Direct Email Sending
* Platform Settings
* Integrations
* Migration
* Backup
* System Health
* Audit
* Admin Account
* Platform Assets if an existing system supports them

Clearly identify anything intentionally read-only.

Do not call something "full CRUD" unless the underlying backend operation actually exists and the frontend is connected to it.

Do not fake unsupported functionality.

Do not apply migrations.

Do not perform destructive actions against real production accounts.

```
```
