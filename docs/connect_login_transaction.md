# Identity Connect Login Transaction

**Status**: initial implementation baseline  
**App**: `apps/connect`

## Purpose

The authorization endpoint now turns a validated OIDC authorization request into a short-lived login transaction before showing the login page.

This keeps the browser-facing login UI connected to the original OIDC request without putting the full request in visible query parameters.

## Current Storage

The first implementation stores the transaction as a signed HttpOnly cookie:

- Cookie name: `moauth_connect_tx`
- TTL: 10 minutes
- SameSite: `Lax`
- HttpOnly: `true`
- Secure: enabled when the request uses HTTPS
- Payload signature: HMAC-SHA256

The cookie includes:

- transaction id
- client id and display name
- redirect URI
- scopes
- state and nonce
- PKCE challenge and method
- prompt values
- creation and expiration timestamps

## Flow

1. Business app redirects to `/oauth/v2/authorize`.
2. Connect validates client, redirect URI, scopes, state, prompt, and PKCE.
3. Connect creates a login transaction.
4. Connect sets the signed transaction cookie.
5. Connect redirects to `/login?tx=<transaction_id>`.
6. Login page reads and validates the transaction cookie before showing app context.

## Production Note

The signed cookie keeps this first implementation small and testable. For production, replace the storage behind this module with Redis or database-backed state if the deployment model needs cross-instance revocation, larger transaction payloads, or centralized audit.
