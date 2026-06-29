# PRD: Uuwu Connect MVP Foundation

## Goal

Start development from the reusable Uuwu Account / Uuwu Connect identity product, with SubBoost as the first client application.

## Scope

- Establish Trellis-managed project workflow for the current repository.
- Keep `docs/uuwu_*.md` as the signed architecture and product baseline.
- Define the first executable tasks for Connect/OIDC contracts and SubBoost integration analysis.
- Avoid coupling the identity architecture to SubBoost-only assumptions.

## Acceptance Criteria

- Trellis context works locally through `.trellis/scripts/get_context.py`.
- Project-specific identity spec exists under `.trellis/spec/identity/`.
- SubBoost is tracked as an external dependency, not copied into first-party identity source.
- Child tasks exist for reusable OIDC contract work and SubBoost integration analysis.

## Out of Scope

- Implementing the production Login App.
- Modifying SubBoost source.
- Deploying Zitadel or creating production OIDC clients.

