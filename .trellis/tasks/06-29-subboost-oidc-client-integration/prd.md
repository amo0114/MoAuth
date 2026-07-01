# PRD: SubBoost OIDC Client Integration

## Goal

Implement the first real SubBoost OIDC client integration against MoAuth Connect while preserving SubBoost's local authorization boundary. A user should be able to start login from SubBoost, complete Authorization Code + PKCE through Connect, return to SubBoost callback, resolve the verified identity to an approved local SubBoost admin, and receive the existing SubBoost local session cookie.

## Scope

- Add SubBoost OIDC login start route that generates `state`, `nonce`, PKCE verifier/challenge, stores a short-lived signed transaction, and redirects to Connect `/oauth/v2/authorize`.
- Add SubBoost OIDC callback route that validates `state`, exchanges `code` with the original verifier, validates ID Token issuer/audience/nonce/expiry/signature, fetches userinfo, and resolves a local SubBoost admin.
- Keep SubBoost authorization local: only pre-approved/bound local admins may receive a SubBoost session.
- Reuse existing SubBoost local session helpers after a local admin is resolved.
- Add a login UI action for MoAuth Connect while keeping local username/password setup and fallback.
- Add focused tests for login-start, callback success, state/nonce/issuer/audience failure, unapproved identity denial, and local session reuse.

## Acceptance Criteria

- `GET /api/auth/moauth/login` redirects to Connect authorize with `response_type=code`, `client_id`, `redirect_uri`, `scope=openid profile email`, `state`, `nonce`, `code_challenge`, and `code_challenge_method=S256`.
- Login start sets an HttpOnly, SameSite=Lax, short-lived transaction cookie that stores/verifies `state`, `nonce`, and PKCE verifier without exposing the verifier to frontend JavaScript.
- `GET /api/auth/moauth/callback?code&state` rejects missing/tampered/expired transaction or mismatched state.
- Callback exchanges the code at Connect `/oauth/v2/token` using the original verifier and validates the returned ID Token using Connect JWKS/discovery.
- Callback fetches `/oidc/v1/userinfo` with the access token and maps the identity to a local approved SubBoost admin.
- Unapproved identities do not create a SubBoost session and return an access denied response.
- Approved identities reuse the existing SubBoost local session cookie and redirect to the app.
- Existing local admin password login continues to work.

## Technical Notes

- Connect dev issuer: `http://127.0.0.1:3000` unless overridden by SubBoost env.
- SubBoost dev callback: `http://127.0.0.1:3001/api/auth/moauth/callback`.
- Connect client id: `379513141119169040` for the current SubBoost dev client.
- Do not commit client secrets or real credentials. Confidential client secrets must live in ignored env files.
- If the current SubBoost model has no identity binding column, prefer the smallest local allowlist/binding change that does not grant all MoAuth users SubBoost access.

## Out of Scope

- Automatic open provisioning for all MoAuth users.
- Full account-linking UI for already logged-in local admins.
- Multi-account picker inside SubBoost.
- Logout federation/back-channel logout.
- Passkey/WebAuthn changes.
