import assert from "node:assert/strict";
import test from "node:test";

import { buildOidcAppPayload } from "../src/applications.js";

test("buildOidcAppPayload uses authorization code + PKCE-friendly defaults", () => {
  const payload = buildOidcAppPayload({
    name: "MoNexus",
    redirectUris: ["http://127.0.0.1:3003/api/auth/moauth/callback"],
    postLogoutRedirectUris: ["http://127.0.0.1:3003/"],
    clientType: "confidential",
    devMode: true,
  });

  assert.equal(payload.name, "MoNexus");
  assert.deepEqual(payload.responseTypes, ["OIDC_RESPONSE_TYPE_CODE"]);
  assert.deepEqual(payload.grantTypes, ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"]);
  assert.equal(payload.authMethodType, "OIDC_AUTH_METHOD_TYPE_BASIC");
  assert.equal(payload.devMode, true);
});