import assert from "node:assert/strict";
import test from "node:test";

import { resetClientRegistryStoreForTests } from "../src/client-registry/store.js";
import { listRegisteredClients } from "../src/config/clients.js";
import { getDiscoveryMetadata } from "../src/oidc/discovery.js";
import { parseAuthorizeRequest, resolveAuthorizeRequest } from "../src/oidc/authorize.js";
import {
  LOGIN_TRANSACTION_ERROR_CODES,
  createLoginTransaction,
  readLoginTransactionFromCookie,
  signLoginTransaction,
} from "../src/oidc/transaction.js";

const SUBBOOST_DEV_CLIENT_ID = "380559739236450307";
const VALID_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

test.beforeEach(() => {
  resetClientRegistryStoreForTests();
});

test("publishes Connect OIDC discovery metadata", () => {
  const metadata = getDiscoveryMetadata();
  assert.equal(metadata.issuer, "http://127.0.0.1:3000");
  assert.equal(metadata.authorization_endpoint, "http://127.0.0.1:3000/oauth/v2/authorize");
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
});

test("registers SubBoost dev as allowlist client", () => {
  const [client] = listRegisteredClients();
  assert.equal(client.clientId, SUBBOOST_DEV_CLIENT_ID);
  assert.equal(client.provisioningPolicy, "allowlist");
  assert.deepEqual(client.redirectUris, ["http://127.0.0.1:3001/api/auth/moauth/callback"]);
});

test("accepts a valid authorization request for SubBoost dev", () => {
  const request = parseAuthorizeRequest(
    new URLSearchParams({
      client_id: SUBBOOST_DEV_CLIENT_ID,
      redirect_uri: "http://127.0.0.1:3001/api/auth/moauth/callback",
      response_type: "code",
      scope: "openid profile email",
      state: "state_01234567890123456789",
      nonce: "nonce_0123456789abcdef",
      code_challenge: VALID_CHALLENGE,
      code_challenge_method: "S256",
      prompt: "select_account",
    })
  );

  assert.equal(request.clientId, SUBBOOST_DEV_CLIENT_ID);
  assert.deepEqual(request.scopes, ["openid", "profile", "email"]);
});

test("rejects unknown clients before login flow starts", () => {
  assert.throws(
    () =>
      parseAuthorizeRequest(
        new URLSearchParams({
          client_id: "unknown",
          redirect_uri: "http://127.0.0.1:3001/api/auth/moauth/callback",
          response_type: "code",
          scope: "openid profile email",
          state: "state_01234567890123456789",
          code_challenge: VALID_CHALLENGE,
          code_challenge_method: "S256",
        })
      ),
    { code: "INVALID_AUTHORIZATION_REQUEST" }
  );
});

test("creates and verifies a signed login transaction", () => {
  const { authRequest, client } = resolveAuthorizeRequest(validAuthorizeParams());
  const now = new Date("2026-06-28T12:00:00.000Z");
  const transaction = createLoginTransaction(authRequest, client, now);
  const cookieValue = signLoginTransaction(transaction, "test-secret");
  const verified = readLoginTransactionFromCookie(cookieValue, transaction.id, now, "test-secret");

  assert.equal(verified.clientId, SUBBOOST_DEV_CLIENT_ID);
  assert.equal(verified.clientDisplayName, "SubBoost");
  assert.equal(verified.redirectUri, "http://127.0.0.1:3001/api/auth/moauth/callback");
  assert.deepEqual(verified.scopes, ["openid", "profile", "email"]);
  assert.equal(verified.expiresAt, "2026-06-28T12:10:00.000Z");
});

test("rejects tampered or expired login transactions", () => {
  const { authRequest, client } = resolveAuthorizeRequest(validAuthorizeParams());
  const now = new Date("2026-06-28T12:00:00.000Z");
  const transaction = createLoginTransaction(authRequest, client, now);
  const cookieValue = signLoginTransaction(transaction, "test-secret");

  assert.throws(() => readLoginTransactionFromCookie(`${cookieValue}x`, transaction.id, now, "test-secret"), {
    code: LOGIN_TRANSACTION_ERROR_CODES.LOGIN_TRANSACTION_INVALID,
  });
  assert.throws(() => readLoginTransactionFromCookie(cookieValue, transaction.id, new Date("2026-06-28T12:11:00.000Z"), "test-secret"), {
    code: LOGIN_TRANSACTION_ERROR_CODES.LOGIN_TRANSACTION_EXPIRED,
  });
  assert.throws(() => readLoginTransactionFromCookie(cookieValue, "other-id", now, "test-secret"), {
    code: LOGIN_TRANSACTION_ERROR_CODES.LOGIN_TRANSACTION_INVALID,
  });
});

function validAuthorizeParams() {
  return new URLSearchParams({
    client_id: SUBBOOST_DEV_CLIENT_ID,
    redirect_uri: "http://127.0.0.1:3001/api/auth/moauth/callback",
    response_type: "code",
    scope: "openid profile email",
    state: "state_01234567890123456789",
    nonce: "nonce_0123456789abcdef",
    code_challenge: VALID_CHALLENGE,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
}
