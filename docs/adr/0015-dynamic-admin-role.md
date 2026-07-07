# ADR-015: Dynamic Account Administrator Role

## Status

Proposed

## Context

Account admin access currently depends on `MOAUTH_ACCOUNT_ADMIN_SUBJECTS`, a static environment list. That was acceptable for the first admin console pass, but it has production weaknesses:

- Admin changes require environment edits and process restarts.
- Session `isAdmin` can become stale after a user is demoted.
- The environment list can drift from Zitadel, the hidden identity authority.
- An administrator who removes their own admin flag needs deterministic session behavior.

This ADR only covers role storage and authorization semantics. It does not implement the feature.

## Official References

- Zitadel v2 user metadata supports listing metadata for a user through `POST /v2/users/{user_id}/metadata/search` and requires `user.read`: <https://zitadel.com/docs/reference/api/user/zitadel.user.v2.UserService.ListUserMetadata>
- Zitadel v2 user metadata supports setting key/value metadata through `POST /v2/users/{user_id}/metadata` and requires `user.write`: <https://zitadel.com/docs/reference/api/user/zitadel.user.v2.UserService.SetUserMetadata>
- Zitadel Internal Permission docs describe `CreateAdministrator` as granting administrator roles for a specific resource type: <https://zitadel.com/docs/reference/api/internal_permission>
- Zitadel AuthorizationService uses "Authorization" to mean role assignment, not OAuth authorization, and returns user/project/organization/roles data: <https://zitadel.com/docs/reference/api/authorization/zitadel.authorization.v2.AuthorizationService.ListAuthorizations>

## Decision

Use Zitadel user metadata as the source of truth for MoAuth Account admin status.

Metadata key:

```text
moauth.account.admin
```

Metadata value:

```json
{"enabled":true,"updatedBy":"<actor-sub>","updatedAt":"<iso-date>"}
```

When written through the Zitadel HTTP API, the JSON payload is encoded as UTF-8 bytes and base64 encoded in the metadata value field, matching Zitadel's metadata API contract.

Rationale:

- Account admin is a MoAuth product role, not necessarily a Zitadel organization administrator role.
- Zitadel metadata keeps the role attached to the hidden identity authority without granting broad Zitadel Console/admin powers.
- A local file or DB store would introduce a second role authority and require additional consistency rules.
- Zitadel role assignments remain useful for future Zitadel resource administration, but they are too broad and resource-specific for the Account console role.

## Alternatives Considered

### Zitadel Org/Admin Role

Rejected for MoAuth Account admin.

Zitadel administrator roles are tied to Zitadel resource administration. Granting one to make a user an Account admin would over-couple MoAuth product authorization to Zitadel operational permissions.

### Local Store

Rejected as the primary source of truth.

A local store is easy to implement and can use the same file/DB migration path as other stores, but it creates another authority for identity-level role state. If used at all, it should be a cache of Zitadel metadata, not the source.

### Static Environment List

Deprecated.

It remains useful as a bootstrap seed, but it must not be a long-lived production authorization source.

## Authorization Contract

Account session records may continue to include `isAdmin`, but only as a UI hint.

Admin API authorization must use a fresh check:

1. Read the current Account session and identify `sub`.
2. Load `moauth.account.admin` from Zitadel metadata.
3. Allow the admin action only when metadata says `enabled === true`.
4. If Zitadel metadata lookup is unavailable, fail closed with 503 for admin APIs.

The UI can use session `isAdmin` to show or hide navigation, but every `/api/admin/*` route must enforce the fresh check.

## Session Semantics

When a user logs in, Account may copy the current admin flag into the Account session for navigation rendering. This flag is not authoritative.

When an admin flag changes:

- Revoke all Account sessions for the target subject.
- If the actor demotes themselves, complete the demotion transaction, revoke the current session, clear the cookie, and return a response such as `{ "selfDemoted": true }`.
- The frontend must redirect a self-demoted administrator away from `/admin/*` after the response.

This means self-demotion takes effect immediately for admin authorization. The current request may finish, but the next admin request must fail.

## Bootstrap And Migration

`MOAUTH_ACCOUNT_ADMIN_SUBJECTS` becomes a bootstrap seed, not runtime authorization.

Migration path:

1. Add a startup/admin maintenance command that reads `MOAUTH_ACCOUNT_ADMIN_SUBJECTS`.
2. For every listed subject, set `moauth.account.admin.enabled=true` in Zitadel metadata if it is missing.
3. Log seeded subjects without printing secrets.
4. After at least one metadata-backed admin exists, production admin authorization ignores `MOAUTH_ACCOUNT_ADMIN_SUBJECTS`.
5. Keep the env var for one or two releases as an explicit bootstrap-only escape hatch, then rename or replace it with `MOAUTH_ACCOUNT_ADMIN_BOOTSTRAP_SUBJECTS`.

If metadata lookup is unavailable in production, admin routes fail closed. Local development and tests may continue to use an env shortcut behind `NODE_ENV !== "production"`.

## Guardrails

- Do not grant Zitadel organization administrator roles automatically.
- Do not rely on session `isAdmin` for authorization.
- Do not allow admin routes to fall back to the env list in production after bootstrap.
- Do not permit removing the last administrator unless an explicit break-glass bootstrap path is configured.
- Record audit events for admin promotion, demotion, and failed metadata writes.

## Implementation Follow-Up

Create a follow-up implementation task with these concrete changes:

- Add a Zitadel metadata client wrapper for list/set/delete admin metadata.
- Add `requireFreshAccountAdmin(cookieStore)` and migrate all `/api/admin/*` routes to it.
- Add admin role mutation API and UI actions currently shown as "设为管理员/取消管理员".
- Revoke Account sessions for affected users after role changes.
- Add tests for bootstrap seeding, stale session rejection, self-demotion, last-admin protection, and metadata lookup failure.
