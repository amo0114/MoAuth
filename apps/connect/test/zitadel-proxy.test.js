import assert from "node:assert/strict";
import test from "node:test";

import {
  proxyToZitadel,
  rewriteDiscovery,
  rewriteLocation,
  rewriteSetCookieDomain,
  rewriteUrl,
  shouldProxyZitadel,
} from "../src/oidc/proxy.js";

const origEnv = { ...process.env };

function withEnv(partial, fn) {
  return async () => {
    process.env = {
      ...origEnv,
      ZITADEL_API_BASE: "https://id.zitadel.example.com",
      ZITADEL_ISSUER: "https://id.zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test-token",
      MOAUTH_CONNECT_ISSUER: "https://connect.example.com",
      ...partial,
    };
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
  assert.equal(rewriteSetCookieDomain(null, "x"), null);
  assert.equal(rewriteSetCookieDomain("foo=bar; Path=/", "x"), "foo=bar; Path=/");
});

test("rewriteLocation absolutizes relative paths against connect issuer", () => {
  const upstream = "https://id.zitadel.example.com";
  const connect = "https://connect.example.com";
  assert.equal(rewriteLocation("/ui/v2/login?authRequest=V2_abc", upstream, connect), "https://connect.example.com/ui/v2/login?authRequest=V2_abc");
  assert.equal(rewriteLocation("ui/v2/login", upstream, connect), "https://connect.example.com/ui/v2/login");
  assert.equal(rewriteLocation(`${upstream}/oauth/v2/authorize`, upstream, connect), `${connect}/oauth/v2/authorize`);
  assert.equal(rewriteLocation("https://other.example.com/foo", upstream, connect), "https://other.example.com/foo");
  assert.equal(rewriteLocation("", upstream, connect), "");
  assert.equal(rewriteLocation(null, upstream, connect), null);
});

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
  assert.equal(response.headers.get("location"), "https://connect.example.com/ui/v2/login?authRequest=V2_abc");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.get("X-Forwarded-Host"), "connect.example.com");
  assert.equal(calls[0].init.headers.get("X-Forwarded-Proto"), "https");
  assert.equal(calls[0].init.headers.get("x-zitadel-public-host"), "connect.example.com");
  assert.equal(calls[0].init.headers.get("x-zitadel-instance-host"), "id.zitadel.example.com");
}));

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

test("proxyToZitadel returns 502 when upstream fetch throws", withEnv({}, async () => {
  const fetchMock = async () => { throw new Error("network down"); };
  const request = makeRequest({ url: "https://connect.example.com/oauth/v2/authorize" });
  const response = await proxyToZitadel(request, { fetch: fetchMock });

  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.equal(payload.error.code, "ZITADEL_PROXY_FAILED");
}));