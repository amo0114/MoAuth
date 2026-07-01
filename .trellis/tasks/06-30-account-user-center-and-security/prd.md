# PRD: Account User Center + Security Hardening (P2 → P5)

## Status

**Review accepted** (2026-06-30). Current Account delivery is an **auth transit skeleton**, not a user center.

## Review Findings (validated)

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | `apps/account/app/page.jsx` redirects to `/login` only — no dashboard | Gap | **Partial (Worker 2: /account/overview)** |
| 2 | Register/forgot-password are placeholders | P2 gap | **Fixed (Worker 4)** |
| 3 | Login blocked without `authRequestId` — no standalone Account session | P2 gap | **Fixed (Worker 2)** |
| 4 | Connect SSO cookie stored signed plaintext `sessionToken` | **Security** | **Fixed (Worker 1)** |
| 5 | Handoff payload fabricated email / default `emailVerified=true` | **Security** | **Fixed (Worker 1)** |
| 6 | `POST /api/handoff/issue` publicly callable | **Security** | **Fixed (Worker 1)** |

## Target Architecture

Account splits into two surfaces:

1. **Auth entry** — login, register, forgot-password, verify-email, handoff
2. **User center** — overview, profile, security, sessions, applications, activity

### IA

```
/account/overview
/account/profile
/account/security
/account/sessions
/account/applications
/account/activity
/login
/register
/forgot-password
/verify-email
/reset-password
```

## Worker Dispatch Order

### Worker 1 — Security (P2 blocker)

- [x] Opaque Connect SSO cookie; `sessionToken` server-side encrypted store
- [x] Protect `POST /api/handoff/issue` with internal bearer auth
- [x] Handoff payload: trust Zitadel email/emailVerified only; no `@users.local` fabrication

### Worker 2 — Account Session (P2)

- [x] Account session cookie independent of `auth_request` (`moauth_account_session`, opaque + encrypted store)
- [x] `POST /api/login` without auth_request → `/account/overview` + session cookie
- [x] With auth_request → login then handoff (existing path)
- [x] `GET /api/me`, `POST /api/logout`
- [x] `/account/overview` skeleton with center shell navigation

### Worker 3 — Account UI Shell (P2 skeleton, P5 depth)

- [x] Navigation shell (sidebar / account menu) — all center routes linked
- [x] `/account/overview` uses live `GET /api/me`
- [x] `/account/profile` with `GET/PATCH /api/profile` (Zitadel-backed when configured)
- [x] `/account/security` + `GET /api/security` (mock summary)
- [x] `/account/sessions` + `GET /api/sessions` (mock list, includes current session)
- [x] `/account/applications` + `GET /api/applications` (mock projection placeholder)
- [x] `/account/activity` + `GET /api/activity` (mock events)

### Worker 4 — Zitadel API (P2)

- [x] `packages/zitadel-client`: register, profile R/W, password reset/change, email verify/resend
- [x] Account APIs: `/api/register`, `/api/email/verify/*`, `/api/password/*`
- [x] UI: `/register`, `/verify-email`, `/forgot-password`, `/reset-password`
- [x] Logged-in password change on `/account/security`
- [x] Dev mode returns verification codes when `NODE_ENV !== production`

### Worker 5 — Consent Projection (P5)

- [x] Connect consent allow → `account_authorized_apps`
- [x] Account `/applications` list + revoke
- [x] Connect skips consent when active projection covers requested scopes

### Worker 6 — Audit (P5)

- [x] `audit_events` for login, handoff, consent, profile/password changes
- [x] `/activity` last 20 events

## P2 Must-Have vs P5

| P2 Must | P5 Later |
|---------|----------|
| Account independent session | MFA management |
| Register + email verify | Passkey CRUD |
| Forgot/reset password | Full session revoke UI |
| Handoff primary path | Authorized apps management |
| Connect no password form | Security activity center |
| Opaque Connect session | |

## Data Model (dev minimum)

- `account_sessions`
- `connect_sessions` (opaque id → encrypted zitadel session token)
- `login_handoffs` (code hash, binding, encrypted token)
- `account_authorized_apps` (projection)
- `audit_events`

## API Surface (stable contracts)

```
POST /api/login
GET  /api/me
POST /api/logout
GET/PATCH /api/profile
POST /api/register
POST /api/email/verify/send|confirm
POST /api/password/forgot|reset|change
GET/POST/DELETE /api/security/passkeys...
GET/DELETE /api/sessions...
GET/DELETE /api/applications...
```

## Acceptance (Worker 1)

- Connect cookie value does not contain `sessionToken` plaintext
- `POST /api/handoff/issue` returns 401 without internal bearer
- Handoff payload `email=null` when Zitadel omits email; `emailVerified=false` unless explicitly true
- All existing unit/acceptance tests pass