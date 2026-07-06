import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  evaluateAuthorizedAppsStoreWarnings,
  evaluateDiscoveryDocument,
  evaluateJwksDocument,
  evaluateStaticProductionGates,
  resolveAuthorizedAppsStoreBackend,
} from "../lib/oidc-production-gates.mjs";

test("static production gates require production-jwks and forbid dev-hs256", () => {
  const result = evaluateStaticProductionGates({
    NODE_ENV: "production",
    MOAUTH_CONNECT_ISSUER: "https://connect.example.com",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY:
      "-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG: "RS256",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID: "connect-1",
    MOAUTH_CONNECT_SESSION_SECRET: "connect-session-secret",
    MOAUTH_CONNECT_TRANSACTION_SECRET: "connect-transaction-secret",
    MOAUTH_ACCOUNT_SESSION_SECRET: "account-session-secret",
    MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-token",
    SUBBOOST_MOAUTH_TX_SECRET: "subboost-tx-secret",
  });

  assert.equal(result.passed, true);
  assert.equal(result.signingMode, "production-jwks");
});

test("static production gates fail when dev-hs256 is configured in production", () => {
  const result = evaluateStaticProductionGates({
    NODE_ENV: "production",
    MOAUTH_CONNECT_ISSUER: "https://connect.example.com",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "dev-hs256",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET: "dev-secret",
    MOAUTH_CONNECT_SESSION_SECRET: "connect-session-secret",
    MOAUTH_CONNECT_TRANSACTION_SECRET: "connect-transaction-secret",
    MOAUTH_ACCOUNT_SESSION_SECRET: "account-session-secret",
    MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-token",
    SUBBOOST_MOAUTH_TX_SECRET: "subboost-tx-secret",
  });

  assert.equal(result.passed, false);
  const modeCheck = result.checks.find((item) => item.name === "production_signing_mode");
  assert.equal(modeCheck.passed, false);
});

test("static production gates require runtime secrets", () => {
  const result = evaluateStaticProductionGates({
    NODE_ENV: "production",
    MOAUTH_CONNECT_ISSUER: "https://connect.example.com",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY:
      "-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----",
  });

  assert.equal(result.passed, false);
  for (const name of [
    "moauth_connect_session_secret_present",
    "moauth_connect_transaction_secret_present",
    "moauth_account_session_secret_present",
    "moauth_handoff_internal_token_present",
  ]) {
    const item = result.checks.find((check) => check.name === name);
    assert.equal(item.status, "FAIL");
  }
});

test("static production gates accept PRIVATE_KEY_FILE without inline PEM", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "moauth-signing-"));
  const keyPath = path.join(dir, "private.pem");
  await writeFile(
    keyPath,
    "-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n",
    "utf8"
  );

  const result = evaluateStaticProductionGates({
    NODE_ENV: "production",
    MOAUTH_CONNECT_ISSUER: "https://connect.example.com",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE: keyPath,
    MOAUTH_CONNECT_SESSION_SECRET: "connect-session-secret",
    MOAUTH_CONNECT_TRANSACTION_SECRET: "connect-transaction-secret",
    MOAUTH_ACCOUNT_SESSION_SECRET: "account-session-secret",
    MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-token",
    SUBBOOST_MOAUTH_TX_SECRET: "subboost-tx-secret",
  });

  assert.equal(result.passed, true);
  const readable = result.checks.find((item) => item.name === "production_private_key_readable");
  assert.equal(readable.passed, true);
});

test("discovery evaluation enforces same-origin endpoints and no dev marker", () => {
  const issuer = "https://connect.example.com";
  const result = evaluateDiscoveryDocument(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/v2/authorize`,
      token_endpoint: `${issuer}/oauth/v2/token`,
      jwks_uri: `${issuer}/oauth/v2/keys`,
      moauth_dev_id_token_resign: false,
    },
    issuer,
    { production: true }
  );

  assert.equal(result.passed, true);
});

test("discovery evaluation fails when dev resign marker is present in production", () => {
  const issuer = "https://connect.example.com";
  const result = evaluateDiscoveryDocument(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/v2/authorize`,
      token_endpoint: `${issuer}/oauth/v2/token`,
      jwks_uri: `${issuer}/oauth/v2/keys`,
      moauth_dev_id_token_resign: true,
    },
    issuer,
    { production: true }
  );

  assert.equal(result.passed, false);
});

test("jwks evaluation matches configured kid and alg", () => {
  const result = evaluateJwksDocument(
    {
      keys: [{ kid: "connect-1", alg: "RS256", use: "sig", kty: "RSA", n: "abc", e: "AQAB" }],
    },
    { configuredAlg: "RS256", configuredKid: "connect-1" }
  );

  assert.equal(result.passed, true);
});

test("production file authorized-apps store emits release warning", () => {
  assert.equal(resolveAuthorizedAppsStoreBackend({ NODE_ENV: "production" }), "file");
  const warnings = evaluateAuthorizedAppsStoreWarnings({
    NODE_ENV: "production",
    MOAUTH_AUTHORIZED_APPS_STORE: "file",
  });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].status, "WARN");
});

test("test runtime keeps memory authorized-apps store without warning", () => {
  assert.equal(resolveAuthorizedAppsStoreBackend({ NODE_ENV: "test" }), "memory");
  const warnings = evaluateAuthorizedAppsStoreWarnings({ NODE_ENV: "test" });
  assert.equal(warnings.length, 0);
});

test("subboost production gate rejects upstream issuer fallback", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "moauth-subboost-env-"));
  const envPath = path.join(dir, ".env");
  await writeFile(
    envPath,
    "NODE_ENV=production\nMOAUTH_CONNECT_ALLOW_UPSTREAM_ISSUER_FALLBACK=true\n",
    "utf8"
  );

  const result = evaluateStaticProductionGates(
    {
      NODE_ENV: "development",
      MOAUTH_CONNECT_ISSUER: "https://connect.example.com",
    },
    { subboostEnvFile: envPath }
  );

  const fallback = result.checks.find(
    (item) => item.name === "subboost_production_upstream_fallback_disabled"
  );
  assert.equal(fallback.passed, false);
  assert.equal(fallback.status, "FAIL");
});

test("subboost production gate requires MoAuth transaction secret", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "moauth-subboost-env-"));
  const envPath = path.join(dir, ".env");
  await writeFile(envPath, "NODE_ENV=production\n", "utf8");

  const result = evaluateStaticProductionGates(
    {
      NODE_ENV: "development",
      MOAUTH_CONNECT_ISSUER: "https://connect.example.com",
    },
    { subboostEnvFile: envPath }
  );

  const txSecret = result.checks.find(
    (item) => item.name === "subboost_moauth_tx_secret_present"
  );
  assert.equal(txSecret.passed, false);
  assert.equal(txSecret.status, "FAIL");
});
