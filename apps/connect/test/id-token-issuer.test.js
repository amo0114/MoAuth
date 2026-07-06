import assert from "node:assert/strict";
import test from "node:test";
import { exportPKCS8, generateKeyPair, SignJWT } from "jose";

import { resetConnectJwksCacheForTests } from "../src/oidc/connect-jwks.js";
import {
  CONNECT_ID_TOKEN_RESIGN_ERROR_CODE,
  resignIdTokenForConnectIssuer,
  rewriteOidcTokenResponseBody,
} from "../src/oidc/id-token-issuer.js";

const origEnv = { ...process.env };

async function createRsaFixture() {
  const upstream = await generateKeyPair("RS256", { extractable: true });
  const connect = await generateKeyPair("RS256", { extractable: true });
  const connectPem = await exportPKCS8(connect.privateKey);
  return { upstream, connect, connectPem };
}

test("production-jwks re-signs id_token with Connect issuer and RS256", async () => {
  const { upstream, connect, connectPem } = await createRsaFixture();
  const upstreamIssuer = "https://zitadel.internal";
  const connectIssuer = "https://connect.example.com";

  const upstreamJwks = await (async () => {
    const { exportJWK } = await import("jose");
    const jwk = await exportJWK(upstream.publicKey);
    return { keys: [{ ...jwk, kid: "upstream-1", use: "sig", alg: "RS256" }] };
  })();
  const connectJwks = await (async () => {
    const { exportJWK } = await import("jose");
    const jwk = await exportJWK(connect.publicKey);
    return { keys: [{ ...jwk, kid: "connect-1", use: "sig", alg: "RS256" }] };
  })();

  const upstreamToken = await new SignJWT({
    sub: "user-1",
    iss: upstreamIssuer,
    aud: "client-a",
    nonce: "nonce-1",
  })
    .setProtectedHeader({ alg: "RS256", kid: "upstream-1" })
    .sign(upstream.privateKey);

  process.env = {
    ...origEnv,
    NODE_ENV: "production",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY: connectPem,
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID: "connect-1",
  };
  resetConnectJwksCacheForTests();

  const fetchByIssuer = async (url) => {
    const target = String(url);
    if (target.startsWith(upstreamIssuer)) {
      return new Response(JSON.stringify(upstreamJwks), { status: 200 });
    }
    if (target.startsWith(connectIssuer)) {
      return new Response(JSON.stringify(connectJwks), { status: 200 });
    }
    throw new Error(`Unexpected fetch ${target}`);
  };

  const resigned = await resignIdTokenForConnectIssuer({
    idToken: upstreamToken,
    upstreamIssuer,
    connectIssuer,
    fetchImpl: fetchByIssuer,
  });

  const { jwtVerify, createLocalJWKSet } = await import("jose");
  const verified = await jwtVerify(resigned, createLocalJWKSet(connectJwks), {
    issuer: connectIssuer,
    audience: "client-a",
  });
  assert.equal(verified.payload.iss, connectIssuer);
  assert.equal(verified.payload.sub, "user-1");
  assert.equal(verified.protectedHeader.alg, "RS256");
  assert.equal(verified.protectedHeader.kid, "connect-1");

  process.env = { ...origEnv };
  resetConnectJwksCacheForTests();
});

test("production-jwks fails closed when upstream id_token verification fails", async () => {
  const { upstream, connectPem } = await createRsaFixture();
  const upstreamIssuer = "https://zitadel.internal";
  const connectIssuer = "https://connect.example.com";
  const upstreamToken = await new SignJWT({
    sub: "user-1",
    iss: upstreamIssuer,
    aud: "client-a",
  })
    .setProtectedHeader({ alg: "RS256", kid: "upstream-1" })
    .sign(upstream.privateKey);

  process.env = {
    ...origEnv,
    NODE_ENV: "production",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY: connectPem,
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID: "connect-1",
  };
  resetConnectJwksCacheForTests();

  try {
    await assert.rejects(
      () =>
        rewriteOidcTokenResponseBody(
          { access_token: "access-token", id_token: upstreamToken },
          {
            upstreamIssuer,
            connectIssuer,
            fetchImpl: async () => {
              throw new Error("upstream JWKS unavailable");
            },
          }
        ),
      (error) => {
        assert.equal(error.code, CONNECT_ID_TOKEN_RESIGN_ERROR_CODE);
        assert.match(error.message, /re-sign/);
        return true;
      }
    );
  } finally {
    process.env = { ...origEnv };
    resetConnectJwksCacheForTests();
  }
});

test("production-jwks fails closed when Connect signing key is missing", async () => {
  const { upstream } = await createRsaFixture();
  const upstreamIssuer = "https://zitadel.internal";
  const connectIssuer = "https://connect.example.com";
  const { exportJWK } = await import("jose");
  const upstreamJwk = await exportJWK(upstream.publicKey);
  const upstreamJwks = {
    keys: [{ ...upstreamJwk, kid: "upstream-1", use: "sig", alg: "RS256" }],
  };
  const upstreamToken = await new SignJWT({
    sub: "user-1",
    iss: upstreamIssuer,
    aud: "client-a",
  })
    .setProtectedHeader({ alg: "RS256", kid: "upstream-1" })
    .sign(upstream.privateKey);

  process.env = {
    ...origEnv,
    NODE_ENV: "production",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY: "",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE: "",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID: "connect-1",
  };
  resetConnectJwksCacheForTests();

  try {
    await assert.rejects(
      () =>
        rewriteOidcTokenResponseBody(
          { access_token: "access-token", id_token: upstreamToken },
          {
            upstreamIssuer,
            connectIssuer,
            fetchImpl: async () => new Response(JSON.stringify(upstreamJwks), { status: 200 }),
          }
        ),
      (error) => {
        assert.equal(error.code, CONNECT_ID_TOKEN_RESIGN_ERROR_CODE);
        assert.match(error.message, /re-sign|signing key/);
        return true;
      }
    );
  } finally {
    process.env = { ...origEnv };
    resetConnectJwksCacheForTests();
  }
});

test("dev-hs256 re-sign is disabled in production even with secret", async () => {
  const { upstream } = await createRsaFixture();
  const upstreamIssuer = "https://zitadel.internal";
  const connectIssuer = "https://connect.example.com";
  const upstreamToken = await new SignJWT({ sub: "user-1", iss: upstreamIssuer, aud: "client-a" })
    .setProtectedHeader({ alg: "RS256" })
    .sign(upstream.privateKey);

  process.env = {
    ...origEnv,
    NODE_ENV: "production",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET: "dev-secret",
  };

  const resigned = await resignIdTokenForConnectIssuer({
    idToken: upstreamToken,
    upstreamIssuer,
    connectIssuer,
    fetchImpl: async () => new Response(JSON.stringify({ keys: [] }), { status: 200 }),
  });

  assert.equal(resigned, upstreamToken);
  process.env = { ...origEnv };
});
