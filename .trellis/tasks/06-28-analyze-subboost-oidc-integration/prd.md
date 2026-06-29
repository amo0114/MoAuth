# PRD: Analyze SubBoost OIDC Integration

## Goal

Analyze `external/subboost` and define the safest minimal OIDC integration path.

## Findings To Preserve

- SubBoost is currently a Next.js local app using Prisma and a local `LocalAdmin` model.
- Existing auth uses username/password, bcrypt, JWT cookie session, and `withCurrentAdmin` API guards.
- OIDC should add login start and callback routes, then reuse the existing local session.
- SubBoost authorization must remain local; a Uuwu account alone must not imply SubBoost admin access.

## Candidate Implementation Surface

- `external/subboost/local/app/api/auth/uuwu/login/route.ts`
- `external/subboost/local/app/api/auth/uuwu/callback/route.ts`
- `external/subboost/local/src/lib/session.ts`
- `external/subboost/local/src/lib/auth.ts`
- `external/subboost/local/prisma/schema.prisma`
- `external/subboost/local/src/components/local-login.tsx`

## Acceptance Criteria

- Produce an integration baseline document.
- Identify required Prisma changes for Uuwu subject binding or allowlist.
- Identify tests to add before implementation.
- Do not modify SubBoost source during this analysis task.

## Out of Scope

- Running SubBoost build or tests.
- Implementing OIDC token exchange.
- Migrating existing local admin credentials.

