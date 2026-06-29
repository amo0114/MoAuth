# PRD: Scaffold Connect Next.js App

## Goal

Create the first Connect application skeleton using the selected stack: Next.js, React, brandable CSS, and the reusable OIDC contract package. The user-facing brand must stay configurable and must not hard-code Uuwu as the product name.

## Scope

- Add `apps/connect` as a workspace package.
- Provide the first branded Connect login surface.
- Publish OIDC discovery metadata.
- Validate authorization requests against registered clients and PKCE policy.
- Register a local SubBoost dev client as the first client example.

## Acceptance Criteria

- `apps/connect` exists and is included in root workspaces.
- `/.well-known/openid-configuration` returns Connect metadata.
- `/oauth/v2/authorize` validates client, redirect URI, scope, state, prompt, and PKCE before redirecting to login.
- Tests cover discovery metadata, SubBoost dev client registration, valid authorization request, and unknown client rejection.
- SubBoost source remains unchanged.

## Out of Scope

- Zitadel Session API integration.
- Token exchange proxy.
- Real login credential handling.
- SubBoost code changes.
