# Identity Project Guidelines

> Project-specific baseline for Account / Connect. This file anchors the source documents in `docs/` into the Trellis workflow. Uuwu appears in early source drafts as a placeholder brand and must not be treated as a fixed runtime or product name.

## Required Reading

Before implementation, read these files according to the work area:

| Area | Required docs |
|---|---|
| Overall baseline | `docs/uuwu_00_index.md`, `docs/uuwu_01_executive_summary.md` |
| Product and acceptance | `docs/uuwu_02_prd.md` |
| Architecture decisions | `docs/uuwu_04_adr.md` |
| Work breakdown | `docs/uuwu_05_wbs_implementation_plan.md` |
| Interfaces and boundaries | `docs/uuwu_06_interface_contracts_boundaries.md` |
| Full review package | `docs/uuwu_99_full_combined.md` |

## Non-Negotiable Architecture Decisions

- Build Account / Connect as a reusable first-party identity product with configurable user-facing branding.
- Treat SubBoost as the first client application, not as the architecture owner.
- Use Zitadel as the hidden auth core; do not build a custom OAuth/OIDC server.
- Expose business app integration through OIDC Authorization Code + PKCE.
- Business apps keep local session, roles, permissions, audit, and business data.
- Keep Connect and Account as separate responsibilities from the start; production domains must be decided before Passkey/WebAuthn rollout.
- Keep Passkey/WebAuthn RP ID and Origin boundaries explicit before production.
- Default SubBoost provisioning to invite/allowlist for MVP.

## Implementation Order

1. Establish Connect/OIDC integration baseline and client registration model.
2. Analyze SubBoost auth/session/user model as the first real client.
3. Define reusable adapter contracts for future applications.
4. Build a minimal SubBoost OIDC PoC without weakening the generic Connect design.
5. Implement production-ready Connect/Login App and Account Center features after protocol and domain decisions are validated.

## Change Control

Any change to OIDC endpoints, PKCE policy, domain boundaries, Passkey RP ID, provisioning policy, or Zitadel integration mode must update the ADR and interface contract documents before code changes are finalized.
