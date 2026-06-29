import assert from "node:assert/strict";
import test from "node:test";
import {
  OIDC_CONTRACT_ERROR_CODES,
  PROVISIONING_DECISIONS,
  assertProvisioningAllowed,
  buildAuthorizationUrl,
  buildDiscoveryMetadata,
  createPkceChallenge,
  createPkceVerifier,
  decideProvisioning,
  validateAuthorizationRequest,
  validateRegisteredClient,
} from "../src/index.js";

const RFC_7636_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_7636_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

test("creates and validates PKCE S256 values", () => {
  assert.equal(createPkceChallenge(RFC_7636_VERIFIER), RFC_7636_CHALLENGE);
  const verifier = createPkceVerifier();
  const challenge = createPkceChallenge(verifier);
  assert.equal(verifier.length, 43);
  assert.equal(challenge.length, 43);
});

test("builds Connect discovery metadata with S256 only", () => {
  const metadata = buildDiscoveryMetadata({ issuer: "https://connect.example.com/" });
  assert.equal(metadata.issuer, "https://connect.example.com");
  assert.equal(metadata.authorization_endpoint, "https://connect.example.com/oauth/v2/authorize");
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(metadata.scopes_supported, ["openid", "profile", "email"]);
});

test("validates a reusable SubBoost-style client registration", () => {
  const client = subboostClient();
  assert.equal(client.clientId, "subboost-prod");
  assert.equal(client.provisioningPolicy, "allowlist");
  assert.deepEqual(client.requiredScopes, ["openid", "profile", "email"]);
});

test("rejects unsafe client registration defaults", () => {
  assert.throws(
    () =>
      validateRegisteredClient({
        clientId: "bad",
        displayName: "Bad App",
        redirectUris: ["http://subboost.example.com/api/auth/moauth/callback"],
        provisioningPolicy: "allowlist",
      }),
    { code: OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION }
  );

  assert.throws(
    () =>
      validateRegisteredClient({
        clientId: "bad-url",
        displayName: "Bad URL App",
        redirectUris: ["not-a-url"],
        provisioningPolicy: "allowlist",
      }),
    { code: OIDC_CONTRACT_ERROR_CODES.INVALID_CLIENT_REGISTRATION }
  );
});

test("validates authorization request with exact redirect URI and S256 PKCE", () => {
  const client = subboostClient();
  const request = validateAuthorizationRequest(
    {
      client_id: "subboost-prod",
      redirect_uri: "https://subboost.example.com/api/auth/moauth/callback",
      response_type: "code",
      scope: "openid profile email",
      state: "state_01234567890123456789",
      nonce: "nonce_0123456789abcdef",
      code_challenge: RFC_7636_CHALLENGE,
      code_challenge_method: "S256",
      prompt: "select_account",
    },
    client
  );

  assert.deepEqual(request.scopes, ["openid", "profile", "email"]);
  assert.deepEqual(request.prompt, ["select_account"]);

  const url = buildAuthorizationUrl("https://connect.example.com/oauth/v2/authorize", request);
  assert.match(url, /^https:\/\/connect\.example\.com\/oauth\/v2\/authorize\?/);
  assert.match(url, /code_challenge_method=S256/);
});

test("rejects redirect URI mismatch", () => {
  assert.throws(
    () =>
      validateAuthorizationRequest(
        {
          client_id: "subboost-prod",
          redirect_uri: "https://attacker.example.com/callback",
          response_type: "code",
          scope: "openid profile email",
          state: "state_01234567890123456789",
          code_challenge: RFC_7636_CHALLENGE,
          code_challenge_method: "S256",
        },
        subboostClient()
      ),
    { code: OIDC_CONTRACT_ERROR_CODES.REDIRECT_URI_MISMATCH }
  );
});

test("rejects authorization request without required scopes or S256 PKCE", () => {
  assert.throws(
    () =>
      validateAuthorizationRequest(
        {
          client_id: "subboost-prod",
          redirect_uri: "https://subboost.example.com/api/auth/moauth/callback",
          response_type: "code",
          scope: "openid profile",
          state: "state_01234567890123456789",
          code_challenge: RFC_7636_CHALLENGE,
          code_challenge_method: "S256",
        },
        subboostClient()
      ),
    { code: OIDC_CONTRACT_ERROR_CODES.UNSUPPORTED_SCOPE }
  );

  assert.throws(
    () =>
      validateAuthorizationRequest(
        {
          client_id: "subboost-prod",
          redirect_uri: "https://subboost.example.com/api/auth/moauth/callback",
          response_type: "code",
          scope: "openid profile email",
          state: "state_01234567890123456789",
          code_challenge: "plain",
          code_challenge_method: "plain",
        },
        subboostClient()
      ),
    { code: OIDC_CONTRACT_ERROR_CODES.PKCE_REQUIRED }
  );
});

test("keeps SubBoost provisioning local and deny-by-default", () => {
  assert.deepEqual(decideProvisioning("allowlist", { hasSubjectBinding: true }), {
    decision: PROVISIONING_DECISIONS.LOGIN_EXISTING,
    errorCode: null,
  });
  assert.deepEqual(
    decideProvisioning("allowlist", {
      hasApprovedLocalAccount: true,
      emailVerified: true,
    }),
    {
      decision: PROVISIONING_DECISIONS.BIND_AND_LOGIN,
      errorCode: null,
    }
  );
  assert.deepEqual(decideProvisioning("allowlist", { emailVerified: true }), {
    decision: PROVISIONING_DECISIONS.DENY,
    errorCode: OIDC_CONTRACT_ERROR_CODES.APP_ACCESS_DENIED,
  });
  assert.deepEqual(
    decideProvisioning("auto-create", {
      hasApprovedLocalAccount: true,
      emailVerified: true,
    }),
    {
      decision: PROVISIONING_DECISIONS.BIND_AND_LOGIN,
      errorCode: null,
    }
  );
  assert.throws(() => assertProvisioningAllowed("manual-binding", { emailVerified: true }), {
    code: OIDC_CONTRACT_ERROR_CODES.APP_ACCESS_DENIED,
  });
});

function subboostClient() {
  return validateRegisteredClient({
    clientId: "subboost-prod",
    displayName: "SubBoost",
    clientType: "confidential",
    redirectUris: ["https://subboost.example.com/api/auth/moauth/callback"],
    allowedScopes: ["openid", "profile", "email"],
    allowedPrompts: ["login", "select_account", "consent"],
    provisioningPolicy: "allowlist",
  });
}
