# SubBoost OIDC Integration Baseline

**Date**: 2026-06-28  
**SubBoost source**: `external/subboost`  
**SubBoost commit**: `f8837fa127b543d264f24747a1e4c15f6657a3cf`  
**Integration stance**: read-only source analysis first, then minimal OIDC PoC.

## Summary

SubBoost should be treated as the first Connect client application, not as the owner of the identity architecture. The right path is to keep Connect generic and integrate SubBoost through standard OIDC Authorization Code + PKCE, then map the verified identity subject to SubBoost's local account/session model.

## Current SubBoost Auth Model

Observed files:

- `external/subboost/local/prisma/schema.prisma`
- `external/subboost/local/src/lib/session.ts`
- `external/subboost/local/src/lib/auth.ts`
- `external/subboost/local/src/lib/api-auth.ts`
- `external/subboost/local/app/api/auth/login/route.ts`
- `external/subboost/local/app/api/auth/logout/route.ts`
- `external/subboost/local/app/api/auth/me/route.ts`
- `external/subboost/local/app/api/setup/admin/route.ts`
- `external/subboost/local/src/components/local-login.tsx`

Current behavior:

- `LocalAdmin` is the local user/admin table.
- Password login uses bcrypt.
- Session is a signed JWT stored in `subboost_local_session`.
- `getCurrentAdmin()` reads the JWT and loads `LocalAdmin`.
- API protection uses `withCurrentAdmin()`.
- `/api/auth/me` returns a UI-shaped user object with quotas and counters.

## Recommended OIDC Integration Shape

Add a parallel identity login flow:

| Surface | Purpose |
|---|---|
| `/api/auth/moauth/login` | Generate `state`, `nonce`, PKCE verifier, store temporary login transaction, redirect to Connect authorization endpoint. |
| `/api/auth/moauth/callback` | Validate `state`, exchange `code` with verifier, validate ID Token, fetch userinfo, resolve local SubBoost admin, set existing SubBoost session cookie. |
| `LocalAdmin` extension or binding table | Store unique identity subject binding and optional email/profile snapshot. |
| `local-login.tsx` | Add identity login action while keeping local admin/password setup path. |

## Provisioning Policy

MVP should use invite/allowlist or explicit binding:

- If `identity_subject_id` is already bound to a `LocalAdmin`, login succeeds.
- If email matches a pre-approved local admin, bind once and login succeeds.
- If no approved mapping exists, return `APP_ACCESS_DENIED`.
- Do not auto-create SubBoost admins for all identity accounts.

## Future Application Safety

The integration must not hard-code SubBoost-only assumptions into Connect. Future applications should be configured through a reusable client contract:

- client ID and redirect URIs
- scopes and claims
- provisioning policy
- role/permission ownership boundary
- login, callback, logout, and access denied behavior

## Implementation Notes

- SubBoost root `package.json` currently requires Node `>=22.13.0 <23 || >=24.0.0`; the current local environment is Node 20, so running builds/tests will need a Node switch.
- `jose` is already present in SubBoost dependencies and can support JWT/JWKS validation.
- Existing session helpers can likely be reused after OIDC callback resolves a local admin.
- Required tests should mirror `external/subboost/local/app/api/auth/local-auth-routes.test.ts`.
