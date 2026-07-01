# Identity Connect OIDC Client Contract

**Status**: initial implementation baseline  
**Package**: `packages/connect-contract`  
**Purpose**: keep SubBoost and future applications on the same Identity Connect integration rules.

## Contract Rules

- Business applications use OIDC Authorization Code + PKCE.
- `code_challenge_method` must be `S256`.
- Required scopes are `openid profile email`.
- **Required identity claims** (callback must fail if missing): `sub`, `email`, `email_verified`.
- **Optional profile claims** (use when present; absence or empty value must not fail login): `name`, `preferred_username`, `picture`.
- Redirect URIs must match registration exactly.
- Production redirect URIs must use HTTPS.
- Business applications own local session, roles, permissions, quota, and audit.
- Provisioning policy must be explicit per client.

## Provisioning Policies

| Policy | Behavior |
|---|---|
| `invite` | Existing subject binding may login. Approved local account plus verified email may bind once. Otherwise deny. |
| `allowlist` | Same as invite; intended for configured approved accounts or domains. |
| `manual-binding` | Only existing subject bindings may login. |
| `auto-create` | Verified email may create a local account. Not recommended for SubBoost admin MVP. |

SubBoost MVP should use `allowlist` or `invite`. A valid identity account must not automatically become a SubBoost administrator.

## First Package Surface

- `validateRegisteredClient()`
- `validateAuthorizationRequest()`
- `buildDiscoveryMetadata()`
- `buildAuthorizationUrl()`
- `createPkceVerifier()`
- `createPkceChallenge()`
- `decideProvisioning()`
- `assertProvisioningAllowed()`

## Next Implementation Step

Use this package when adding SubBoost routes:

- `GET /api/auth/moauth/login`
- `GET /api/auth/moauth/callback`

The SubBoost callback should resolve the identity provider `sub` to a local `LocalAdmin`, then reuse SubBoost's existing local session helper.
