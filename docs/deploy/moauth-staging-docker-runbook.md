# MoAuth Staging Docker Deployment Runbook

This runbook deploys a single-node staging stack for MoAuth:

- Caddy public HTTPS edge
- self-hosted Zitadel + Postgres
- MoAuth Connect
- MoAuth Account
- SubBoost + Postgres

The target of this runbook is **staging release readiness evidence**, not final production hardening. The file stores used by Connect/Account are single-instance only and require sign-off before Production GO.

## 1. Prerequisites

- One Linux server with Docker Engine and Docker Compose v2.
- DNS A/AAAA records pointing to the server:
  - `connect.staging.example.com`
  - `account.staging.example.com`
  - `app.staging.example.com`
  - `id.staging.example.com`
- Inbound `80/tcp` and `443/tcp` open for Caddy and ACME.
- A checked-out MoAuth repository on the server.
- Access to GHCR images published by GitHub Actions. If the packages are private, run `docker login ghcr.io` on the server with a token that can read packages.

Zitadel is self-hosted in this compose stack. It is still a hidden auth core: business apps trust only the Connect issuer, and normal browser flows must not show the Zitadel domain.

## 2. Prepare Staging Env

From the repository root:

```bash
cp deploy/staging/.env.example deploy/staging/.env
mkdir -p deploy/staging/secrets/connect-signing
```

Edit `deploy/staging/.env`:

- replace all `*.staging.example.com` hosts with real staging domains
- set `MOAUTH_IMAGE_TAG` to the exact image tag to deploy. Prefer `sha-<commit>` over `main` for reproducible staging evidence.
- replace every `change-me-*` value
- keep `.env` and `deploy/staging/secrets/` out of git

Generate random secrets:

```bash
openssl rand -base64 48
```

Generate the Connect signing key:

```bash
npm run moauth:generate-signing-keys
cp secrets/connect-signing/private.pem deploy/staging/secrets/connect-signing/private.pem
```

The public key may be archived, but the private key must stay in secret storage only.

## 3. First Zitadel Bootstrap

Start only Zitadel and its database first:

```bash
cd deploy/staging
docker compose up -d zitadel-db zitadel
docker compose logs -f zitadel
```

After Zitadel is healthy, extract the generated service user PAT:

```bash
docker compose exec zitadel sh -c 'cat /bootstrap/connect-service.pat'
```

Copy that value into `deploy/staging/.env` as `ZITADEL_SERVICE_USER_TOKEN`.

Then create or confirm the Zitadel project/application for SubBoost:

- Application type: OIDC
- Flow: Authorization Code + PKCE
- Redirect URI: `https://app.staging.example.com/api/auth/moauth/callback`
- Post logout URI, if used: `https://app.staging.example.com/`
- Record the Zitadel `client_id`

Put that client id into `MOAUTH_CONNECT_CLIENT_ID`. If the app is confidential, also set `MOAUTH_CONNECT_CLIENT_SECRET`.

## 4. Pull And Start The Stack

MoAuth runtime images are built by GitHub Actions and published to GHCR:

- `ghcr.io/amo0114/moauth-connect`
- `ghcr.io/amo0114/moauth-account`
- `ghcr.io/amo0114/moauth-subboost`

The image workflow publishes these tags:

- `main` for the latest `main` branch build
- `sha-<full-git-sha>` for immutable deploys
- `v*` for release tags

For staging evidence, pin `MOAUTH_IMAGE_TAG` in `deploy/staging/.env` to the `sha-...` tag from the successful image workflow run.

From `deploy/staging`:

```bash
docker compose pull connect account subboost
docker compose up -d
docker compose ps
```

Expected services:

- `caddy`
- `zitadel-db`
- `zitadel`
- `connect`
- `account`
- `subboost-db`
- `subboost`
- `subboost-cron`

Local or emergency server-side builds are still available through the explicit build override:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml build connect account subboost
docker compose up -d
```

Do not use the build override for release evidence unless you explicitly record that the server rebuilt images locally instead of deploying the CI-published artifact.

## 5. Smoke Checks

Run these from a machine that can reach staging HTTPS:

```bash
curl -fsS https://connect.staging.example.com/.well-known/openid-configuration
curl -fsS https://connect.staging.example.com/oauth/v2/keys
curl -fsS https://account.staging.example.com/api/health/ready
curl -fsS https://app.staging.example.com/api/health/live
```

Check the Connect JWKS does not contain private JWK fields:

```bash
curl -fsS https://connect.staging.example.com/oauth/v2/keys \
  | jq '.keys[] | has("d") or has("p") or has("q") or has("dp") or has("dq") or has("qi") or has("oth")'
```

Every line should be `false`.

## 6. Release Gate

From the repository root on the staging verification host:

```bash
export NODE_ENV=production
export MOAUTH_CONNECT_ISSUER=https://connect.staging.example.com
export MOAUTH_CONNECT_PUBLIC_URL=https://connect.staging.example.com
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE=production-jwks
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE=/absolute/path/to/deploy/staging/secrets/connect-signing/private.pem
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID=moauth-connect-staging-1
export MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG=RS256
export MOAUTH_CONNECT_SESSION_SECRET=<redacted>
export MOAUTH_CONNECT_TRANSACTION_SECRET=<redacted>
export MOAUTH_ACCOUNT_SESSION_SECRET=<redacted>
export MOAUTH_HANDOFF_INTERNAL_TOKEN=<redacted>
export MOAUTH_VERIFY_SUBBOOST_ENV_FILE=/absolute/path/to/deploy/staging/.env

npm run moauth:verify-oidc:release
```

Archive the terminal output:

```bash
mkdir -p artifacts
npm run moauth:verify-oidc:release 2>&1 | tee artifacts/staging-oidc-release-$(date +%F).log
```

## 7. id_token Deep Verification

After a successful browser E1 login, extract a real staging `id_token` from the token response or SubBoost session handling path. Do not commit or paste the token into docs.

```bash
export MOAUTH_VERIFY_ID_TOKEN="<jwt>"
export MOAUTH_VERIFY_CLIENT_ID="<subboost_client_id>"
npm run moauth:verify-oidc:release
```

Required result:

- `id_token_iss_matches_discovery` PASS
- `id_token_aud_contains_client_id` PASS
- `id_token_signature_valid_with_connect_jwks` PASS

## 8. Browser P0 Evidence

Complete and record these scenarios from `docs/reviews/moauth-staging-deployment-acceptance.md`:

- E1: first SubBoost authorization
- E2: warm SSO / no repeated consent
- E6: Account unavailable fail-closed
- E7: authorized-apps unavailable fail-closed
- E9: public domain consistency

Evidence must include screenshot or recording, final URL, operator, timestamp, and any failure injection steps.

## 9. File Store Sign-off

This compose stack uses file stores by default:

- `MOAUTH_CLIENT_REGISTRY_STORE=file`
- `MOAUTH_AUTHORIZED_APPS_STORE=file`

This is acceptable only for a single staging/production replica. Before horizontal scaling, migrate these stores to a shared DB-backed implementation or record a single-instance sign-off in the staging acceptance record.

## 10. Rollback

```bash
cd deploy/staging
docker compose ps
docker compose logs --tail=200 connect account subboost
docker compose down
```

Data volumes are not removed by `docker compose down`. Do not run `docker compose down -v` unless you intentionally want to destroy staging data.
