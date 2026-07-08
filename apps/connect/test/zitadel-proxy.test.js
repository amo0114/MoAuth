import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  annotateDevIdTokenResignDiscovery,
  annotateProductionIdTokenSigningDiscovery,
  proxyToZitadel,
  resolveProxyPublicHost,
  resolveProxyPublicProto,
  rewriteDiscovery,
  rewriteHostedLoginLocation,
  rewriteLocation,
  normalizeConnectPublicUrl,
  rewriteSetCookieDomain,
  rewriteUrl,
  shouldProxyZitadel,
} from "../src/oidc/proxy.js";
import { proxyToZitadel as proxyNodeToZitadel } from "../src/oidc/proxy-node.js";
import { CONNECT_ID_TOKEN_RESIGN_ERROR_CODE } from "../src/oidc/id-token-issuer.js";

const origEnv = { ...process.env };

function withEnv(partial, fn) {
  return async () => {
    process.env = {
      ...origEnv,
      ZITADEL_API_BASE: "https://id.zitadel.example.com",
      ZITADEL_ISSUER: "https://id.zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test-token",
      MOAUTH_CONNECT_ISSUER: "https://connect.example.com",
      MOAUTH_CONNECT_PUBLIC_URL: "https://connect.example.com",
      ...partial,
    };
    for (const key of [
      "MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET",
      "MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY",
      "MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE",
      "MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID",
      "MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG",
    ]) {
      if (!(key in partial)) {
        delete process.env[key];
      }
    }
    try {
      return await fn();
    } finally {
      process.env = { ...origEnv };
    }
  };
}

function makeRequest({ method = "GET", url = "https://connect.example.com/oauth/v2/authorize?client_id=subboost-dev", headers = {}, body = null } = {}) {
  const request = new Request(url, { method, headers, body: body ?? undefined });
  return request;
}

function makeMockFetch(responses) {
  const calls = [];
  const fetchMock = async (upstreamUrl, init) => {
    calls.push({ upstreamUrl: String(upstreamUrl), init });
    const responder = responses[String(upstreamUrl)] || responses["*"];
    if (!responder) throw new Error(`Unexpected upstream fetch ${upstreamUrl}`);
    const result = typeof responder === "function" ? responder(init) : responder;
    const status = result.status ?? 200;
    const headers = new Headers(result.headers || {});
    if (result.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", typeof result.body === "string" && result.body.startsWith("{") ? "application/json" : "text/plain");
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      headers,
      arrayBuffer: async () => {
        const body = result.body;
        if (typeof body === "string") return new TextEncoder().encode(body).buffer;
        if (body && typeof body === "object") return new TextEncoder().encode(JSON.stringify(body)).buffer;
        return new ArrayBuffer(0);
      },
      json: async () => (typeof result.body === "object" ? result.body : JSON.parse(result.body || "{}")),
    };
  };
  return { fetchMock, calls };
}

test("shouldProxyZitadel matches oidc/oauth/well-known prefixes only", () => {
  assert.equal(shouldProxyZitadel("/oauth/v2/authorize"), true);
  assert.equal(shouldProxyZitadel("/oauth/v2/token"), true);
  assert.equal(shouldProxyZitadel("/oidc/v1/userinfo"), true);
  assert.equal(shouldProxyZitadel("/.well-known/openid-configuration"), true);
  assert.equal(shouldProxyZitadel("/login"), false);
  assert.equal(shouldProxyZitadel("/api/login"), false);
  assert.equal(shouldProxyZitadel("/authorize/error"), false);
  assert.equal(shouldProxyZitadel(""), false);
  assert.equal(shouldProxyZitadel(null), false);
});

test("rewriteUrl rewrites upstream issuer everywhere", () => {
  const upstream = "https://id.zitadel.example.com";
  const connect = "https://connect.example.com";
  assert.equal(
    rewriteUrl(`${upstream}/oauth/v2/authorize?client_id=x`, upstream, connect),
    `${connect}/oauth/v2/authorize?client_id=x`
  );
  assert.equal(rewriteUrl("https://other.example.com/foo", upstream, connect), "https://other.example.com/foo");
  assert.equal(rewriteUrl(null, upstream, connect), null);
});

test("rewriteDiscovery rewrites URL-bearing fields only", () => {
  const upstream = "https://id.zitadel.example.com";
  const connect = "https://connect.example.com";
  const input = {
    issuer: `${upstream}`,
    authorization_endpoint: `${upstream}/oauth/v2/authorize`,
    token_endpoint: `${upstream}/oauth/v2/token`,
    userinfo_endpoint: `${upstream}/oidc/v1/userinfo`,
    jwks_uri: `${upstream}/oauth/v2/keys`,
    end_session_endpoint: `${upstream}/oidc/v1/end_session`,
    scopes_supported: ["openid", "profile"],
    claims_supported: ["sub", "email"],
    response_types_supported: ["code"],
  };
  const out = rewriteDiscovery(input, upstream, connect);
  assert.equal(out.issuer, connect);
  assert.equal(out.authorization_endpoint, `${connect}/oauth/v2/authorize`);
  assert.equal(out.token_endpoint, `${connect}/oauth/v2/token`);
  assert.equal(out.userinfo_endpoint, `${connect}/oidc/v1/userinfo`);
  assert.equal(out.jwks_uri, `${connect}/oauth/v2/keys`);
  assert.equal(out.end_session_endpoint, `${connect}/oidc/v1/end_session`);
  assert.deepEqual(out.scopes_supported, ["openid", "profile"]);
  assert.deepEqual(out.response_types_supported, ["code"]);
});

test("rewriteSetCookieDomain replaces Domain directive", () => {
  const inCookie = "foo=bar; Path=/; Domain=id.zitadel.example.com; Secure; HttpOnly";
  const out = rewriteSetCookieDomain(inCookie, "connect.example.com");
  assert.match(out, /Domain=connect\.example\.com/);
  assert.doesNotMatch(out, /id\.zitadel\.example\.com/);
  assert.equal(
    rewriteSetCookieDomain(inCookie, "localhost"),
    "foo=bar; Path=/; Domain=localhost; Secure; HttpOnly"
  );
  assert.equal(rewriteSetCookieDomain(null, "x"), null);
  assert.equal(rewriteSetCookieDomain("foo=bar; Path=/", "x"), "foo=bar; Path=/");
});

test("rewriteLocation absolutizes relative paths against connect issuer", () => {
  const upstream = "https://id.zitadel.example.com";
  const connect = "https://connect.example.com";
  assert.equal(rewriteLocation("/ui/login?authRequestID=V2_abc", upstream, connect), "https://connect.example.com/login?authRequest=V2_abc");
  assert.equal(rewriteLocation("/ui/login/login?authRequestID=V2_abc", upstream, connect), "https://connect.example.com/login?authRequest=V2_abc");
  assert.equal(rewriteLocation("/ui/v2/login?authRequest=V2_abc", upstream, connect), "https://connect.example.com/login?authRequest=V2_abc");
  assert.equal(rewriteLocation("/ui/v2/login/login?authRequest=V2_abc", upstream, connect), "https://connect.example.com/login?authRequest=V2_abc");
  assert.equal(rewriteLocation("ui/v2/login", upstream, connect), "https://connect.example.com/login");
  assert.equal(rewriteLocation(`${upstream}/oauth/v2/authorize`, upstream, connect), `${connect}/oauth/v2/authorize`);
  assert.equal(rewriteLocation("https://other.example.com/foo", upstream, connect), "https://other.example.com/foo");
  assert.equal(rewriteLocation("", upstream, connect), "");
  assert.equal(rewriteLocation(null, upstream, connect), null);
});

test("rewriteLocation normalizes loopback host aliases to canonical Connect issuer", () => {
  const upstream = "http://localhost:8081";
  const connect = "http://127.0.0.1:3000";
  assert.equal(
    rewriteLocation("http://localhost:3000/login?authRequest=V2_abc", upstream, connect),
    "http://127.0.0.1:3000/login?authRequest=V2_abc"
  );
  assert.equal(
    rewriteLocation("http://localhost:3000/ui/v2/login/login?authRequest=V2_abc", upstream, connect),
    "http://127.0.0.1:3000/login?authRequest=V2_abc"
  );
  assert.equal(
    normalizeConnectPublicUrl("http://localhost:3000/oauth/v2/authorize", connect),
    "http://127.0.0.1:3000/oauth/v2/authorize"
  );
});

test("rewriteHostedLoginLocation maps Zitadel login UI paths to Connect login page", () => {
  const connect = "http://localhost:3000";
  assert.equal(
    rewriteHostedLoginLocation("http://localhost:3000/ui/login/login?authRequestID=V2_abc", connect),
    "http://localhost:3000/login?authRequest=V2_abc"
  );
  assert.equal(
    rewriteHostedLoginLocation("http://localhost:3000/ui/login?authRequestID=V2_abc", connect),
    "http://localhost:3000/login?authRequest=V2_abc"
  );
  assert.equal(
    rewriteHostedLoginLocation("http://localhost:3000/ui/v2/login/login?authRequest=V2_abc", connect),
    "http://localhost:3000/login?authRequest=V2_abc"
  );
  assert.equal(
    rewriteHostedLoginLocation("http://localhost:3000/ui/v2/login?authRequest=V2_abc", connect),
    "http://localhost:3000/login?authRequest=V2_abc"
  );
  assert.equal(
    rewriteHostedLoginLocation("http://localhost:3000/oauth/v2/authorize", connect),
    "http://localhost:3000/oauth/v2/authorize"
  );
  assert.equal(
    rewriteHostedLoginLocation("https://other.example.com/ui/v2/login", connect),
    "https://other.example.com/ui/v2/login"
  );
});

test("resolveProxyPublicHost ignores container bind address 0.0.0.0", withEnv({}, async () => {
  const request = makeRequest({
    url: "http://0.0.0.0:3000/.well-known/openid-configuration",
    headers: { "x-forwarded-host": "connect.example.com", "x-forwarded-proto": "https" },
  });
  assert.equal(resolveProxyPublicHost(request, "https://connect.example.com"), "connect.example.com");
  assert.equal(resolveProxyPublicProto(request, "https://connect.example.com"), "https");
}));

test("proxyToZitadel uses public host when request url is 0.0.0.0 behind reverse proxy", withEnv({}, async () => {
  const upstream = "https://id.zitadel.example.com";
  const { fetchMock, calls } = makeMockFetch({
    [`${upstream}/.well-known/openid-configuration`]: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ issuer: upstream }),
    },
  });

  const request = makeRequest({
    url: "http://0.0.0.0:3000/.well-known/openid-configuration",
    headers: { "x-forwarded-host": "connect.example.com", "x-forwarded-proto": "https" },
  });
  const response = await proxyToZitadel(request, { fetch: fetchMock });

  assert.equal(response.status, 200);
  assert.equal(calls[0].init.headers.get("X-Forwarded-Host"), "id.zitadel.example.com");
  assert.equal(calls[0].init.headers.get("X-Forwarded-Proto"), "https");
  assert.equal(calls[0].init.headers.get("x-zitadel-public-host"), "id.zitadel.example.com");
  assert.equal(calls[0].init.headers.get("Host"), "id.zitadel.example.com");
}));

test("proxyToZitadel uses internal API base with public issuer host header", withEnv(
  { ZITADEL_API_BASE: "http://zitadel:8080" },
  async () => {
    const { fetchMock, calls } = makeMockFetch({
      "http://zitadel:8080/.well-known/openid-configuration": {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issuer: "https://id.zitadel.example.com" }),
      },
    });

    const request = makeRequest({
      url: "https://connect.example.com/.well-known/openid-configuration",
    });
    const response = await proxyToZitadel(request, { fetch: fetchMock });

    assert.equal(response.status, 200);
    assert.equal(calls[0].upstreamUrl, "http://zitadel:8080/.well-known/openid-configuration");
    assert.equal(calls[0].init.headers.get("Host"), "id.zitadel.example.com");
  }
));

test("proxyToZitadel forwards GET authorize to upstream and rewrites Location redirect", withEnv({}, async () => {
  const upstream = "https://id.zitadel.example.com";
  const { fetchMock, calls } = makeMockFetch({
    [`${upstream}/oauth/v2/authorize?client_id=subboost-dev`]: {
      status: 302,
      headers: { location: `/ui/v2/login?authRequest=V2_abc` },
      body: "",
    },
  });

  const request = makeRequest({ url: "https://connect.example.com/oauth/v2/authorize?client_id=subboost-dev" });
  const response = await proxyToZitadel(request, { fetch: fetchMock });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://connect.example.com/login?authRequest=V2_abc");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.get("X-Forwarded-Host"), "id.zitadel.example.com");
  assert.equal(calls[0].init.headers.get("X-Forwarded-Proto"), "https");
  assert.equal(calls[0].init.headers.get("x-zitadel-public-host"), "id.zitadel.example.com");
  assert.equal(calls[0].init.headers.get("x-zitadel-instance-host"), "id.zitadel.example.com");
}));

test("proxyToZitadel maps Zitadel v4 login UI redirects to Connect login", withEnv({}, async () => {
  const upstream = "https://id.zitadel.example.com";
  const { fetchMock } = makeMockFetch({
    [`${upstream}/oauth/v2/authorize?client_id=subboost-dev`]: {
      status: 302,
      headers: { location: `/ui/login/login?authRequestID=V2_abc` },
      body: "",
    },
  });

  const request = makeRequest({ url: "https://connect.example.com/oauth/v2/authorize?client_id=subboost-dev" });
  const response = await proxyToZitadel(request, { fetch: fetchMock });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://connect.example.com/login?authRequest=V2_abc");
}));

test("rewriteDiscovery annotates dev-only HS256 contract when resign secret is set", withEnv(
  { MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET: "dev-secret" },
  async () => {
    const upstream = "https://id.zitadel.example.com";
    const connect = "https://connect.example.com";
    const rewritten = rewriteDiscovery(
      {
        issuer: upstream,
        authorization_endpoint: `${upstream}/oauth/v2/authorize`,
        id_token_signing_alg_values_supported: ["RS256"],
      },
      upstream,
      connect
    );
    assert.deepEqual(rewritten.id_token_signing_alg_values_supported, ["HS256"]);
    assert.equal(rewritten.moauth_dev_id_token_resign, true);
    assert.match(rewritten.moauth_id_token_verification_note, /Dev-only/);
    assert.match(rewritten.moauth_id_token_verification_note, /JWKS/);
  }
));

test("annotateDevIdTokenResignDiscovery leaves discovery unchanged without resign secret", withEnv({}, async () => {
  const input = { id_token_signing_alg_values_supported: ["RS256"] };
  assert.deepEqual(annotateDevIdTokenResignDiscovery(input), input);
}));

test("annotateProductionIdTokenSigningDiscovery marks RS256 Connect issuer signing", withEnv(
  {
    NODE_ENV: "production",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----",
  },
  async () => {
    const annotated = annotateProductionIdTokenSigningDiscovery({
      id_token_signing_alg_values_supported: ["RS256", "ES256"],
    });
    assert.deepEqual(annotated.id_token_signing_alg_values_supported, ["RS256"]);
    assert.equal(annotated.moauth_connect_issuer_signing, true);
    assert.match(annotated.moauth_id_token_verification_note, /jwks_uri/);
  }
));

test("proxyToZitadel serves Connect JWKS locally in production-jwks mode", async () => {
  const { generateKeyPair, exportPKCS8 } = await import("jose");
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  const pem = await exportPKCS8(privateKey);

  await withEnv(
    {
      NODE_ENV: "production",
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY: pem,
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID: "connect-test-1",
    },
    async () => {
      const { resetConnectJwksCacheForTests } = await import("../src/oidc/connect-jwks.js");
      resetConnectJwksCacheForTests();

      const fetchMock = async () => {
        throw new Error("upstream JWKS must not be called in production-jwks mode");
      };
      const request = makeRequest({ url: "https://connect.example.com/oauth/v2/keys" });
      const response = await proxyToZitadel(request, { fetch: fetchMock });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.keys.length, 1);
      assert.equal(payload.keys[0].kid, "connect-test-1");
      assert.equal(payload.keys[0].alg, "RS256");
      for (const privateField of ["d", "p", "q", "dp", "dq", "qi", "oth"]) {
        assert.equal(privateField in payload.keys[0], false);
      }
      resetConnectJwksCacheForTests();
    }
  )();
});

test("proxyToZitadel serves Connect JWKS well-known alias locally in production-jwks mode", async () => {
  const { generateKeyPair, exportPKCS8 } = await import("jose");
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  const pem = await exportPKCS8(privateKey);

  await withEnv(
    {
      NODE_ENV: "production",
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY: pem,
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID: "connect-test-alias",
    },
    async () => {
      const { resetConnectJwksCacheForTests } = await import("../src/oidc/connect-jwks.js");
      resetConnectJwksCacheForTests();

      const fetchMock = async () => {
        throw new Error("upstream JWKS alias must not be called in production-jwks mode");
      };
      const request = makeRequest({ url: "https://connect.example.com/.well-known/jwks.json" });
      const response = await proxyToZitadel(request, { fetch: fetchMock });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.keys.length, 1);
      assert.equal(payload.keys[0].kid, "connect-test-alias");
      assert.equal(payload.keys[0].alg, "RS256");
      resetConnectJwksCacheForTests();
    }
  )();
});

test("rewriteDiscovery pins issuer to Connect and normalizes loopback URL aliases", () => {
  const upstream = "http://localhost:8081";
  const connect = "http://127.0.0.1:3000";
  const rewritten = rewriteDiscovery(
    {
      issuer: "http://localhost:3000",
      authorization_endpoint: "http://localhost:3000/oauth/v2/authorize",
      token_endpoint: "http://localhost:8081/oauth/v2/token",
    },
    upstream,
    connect
  );
  assert.equal(rewritten.issuer, connect);
  assert.equal(rewritten.authorization_endpoint, `${connect}/oauth/v2/authorize`);
  assert.equal(rewritten.token_endpoint, `${connect}/oauth/v2/token`);
});

test("proxyToZitadel rewrites discovery JSON and overrides issuer", withEnv({}, async () => {
  const upstream = "https://id.zitadel.example.com";
  const { fetchMock } = makeMockFetch({
    [`${upstream}/.well-known/openid-configuration`]: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: {
        issuer: upstream,
        authorization_endpoint: `${upstream}/oauth/v2/authorize`,
        token_endpoint: `${upstream}/oauth/v2/token`,
        userinfo_endpoint: `${upstream}/oidc/v1/userinfo`,
        jwks_uri: `${upstream}/oauth/v2/keys`,
        scopes_supported: ["openid"],
      },
    },
  });

  const request = makeRequest({ url: "https://connect.example.com/.well-known/openid-configuration" });
  const response = await proxyToZitadel(request, { fetch: fetchMock });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.issuer, "https://connect.example.com");
  assert.equal(payload.authorization_endpoint, "https://connect.example.com/oauth/v2/authorize");
  assert.equal(payload.token_endpoint, "https://connect.example.com/oauth/v2/token");
  assert.equal(payload.userinfo_endpoint, "https://connect.example.com/oidc/v1/userinfo");
  assert.equal(payload.jwks_uri, "https://connect.example.com/oauth/v2/keys");
  assert.deepEqual(payload.scopes_supported, ["openid"]);
}));

test("proxyToZitadel forwards non-discovery JSON bodies verbatim", withEnv({}, async () => {
  const upstream = "https://id.zitadel.example.com";
  const { fetchMock, calls } = makeMockFetch({
    [`${upstream}/oidc/v1/userinfo`]: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: { sub: "user-1", email: "alice@example.com" },
    },
  });

  const request = makeRequest({ url: "https://connect.example.com/oidc/v1/userinfo", headers: { authorization: "Bearer tok" } });
  const response = await proxyToZitadel(request, { fetch: fetchMock });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload, { sub: "user-1", email: "alice@example.com" });
  assert.equal(calls[0].init.headers.get("Authorization"), "Bearer tok");
}));

test("proxyToZitadel forwards POST body and set-cookie rewriting", withEnv({}, async () => {
  const upstream = "https://id.zitadel.example.com";
  const { fetchMock, calls } = makeMockFetch({
    [`${upstream}/oauth/v2/token`]: (init) => {
      assert.ok(init.body && init.body.length > 0, "POST body must be forwarded");
      return {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "__Host-zitadel=abc; Path=/; Domain=id.zitadel.example.com; Secure",
        },
        body: { access_token: "tok", token_type: "Bearer" },
      };
    },
  });

  const request = makeRequest({
    method: "POST",
    url: "https://connect.example.com/oauth/v2/token",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=authorization_code&code=xyz",
  });
  const response = await proxyToZitadel(request, { fetch: fetchMock });

  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.match(setCookie, /Domain=connect\.example\.com/);
  assert.doesNotMatch(setCookie, /id\.zitadel\.example\.com/);
}));

test("proxy-node re-signs token response id_token with Connect JWKS key in production-jwks mode", async () => {
  const { createLocalJWKSet, exportJWK, exportPKCS8, generateKeyPair, jwtVerify, SignJWT } = await import("jose");
  const upstreamKeyPair = await generateKeyPair("RS256", { extractable: true });
  const connectKeyPair = await generateKeyPair("RS256", { extractable: true });
  const connectPem = await exportPKCS8(connectKeyPair.privateKey);
  const upstreamIssuer = "https://id.zitadel.example.com";
  const connectIssuer = "https://connect.example.com";
  const upstreamJwk = await exportJWK(upstreamKeyPair.publicKey);
  const connectJwk = await exportJWK(connectKeyPair.publicKey);
  const upstreamJwks = {
    keys: [{ ...upstreamJwk, kid: "upstream-1", use: "sig", alg: "RS256" }],
  };
  const connectJwks = {
    keys: [{ ...connectJwk, kid: "connect-test-1", use: "sig", alg: "RS256" }],
  };
  const upstreamToken = await new SignJWT({
    sub: "user-1",
    iss: upstreamIssuer,
    aud: "subboost-client",
    nonce: "nonce-1",
  })
    .setProtectedHeader({ alg: "RS256", kid: "upstream-1" })
    .sign(upstreamKeyPair.privateKey);

  await withEnv(
    {
      NODE_ENV: "production",
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY: connectPem,
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID: "connect-test-1",
    },
    async () => {
      const { resetConnectJwksCacheForTests } = await import("../src/oidc/connect-jwks.js");
      resetConnectJwksCacheForTests();

      const { fetchMock } = makeMockFetch({
        [`${upstreamIssuer}/oauth/v2/token`]: {
          status: 200,
          headers: { "content-type": "application/json" },
          body: {
            access_token: "access-token",
            id_token: upstreamToken,
            token_type: "Bearer",
            expires_in: 3600,
          },
        },
        [`${upstreamIssuer}/oauth/v2/keys`]: {
          status: 200,
          headers: { "content-type": "application/json" },
          body: upstreamJwks,
        },
      });

      const request = makeRequest({
        method: "POST",
        url: `${connectIssuer}/oauth/v2/token`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=authorization_code&code=xyz",
      });
      const response = await proxyNodeToZitadel(request, { fetch: fetchMock });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.notEqual(payload.id_token, upstreamToken);
      const verified = await jwtVerify(payload.id_token, createLocalJWKSet(connectJwks), {
        issuer: connectIssuer,
        audience: "subboost-client",
      });
      assert.equal(verified.payload.sub, "user-1");
      assert.equal(verified.payload.nonce, "nonce-1");
      assert.equal(verified.protectedHeader.kid, "connect-test-1");
      resetConnectJwksCacheForTests();
    }
  )();
});

test("proxy core falls back to Connect JWKS re-signing when token rewrite option is omitted", async () => {
  const { createLocalJWKSet, exportJWK, exportPKCS8, generateKeyPair, jwtVerify, SignJWT } = await import("jose");
  const upstreamKeyPair = await generateKeyPair("RS256", { extractable: true });
  const connectKeyPair = await generateKeyPair("RS256", { extractable: true });
  const connectPem = await exportPKCS8(connectKeyPair.privateKey);
  const upstreamIssuer = "https://id.zitadel.example.com";
  const connectIssuer = "https://connect.example.com";
  const upstreamJwk = await exportJWK(upstreamKeyPair.publicKey);
  const connectJwk = await exportJWK(connectKeyPair.publicKey);
  const upstreamJwks = {
    keys: [{ ...upstreamJwk, kid: "upstream-core-1", use: "sig", alg: "RS256" }],
  };
  const connectJwks = {
    keys: [{ ...connectJwk, kid: "connect-core-1", use: "sig", alg: "RS256" }],
  };
  const upstreamToken = await new SignJWT({
    sub: "user-core",
    iss: upstreamIssuer,
    aud: "subboost-client",
    nonce: "nonce-core",
  })
    .setProtectedHeader({ alg: "RS256", kid: "upstream-core-1" })
    .sign(upstreamKeyPair.privateKey);

  await withEnv(
    {
      NODE_ENV: "production",
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY: connectPem,
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID: "connect-core-1",
    },
    async () => {
      const { resetConnectJwksCacheForTests } = await import("../src/oidc/connect-jwks.js");
      resetConnectJwksCacheForTests();

      const { fetchMock } = makeMockFetch({
        [`${upstreamIssuer}/oauth/v2/token`]: {
          status: 200,
          headers: { "content-type": "application/json" },
          body: {
            access_token: "access-token",
            id_token: upstreamToken,
            token_type: "Bearer",
          },
        },
        [`${upstreamIssuer}/oauth/v2/keys`]: {
          status: 200,
          headers: { "content-type": "application/json" },
          body: upstreamJwks,
        },
      });

      const request = makeRequest({
        method: "POST",
        url: `${connectIssuer}/oauth/v2/token`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=authorization_code&code=xyz",
      });
      const response = await proxyToZitadel(request, { fetch: fetchMock });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.notEqual(payload.id_token, upstreamToken);
      const verified = await jwtVerify(payload.id_token, createLocalJWKSet(connectJwks), {
        issuer: connectIssuer,
        audience: "subboost-client",
      });
      assert.equal(verified.payload.sub, "user-core");
      assert.equal(verified.payload.nonce, "nonce-core");
      assert.equal(verified.protectedHeader.kid, "connect-core-1");
      resetConnectJwksCacheForTests();
    }
  )();
});

test("middleware routes OIDC proxy requests through node wrapper so token responses can be re-signed", () => {
  const source = readFileSync(new URL("../middleware.js", import.meta.url), "utf8");
  assert.ok(source.includes('from "./src/oidc/proxy-node.js"'));
  assert.equal(source.includes('import { proxyToZitadel, shouldProxyZitadel } from "./src/oidc/proxy-core.js"'), false);
});

test("proxy-node returns 502 when production-jwks id_token re-signing fails", async () => {
  const { generateKeyPair, exportPKCS8 } = await import("jose");
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  const pem = await exportPKCS8(privateKey);

  await withEnv(
    {
      NODE_ENV: "production",
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "production-jwks",
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY: pem,
      MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID: "connect-test-1",
    },
    async () => {
      const upstream = "https://id.zitadel.example.com";
      const { resetConnectJwksCacheForTests } = await import("../src/oidc/connect-jwks.js");
      resetConnectJwksCacheForTests();

      const { fetchMock } = makeMockFetch({
        [`${upstream}/oauth/v2/token`]: {
          status: 200,
          headers: { "content-type": "application/json" },
          body: { access_token: "tok", id_token: "not-a-jwt" },
        },
      });

      const request = makeRequest({
        method: "POST",
        url: "https://connect.example.com/oauth/v2/token",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=authorization_code&code=xyz",
      });
      const response = await proxyNodeToZitadel(request, { fetch: fetchMock });

      assert.equal(response.status, 502);
      const payload = await response.json();
      assert.equal(payload.error.code, CONNECT_ID_TOKEN_RESIGN_ERROR_CODE);
      resetConnectJwksCacheForTests();
    }
  )();
});

test("proxyToZitadel returns 502 when upstream fetch throws", withEnv({}, async () => {
  const fetchMock = async () => { throw new Error("network down"); };
  const request = makeRequest({ url: "https://connect.example.com/oauth/v2/authorize" });
  const response = await proxyToZitadel(request, { fetch: fetchMock });

  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.equal(payload.error.code, "ZITADEL_PROXY_FAILED");
}));
