# PRD: Define Reusable OIDC Client Contract

## Goal

Define a client integration contract that works for SubBoost and future Uuwu applications.

## Required Decisions

- OIDC discovery, authorization, token, userinfo, logout endpoints.
- Authorization Code + PKCE requirements, including `S256`.
- Required scopes and claims.
- Client registration and redirect URI validation model.
- Local session responsibilities for business applications.
- Provisioning policy: invite, allowlist, manual binding, or automatic creation.
- Standard error semantics such as `APP_ACCESS_DENIED`, `STATE_MISMATCH`, and `PKCE_VERIFICATION_FAILED`.

## Inputs

- `docs/uuwu_04_adr.md`
- `docs/uuwu_06_interface_contracts_boundaries.md`
- `.trellis/spec/identity/index.md`

## Acceptance Criteria

- Produce a contract document that can be implemented by multiple apps.
- Explicitly describe what belongs to Connect and what remains inside each business app.
- Include SubBoost as an example client without making SubBoost-specific fields mandatory for all clients.

## Out of Scope

- Coding Connect endpoints.
- Coding SubBoost routes.
- Changing Zitadel configuration.

