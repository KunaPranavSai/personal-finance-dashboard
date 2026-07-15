# Authentication & Authorization Implementation Report

## Architecture

```
┌──────────────┐         ┌──────────────────────────────────┐
│  Frontend    │         │  Backend (Express.js)             │
│  Next.js 15  │  HTTP   │                                  │
│  localhost   │◄───────►│  localhost:4000                   │
│  :3000       │  cookies│                                  │
└──────┬───────┘         │  ┌────────────┐ ┌──────────────┐ │
       │                 │  │ Auth       │ │ Finance      │ │
       │                 │  │ Routes     │ │ Routes       │ │
       │                 │  │            │ │              │ │
       │  POST /login    │  │ login      │ │ transactions │ │
       │  POST /refresh  │  │ logout     │ │ budgets      │ │
       │  GET  /me       │  │ refresh    │ │ dashboard    │ │
       │  PATCH /change- │  │ me         │ │ ...          │ │
       │        password │  │ change-    │ │              │ │
       │                 │  │ password   │ │              │ │
       │                 │  └─────┬──────┘ └──────┬───────┘ │
       │                 │        │                │         │
       │                 │        ▼                ▼         │
       │                 │  ┌─────────────────────────────┐  │
       │                 │  │ authenticate() middleware    │  │
       │                 │  │ Reads access_token cookie   │  │
       │                 │  │ Verifies JWT signature      │  │
       │                 │  │ Attaches user payload to   │  │
       │                 │  │ req.user                     │  │
       │                 │  └─────────────────────────────┘  │
       │                 │                                  │
       │                 │  ┌─────────────────────────────┐  │
       │                 │  │ Prisma ORM ─► PostgreSQL    │  │
       │                 │  │ (User, AuditLog tables)     │  │
       │                 │  └─────────────────────────────┘  │
       └─────────────────┴──────────────────────────────────┘
```

## Database Changes

### New Enums
- `Role` — `ADMIN`, `USER`, `ACCOUNTANT`, `AUDITOR`
- `AuditAction` — `LOGIN`, `LOGOUT`, `PASSWORD_CHANGE`, `FAILED_LOGIN`, `ACCOUNT_LOCK`

### New Model: `User`
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| uid | String (unique) | Login identifier (9704347240 for admin) |
| passwordHash | String | Argon2id hash |
| fullName | String? | Display name |
| email | String? (unique) | Email address |
| phone | String? | Phone number |
| avatarUrl | String? | External avatar URL |
| role | Role (default USER) | ADMIN, USER, ACCOUNTANT, AUDITOR |
| status | String (default "active") | "active" or "locked" |
| failedAttempts | Int (default 0) | Incremented on failed login |
| lockedUntil | DateTime? | Account lock expiry |
| refreshTokenHash | String? | SHA-256 of current refresh token |
| lastLogin | DateTime? | Last successful login timestamp |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

### New Model: `AuditLog`
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| userId | String? | References User.id (nullable for unauthenticated events) |
| action | AuditAction | LOGIN, LOGOUT, PASSWORD_CHANGE, FAILED_LOGIN, ACCOUNT_LOCK |
| details | String? | Human-readable context |
| ip | String? | Request IP address |
| userAgent | String? | Request User-Agent header |
| createdAt | DateTime | Auto-generated |

Indexes on `userId`, `action`, `createdAt`.

### Migration
- `20260712174816_add_auth` — Creates `Role` enum, `AuditAction` enum, `User` table, `AuditLog` table with indexes.

## Middleware

### `authenticate()` (`src/middleware/auth.ts`)
- Reads `access_token` from signed cookies (`req.signedCookies.access_token`)
- Verifies JWT using `JWT_ACCESS_SECRET`
- Checks expiry (15-minute validity)
- Attaches decoded payload `{ userId, uid, role }` to `req.user`
- Returns `401` if token missing, invalid, or expired

### `authorize(...roles: Role[])` (`src/middleware/auth.ts`)
- Checks `req.user.role` against allowed roles
- Returns `403` if user lacks permission
- Used on admin-only endpoints

## Routes

| Method | Path | Auth | Rate Limited | Description |
|--------|------|------|-------------|-------------|
| POST | `/api/auth/login` | No | 5/min/IP | Authenticate, issue tokens |
| POST | `/api/auth/logout` | No | No | Clear cookies, revoke refresh token |
| POST | `/api/auth/refresh` | No | No | Rotate refresh token, issue new access token |
| GET | `/api/auth/me` | Yes | No | Get current user profile |
| PATCH | `/api/auth/change-password` | Yes | No | Change password (requires current password) |

## Security Measures

### Password Security
- **Algorithm**: Argon2id (memory-hard, resistant to GPU/ASIC attacks)
- **Minimum length**: 12 characters
- **Requirements**: Uppercase, lowercase, number, special character
- **Validation**: Both client-side `ChangePasswordSection` and server-side `validatePassword()`
- **Never logged**: Passwords are never included in logs or error messages

### JWT Security
- **Access Token**: 15-minute expiry, signed with `JWT_ACCESS_SECRET`
- **Refresh Token**: 7-day expiry, signed with `JWT_REFRESH_SECRET`
- **Payload**: `{ userId, uid, role, iat, exp }` — no sensitive data
- **Refresh Token Rotation**: Each refresh invalidates the previous token; stored as SHA-256 hash in database

### Cookie Security
- `httpOnly: true` — Inaccessible to JavaScript (prevents XSS token theft)
- `secure: true` in production — HTTPS only
- `sameSite: "lax"` — CSRF protection
- `signed: true` — Cookie integrity verification using `COOKIE_SECRET`
- Access token: `path: "/"`, maxAge: 15 minutes
- Refresh token: `path: "/api/auth"`, maxAge: 7 days (restricted path)

### Account Lockout
- After **5 failed attempts**, account is locked for **15 minutes**
- Failed attempts reset on successful login
- Lock duration returned in error message

### Rate Limiting
- Login endpoint: **5 requests per minute per IP** via `express-rate-limit`
- Returns `429 Too Many Requests` with clear error message

### HTTP Security Headers (Helmet)
- `Content-Security-Policy`: Restrictive in production
- `HSTS`: 1 year, includeSubDomains (production only)
- `X-Frame-Options`: DENY (no iframe embedding)
- `X-Content-Type-Options`: nosniff
- `X-XSS-Protection`: enabled

### CORS
- Only `http://localhost:3000` and `http://127.0.0.1:3000` allowed
- `credentials: true` required for cookies
- No wildcard origins
- Strict origin validation (no fallback to allowing all)

## JWT Flow

```
1. Login ──► POST /api/auth/login
   ├── Validate uid + password
   ├── Hash password with Argon2id
   ├── Check account lockout
   ├── Generate access token (15m) → access_token cookie
   ├── Generate refresh token (7d) → refresh_token cookie
   └── Store SHA-256(refresh_token) in User.refreshTokenHash

2. Authenticated Request
   ├── authenticate() middleware reads access_token cookie
   ├── Verifies JWT signature & expiry
   └── Attaches user payload to req.user

3. Token Refresh ──► POST /api/auth/refresh
   ├── Read refresh_token cookie
   ├── Verify JWT
   ├── Compare SHA-256 hash with stored value (detects token reuse)
   ├── Issue new access token + new refresh token (rotation)
   └── Update stored hash

4. Logout ──► POST /api/auth/logout
   ├── Clear both cookies
   └── Nullify refreshTokenHash in database
```

## Cookie Flow

```
Browser                          Server
  │                                │
  │  POST /api/auth/login          │
  │──────────────────────────────► │
  │                                │  Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900
  │                                │  Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=604800
  │◄────────────────────────────── │
  │                                │
  │  GET /api/transactions         │
  │  Cookie: access_token=...      │
  │──────────────────────────────► │  authenticate() ✓
  │◄────────────────────────────── │  { transactions: [...] }
  │                                │
  │  POST /api/auth/refresh        │
  │  Cookie: refresh_token=...     │
  │──────────────────────────────► │  Rotate tokens
  │  Set-Cookie: access_token=...  │
  │  Set-Cookie: refresh_token=... │
  │◄────────────────────────────── │  { user: {...} }
```

## Frontend Integration

### Login Page (`/login`)
- Professional UI with gradient background
- UID and password fields
- Show/hide password toggle
- "Remember Me" checkbox
- "Forgot Password" placeholder
- Loading spinner during authentication
- Error message display

### AuthContext (`src/lib/AuthContext.tsx`)
- `AuthProvider` wraps the app inside `ToastProvider`
- Session restoration on page load via `GET /api/auth/me`
- Silent refresh fallback via `POST /api/auth/refresh`
- Automatic 10-minute interval to keep session alive
- `useAuth()` hook exposes: `user`, `isLoading`, `isAuthenticated`, `login()`, `logout()`, `refresh()`, `updateUser()`

### Route Protection (`(app)/layout.tsx`)
- Checks authentication status on mount
- Redirects to `/login` if not authenticated
- Shows loading spinner during auth check
- Renders app shell only after authentication confirmed

### Topbar User Menu
- Displays user avatar (from `user.avatarUrl` or `profile.avatar`)
- Shows full name and email
- Dropdown menu: Profile, Settings, Appearance, Notifications
- Real logout button that clears cookies and redirects to login
- Loading state during logout

### Change Password (Settings → Security)
- Current password, new password, confirm password fields
- Client-side validation (match check, 12-char minimum)
- Server-side validation (Argon2id strength check)
- Success/error toasts
- Clears form on success

### API Client (`src/lib/api.ts`)
- `credentials: "include"` on all requests
- Automatic cookie sending for cross-origin requests (localhost:3000 → localhost:4000)
- Proper error handling with typed `ApiClientError`

## Testing

### Manual Test Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|----------------|
| Successful login | POST /api/auth/login with valid UID + password | Returns user object, sets both cookies |
| Wrong password | POST /api/auth/login with wrong password | 401 "Invalid credentials", increments failedAttempts |
| Wrong UID | POST /api/auth/login with non-existent UID | 401 "Invalid credentials" |
| Account lockout | 5 failed login attempts | 401 "Account locked. Try again in 15 minute(s)." |
| Authenticated request | GET /api/auth/me with valid access_token cookie | Returns user object |
| No auth cookie | GET /api/transactions without cookie | 401 "Authentication required" |
| Token refresh | POST /api/auth/refresh with valid refresh_token cookie | Returns new tokens, old refresh token invalidated |
| Expired access token | Wait 15 minutes, then call API | 401 → auto-refresh handles it |
| Logout | POST /api/auth/logout | Both cookies cleared, refreshTokenHash nullified |
| Role authorization | Call admin endpoint with USER role | 403 "Insufficient permissions" |
| Cookie theft detection | Reuse stolen refresh token | Token revoked, all sessions invalidated |

### Automated Tests
- Backend typecheck: `cd backend && npx tsc --noEmit` — 0 errors
- Frontend typecheck: `cd frontend && npx tsc --noEmit` — 0 errors
- Frontend build: `cd frontend && npm run build` — 0 errors
- Backend build: `cd backend && npm run build` — 0 errors

## Future Improvements

1. **Password Reset Flow**: Implement email-based or UID-based forgot password with reset tokens
2. **Session Management**: Dashboard showing active sessions with ability to revoke
3. **MFA/2FA**: TOTP-based two-factor authentication using `speakeasy` or similar
4. **OAuth/SSO**: Google/GitHub OAuth login for enterprise environments
5. **IP-based Lockout**: Track failed attempts by IP in addition to account-level lockout
6. **Audit Dashboard**: Admin UI to view audit logs with filtering and export
7. **Role Management**: Admin interface to create/edit roles and assign permissions
8. **Account Deletion**: Self-service account deletion with data export
9. **Email Verification**: Verify email on registration/change
10. **WebAuthn/Passkeys**: Passwordless authentication using WebAuthn API
