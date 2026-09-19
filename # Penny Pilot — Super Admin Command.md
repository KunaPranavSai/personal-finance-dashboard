# Penny Pilot — Super Admin Command Center Master Implementation

Redesign and upgrade the entire **Super Admin panel — frontend + backend — into a complete platform control and observability system**.

The current admin pages are only the baseline. Do not limit the implementation to the existing cards/tables.

The final result should feel like:

**PENNY PILOT // COMMAND CENTER**

A secure **Cyber Operations + Financial Infrastructure Control Center**, completely different from the regular Penny Pilot desktop UI and user mobile UI.

---

# 1. DESIGN SYSTEM

Create a dedicated Super Admin design system.

### Visual direction

- Dark cyber/command-center theme
- Deep navy/black background
- Neon cyan/teal primary accent
- Controlled green / amber / red status colors
- Thin technical borders
- Subtle grid/scanline effects
- Controlled glow effects
- Glass/terminal-inspired panels
- Dense information layouts
- Technical/monospace typography for system metrics
- Minimal rounded corners
- Professional enterprise SOC/NOC feel
- Smooth but restrained animations

Do NOT make the admin panel look like:
- Normal Penny Pilot desktop
- Penny Pilot mobile UI
- Generic SaaS admin dashboard

It must immediately look like a separate **Super Admin Command Center**.

---

# 2. ADMIN SHELL

Create one reusable Super Admin shell for:

- Dashboard
- Users
- Migration Status
- System Health
- Activity / Audit Logs
- Application Settings
- Account Settings
- Security / 2FA
- Logout

Brand the interface:

**PENNY PILOT // COMMAND CENTER**

Header should include:

- System status
- Environment
- Global admin search
- Sync/refresh
- Notifications
- Admin identity
- Security indicator

Navigation should clearly distinguish administrative functions from normal user functionality.

---

# 3. COMMAND CENTER DASHBOARD

Build a real operational dashboard using existing backend data.

### Platform Overview

Show:

- Total Users
- Active Users
- Suspended Users
- New Users Today
- New Users This Week
- New Users This Month
- Pending Approvals
- Google Drive Connected
- Migration Required
- Migration In Progress
- Migration Failed
- Migration Completed
- System Health

### Operations Monitor

Include cyber-style panels for:

- Signup trends
- User activity
- Migration activity
- Google Drive health
- Authentication activity
- Email delivery
- API health
- Database health
- Recent administrative actions
- Recent system events
- Error activity

Use real backend data only.

No fake/sample metrics.

---

# 4. USER 360° CONTROL CENTER

The Users section must become a complete **User 360° administrative console**.

Selecting a user should open a detailed control page/panel.

Structure:

**USER HEADER**

- Avatar
- Name
- Email
- UID
- User ID
- Role
- Account status
- Registration date
- Last login
- Last activity
- Google Drive status
- Security status

Then provide:

### Overview
All important account-level information.

### Profile
Manage supported profile fields:

- Name
- Email
- Mobile
- Avatar
- UID
- Existing profile fields

### Account
Control:

- Account status
- Activate
- Suspend
- Restore
- Delete
- Registration metadata
- Login metadata

### Authentication
Show/manage supported:

- Authentication method
- Email verification
- Password-related metadata
- Authentication events

### Security
Show/manage supported:

- 2FA status
- Passkey status/count
- Recovery status
- Security events
- Security reset workflows

### Sessions
Show:

- Active sessions
- Session timestamps
- Last activity
- Device metadata where already collected

Allow:

- Revoke session
- Revoke all sessions
- Force logout
- Security session reset

### Storage
Show:

- Storage mode
- Google Drive connection
- Connected Drive account
- Connection status
- Last sync
- Backup status
- Storage errors
- Migration status
- Migration attempts
- Last migration

### Notifications
Where supported:

- Notification preferences
- Notification status
- Delivery status
- Supported administrative notifications

### Preferences

Expose/manage every existing user preference that the application already supports, such as:

- Theme
- Currency
- Date/format preferences
- Storage preference
- Dashboard customization
- Other existing preferences

### Activity

Complete chronological user activity timeline.

### Audit

Complete audit history for that user.

---

# 5. USER ADMINISTRATIVE CONTROLS

Super Admin must be able to control every **supported platform-level user capability** from the admin panel.

Controls may include:

- Edit profile
- Activate
- Suspend
- Restore
- Reset password
- Reset UID
- Force logout
- Revoke sessions
- Manage supported 2FA state
- Manage supported passkey state
- Initiate supported recovery/reset workflows
- Manage supported notification settings
- Manage supported preferences
- Manage supported storage/migration operations
- Delete account

Do not create fake controls.

Every control must perform the actual backend operation.

---

# 6. ADMIN ACTION CENTER

Dangerous actions must have:

1. Strong confirmation
2. Clear explanation
3. Super Admin authorization
4. Actual backend execution
5. Audit log entry
6. Timestamp
7. Acting admin identity
8. Target user
9. Result/status

No privileged operation should silently bypass auditing.

---

# 7. AUTHENTICATION & SECURITY CONTROL

Super Admin should have visibility into platform security:

- Authentication events
- Failed login attempts
- 2FA status
- Passkey status
- Recovery events
- Session state
- Security events
- Account lock/security events where supported

Never expose:

- Passwords
- OTPs
- TOTP secrets
- Recovery codes
- Private passkey credentials
- OAuth access/refresh tokens
- Encryption keys

---

# 8. GOOGLE DRIVE / STORAGE CONTROL

Provide complete operational visibility:

- Connected/disconnected
- Drive account metadata
- Connection timestamp
- Last successful sync
- Last failed sync
- Backup metadata
- Backup status
- Migration state
- Migration attempts
- Migration errors
- Storage errors
- Quota information where available

Allow supported operations such as:

- Retry migration
- Retry supported sync/backup operations
- Initiate supported storage workflows
- Reconnect through the proper user authorization workflow

### CRITICAL PRIVACY BOUNDARY

Super Admin must NOT be able to browse/read/download users' private financial files.

Do NOT expose:

- Individual transactions
- Budgets
- Investments
- Bills
- Goals
- Wallet balances
- Financial reports
- Google Drive financial files
- Local-Only IndexedDB financial data

Admin may see safe operational metadata such as counts, status, timestamps and errors where already available.

---

# 9. APPLICATION USAGE

Where existing telemetry/data supports it, show per-user:

- Login frequency
- Session count
- Last active time
- Feature usage
- Page usage
- Transaction operation counts
- Search activity
- Report generation
- Import/export activity
- Backup/sync activity
- Notification activity
- Error counts
- API activity

Do NOT invent metrics that are not collected.

---

# 10. GLOBAL AUDIT CONSOLE

Create a powerful cyber-style audit interface.

Filters:

- User
- Admin
- Action
- Resource
- Event type
- Status
- Severity
- Date/time

Each event should show all available non-sensitive metadata:

- Timestamp
- Actor
- Target
- Action
- Result
- Resource
- Metadata

Include:

- Search
- Filters
- Pagination
- Timeline view
- Event detail drawer
- Export only if appropriately supported

---

# 11. MIGRATION STATUS

Redesign Migration Status as an operations console.

Show:

- User
- Migration state
- Drive account
- Last attempt
- Started time
- Completed time
- Failure time
- Error
- Retry state

States:

- New User
- Migration Required
- In Progress
- Completed
- Failed

Use real backend data.

---

# 12. SYSTEM HEALTH

Create a cyber monitoring console for:

- API
- Database
- PostgreSQL connection pool where available
- Google Drive API
- Authentication
- Email / Resend
- Storage
- Background jobs
- Migration service
- Other existing health checks

Use real health data.

Keep existing email:

- Preview
- Test

functionality.

---

# 13. APPLICATION SETTINGS

Redesign current Application Settings using the Cyber Command Center theme.

Preserve existing functionality:

- Site identity
- Support email
- Security policy
- Session configuration
- Minimum password length
- Admin 2FA configuration
- Account backup

Do not silently change security behavior.

---

# 14. ACCOUNT SETTINGS

Keep Super Admin account settings separate from platform settings.

Include existing supported:

- Admin profile
- Security
- 2FA
- Sessions
- Account controls

---

# 15. ACTIVITY / AUDIT LOGS

Create a dense operational activity console.

Show:

- Timestamp
- Actor
- Action
- Target
- Result
- Severity
- Metadata

Use existing audit infrastructure.

---

# 16. BACKEND ARCHITECTURE

Before changing anything:

1. Inspect all existing admin routes.
2. Inspect admin services.
3. Inspect Prisma/admin models.
4. Inspect authentication middleware.
5. Inspect authorization rules.
6. Inspect audit infrastructure.
7. Inspect migration services.
8. Inspect storage/Drive metadata.
9. Inspect existing frontend admin API usage.

Then:

- Reuse existing endpoints wherever possible.
- Do not duplicate APIs.
- Add backend endpoints only where genuinely missing.
- Every admin endpoint must be Super Admin protected.
- Validate target users server-side.
- Apply actual operations.
- Audit privileged actions.
- Never expose private financial data.

Do not implement UI-only fake functionality.

---

# 17. PERMISSION MODEL

Maintain a strict separation:

### SUPER ADMIN

Platform-level authority:

- User management
- Account control
- Security administration
- Sessions
- Storage/migration management
- Platform configuration
- Audit
- System health
- Operational metadata

### USER

Own:

- Profile
- Authentication
- Preferences
- Private financial data
- Google Drive financial files
- Local-Only financial data

Super Admin must NEVER bypass the privacy boundary simply because it has administrative privileges.

---

# 18. RESPONSIVE ADMIN EXPERIENCE

Create a dedicated responsive Admin experience.

Do NOT copy the normal Penny Pilot mobile UI.

Mobile should feel like a compact **Cyber Operations Console**:

- Compact command header
- Collapsible navigation
- Dense metric cards
- Horizontal status panels
- Scrollable tables
- Compact event timelines
- Bottom actions only where useful
- 44px touch targets
- Safe-area support
- No horizontal overflow

Support:

- 375×812
- 390×844
- Desktop

---

# 19. DESIGN DETAILS

Use a consistent cyber language:

```text
PENNY PILOT // COMMAND CENTER
SYSTEM STATUS: ONLINE
ENVIRONMENT: PRODUCTION
SECURITY: NOMINAL