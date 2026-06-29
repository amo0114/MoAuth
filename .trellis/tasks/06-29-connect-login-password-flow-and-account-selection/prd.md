# PRD: Connect Login Password Flow + Account Selection UI

## Goal

Wire the Connect login page to the real Zitadel Session API v2 so that a user can complete a full OIDC password-login flow through the Connect proxy, and introduce an account-selection "continue" path that reuses an existing Connect session cookie to finalize a new authRequest without re-entering credentials.

## Scope

- `/api/login` POST: password verification via Zitadel v2/sessions + finalize authRequest via v2 CreateCallback.
- `/api/login/continue` POST: reuse signed Connect session cookie (`sessionId` + `sessionToken`) to finalize a new authRequest.
- `/login` page: show target app info from authRequest lookup; show "continue as {loginName}" card when an existing session cookie is present.
- Proxy: relative `Location` header absolutization against Connect issuer (Zitadel returns relative `/ui/v2/login` paths).
- Bug fix: `createConnectSession` now honors top-level `loginName` argument (previously only read `session.loginName`, which was always undefined from `createPasswordSession`).
- E2E verification through Connect proxy: authorize → password login → token exchange → userinfo; and authorize → continue with cookie → token exchange.

## Acceptance Criteria

- `POST /api/login` with valid credentials returns `AUTH_REQUEST_FINALIZED` + `callbackUrl` pointing to client redirect URI with `code`.
- `POST /api/login` with `rememberSession=true` sets `moauth_connect_session` cookie containing `loginName`, `sessionId`, `sessionToken`.
- `POST /api/login/continue` with valid cookie + new `authRequest` returns `AUTH_REQUEST_FINALIZED` + `callbackUrl` + `loginName`.
- Token exchange at `/oauth/v2/token` succeeds with PKCE verifier; returned `id_token` has `iss=https://localhost:3000` (Connect issuer, rewritten by proxy).
- `/oidc/v1/userinfo` with returned access_token returns user profile (`sub`, `email`, `preferred_username`).
- Login page renders target app display name + scopes from authRequest lookup; renders "continue as {loginName}" card when cookie present.
- All 34 tests pass (29 pre-existing + 5 new connect-continue tests).

## Key Technical Decisions

- **Zitadel v2 CreateCallback body**: nested `{session: {sessionId, sessionToken}}`, not flat. Zitadel returns `invalid CreateCallbackRequest.CallbackKind: value is required` for flat body.
- **PAT permission**: service user needs `IAM_LOGIN_CLIENT` role to grant `session.link` permission required by finalize. Without it, Zitadel returns 403 `AUTH-AWfge "No matching permissions found"`.
- **Callback URL**: Zitadel returns `callbackUrl` pointing directly to client redirect (not Zitadel host) — no Connect proxy rewrite needed for callback.
- **Code/Token/Userinfo**: all handled directly by Zitadel through Connect proxy; proxy only rewrites issuer, Location, Set-Cookie Domain.
- **Continue endpoint**: uses `sessionId` + `sessionToken` from cookie to call finalizeAuthRequest directly, skipping password check. Session token is the proof of authentication.

## Out of Scope

- Passkey / WebAuthn flow (next task).
- SubBoost actual OIDC client integration (SubBoost still uses local Prisma admin auth).
- `prompt=select_account` multi-account picker UI (current implementation shows single existing session only).
- MFA / login policy enforcement beyond password.

## E2E Verification (2026-06-29)

### Password login closed loop
1. `GET /oauth/v2/authorize?...&prompt=select_account` → 302 to `/login?authRequest=V2_xxx`
2. `POST /api/login` {authRequest, loginName, password, rememberSession} → `AUTH_REQUEST_FINALIZED` + callbackUrl with code
3. `POST /oauth/v2/token` (authorization_code + code_verifier) → access_token (JWE 288B) + id_token (JWT 858B, `amr:["pwd"]`, `iss=https://localhost:3000`)
4. `GET /oidc/v1/userinfo` (Bearer access_token) → `{sub, name, email, preferred_username}`

### Continue with cookie
1. First login with `rememberSession=true` → cookie set with `loginName=alice`
2. New authorize → fresh authRequest
3. `POST /api/login/continue` {authRequest} with cookie → `AUTH_REQUEST_FINALIZED` + `loginName:"alice"` + callbackUrl
4. Token exchange with new PKCE verifier → valid tokens

## Files Changed

- `apps/connect/app/api/login/continue/route.js` (new)
- `apps/connect/app/api/login/route.js` (existing, no change this session)
- `apps/connect/app/login/page.jsx` (read cookie, pass existingSession)
- `apps/connect/src/ui/connect-login-page.jsx` (continue card + handleContinue)
- `apps/connect/src/oidc/connect-session.js` (loginName bug fix)
- `apps/connect/src/oidc/session.js` (nested session body + 403 handling, prior session)
- `apps/connect/src/oidc/proxy.js` (rewriteLocation, prior session)
- `apps/connect/app/globals.css` (.continue-card)
- `apps/connect/test/connect-continue.test.js` (new, 5 tests)
- `apps/connect/test/zitadel-session.test.js` (updated for nested body + 403)
- `apps/connect/test/zitadel-proxy.test.js` (updated for rewriteLocation)

## Test Environment

- Zitadel Cloud: `https://moyuan-auth-o622hw.us1.zitadel.cloud`
- Connect proxy: `http://127.0.0.1:3000`
- SubBoost callback: `http://127.0.0.1:3001/api/auth/moauth/callback`
- Client ID: `379513141119169040` (SubBoost, confidential, PKCE)
- Test user: alice (password stored outside repo; userId 379522420949660176, org 379451813012826161)
- Service user PAT granted `IAM_LOGIN_CLIENT` role.
