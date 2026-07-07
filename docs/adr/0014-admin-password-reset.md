# ADR-014: Admin-Initiated Password Reset

## Status

Accepted

## Context

Account Admin currently shows a "重置密码" action in user management, but the action was not wired to a backend API. The implementation must respect MoAuth's identity boundary:

- Zitadel remains the hidden authentication authority.
- Account does not store or verify password hashes.
- Administrators must not receive or set a user's plaintext password.
- Password-reset activity must be auditable.

Two implementation options were considered:

- Option A: call Zitadel `requestPasswordReset` so Zitadel sends the reset link or code to the user.
- Option B: call a direct password-set API so an administrator sets a temporary password.

## Decision

Use Option A.

Admin password reset is modeled as a reset request, not as administrator password assignment. `POST /api/admin/users/{id}/reset-password` calls Zitadel `requestPasswordReset(userId)` and lets Zitadel deliver the reset link to the user's registered channel.

The API rejects administrator self-reset. Administrators must use the user-facing forgot-password or change-password flow for their own account.

## Consequences

- Administrators never see or handle plaintext passwords or one-time reset codes.
- Audit events record `admin_user_password_reset_requested` with the actor subject and target user id.
- Zitadel rate limiting is surfaced as HTTP 429 with a user-safe message.
- Generic Zitadel failures are surfaced as HTTP 502 with a user-safe message.
- A missing target user is surfaced as HTTP 404.

## Implementation Notes

- Backend service: `apps/account/src/admin/users-api.js#requestUserPasswordReset`
- Route: `apps/account/app/api/admin/users/[id]/reset-password/route.js`
- UI: `apps/account/src/features/admin/components/AdminUsers.tsx`
- Audit event type: `ADMIN_USER_PASSWORD_RESET_REQUESTED`

## Follow-Ups

Dynamic administrator role management is out of scope for this ADR and should be handled by a separate ADR.
