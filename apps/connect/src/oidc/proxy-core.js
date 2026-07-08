import { getZitadelConfig, isZitadelConfigured } from "../config/zitadel.js";
import {
  getConnectIdTokenSigningAlgorithm,
  getPublicAppUrl,
  isDevIdTokenResignEnabled,
  isProductionIdTokenSigningEnabled,
} from "../config/env.js";
import { getConnectJwksDocument } from "./connect-jwks.js";

const PROXY_PREFIXES = ["/oauth/", "/oidc/", "/.well-known/"];

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const DISCOVERY_URL_FIELDS = new Set([
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "userinfo_endpoint",
  "jwks_uri",
  "end_session_endpoint",
  "introspection_endpoint",
  "revocation_endpoint",
  "device_authorization_request_endpoint",
  "pushed_authorization_request_endpoint",
]);

export function shouldProxyZitadel(pathname) {
  if (typeof pathname !== "string" || pathname.length === 0) return false;
  return PROXY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function rewriteUrl(value, upstreamIssuer, connectIssuer) {
  if (typeof value !== "string") return value;
  if (!upstreamIssuer || !connectIssuer) return value;
  return value.split(upstreamIssuer).join(connectIssuer);
}

export function annotateProductionIdTokenSigningDiscovery(body) {
  if (!body || typeof body !== "object" || !isProductionIdTokenSigningEnabled()) {
    return body;
  }
  const alg = getConnectIdTokenSigningAlgorithm();
  return {
    ...body,
    id_token_signing_alg_values_supported: [alg],
    moauth_connect_issuer_signing: true,
    moauth_id_token_verification_note:
      `Connect re-signs id_token with ${alg}; jwks_uri serves Connect-controlled signing keys.`,
  };
}

export function annotateDevIdTokenResignDiscovery(body) {
  if (!body || typeof body !== "object" || !isDevIdTokenResignEnabled()) {
    return body;
  }
  return {
    ...body,
    id_token_signing_alg_values_supported: ["HS256"],
    moauth_dev_id_token_resign: true,
    moauth_id_token_verification_note:
      "Dev-only: Connect re-signs id_token with HS256 using MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET. " +
      "JWKS at jwks_uri still returns upstream RSA keys; standard JWKS verification will fail. " +
      "Not a multi-app OIDC contract.",
  };
}

export function rewriteDiscovery(body, upstreamIssuer, connectIssuer) {
  if (!body || typeof body !== "object") return body;
  const rewritten = { ...body };
  for (const [key, value] of Object.entries(rewritten)) {
    if (DISCOVERY_URL_FIELDS.has(key) && typeof value === "string") {
      rewritten[key] = normalizeConnectPublicUrl(
        rewriteUrl(value, upstreamIssuer, connectIssuer),
        connectIssuer
      );
    }
  }
  if (typeof connectIssuer === "string" && connectIssuer) {
    rewritten.issuer = connectIssuer;
  }
  return annotateDevIdTokenResignDiscovery(annotateProductionIdTokenSigningDiscovery(rewritten));
}

export function rewriteSetCookieDomain(setCookie, requestHost) {
  if (typeof setCookie !== "string") return setCookie;
  return setCookie.replace(/Domain=[^;]+/gi, `Domain=${requestHost}`);
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopbackHost(hostname) {
  return LOOPBACK_HOSTS.has(String(hostname || "").toLowerCase());
}

function isUntrustedProxyHost(hostname) {
  const normalized = String(hostname || "").toLowerCase();
  return LOOPBACK_HOSTS.has(normalized) || normalized === "0.0.0.0";
}

/** Public host/proto for upstream Zitadel — never forward container bind addresses like 0.0.0.0:3000. */
export function resolveProxyPublicHost(request, connectIssuer) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0].trim();
    const hostname = host.split(":")[0];
    if (host && !isUntrustedProxyHost(hostname)) {
      return host;
    }
  }

  let requestHost = "";
  try {
    requestHost = new URL(request.url).host;
  } catch {
    requestHost = "";
  }
  if (requestHost) {
    const hostname = requestHost.split(":")[0];
    if (!isUntrustedProxyHost(hostname)) {
      return requestHost;
    }
  }

  return new URL(connectIssuer).host;
}

export function resolveProxyPublicProto(request, connectIssuer) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim();
  }
  try {
    const proto = new URL(request.url).protocol.replace(":", "");
    if (proto) return proto;
  } catch {
    // fall through
  }
  return new URL(connectIssuer).protocol.replace(":", "");
}

function resolveCanonicalHostname(connectIssuer) {
  return new URL(connectIssuer).hostname;
}

export function normalizeConnectPublicUrl(value, connectIssuer) {
  if (typeof value !== "string" || !value) return value;
  try {
    const parsed = new URL(value);
    const canonical = new URL(connectIssuer);
    const canonicalHost = resolveCanonicalHostname(connectIssuer);
    if (
      parsed.protocol === canonical.protocol &&
      parsed.port === canonical.port &&
      isLoopbackHost(parsed.hostname) &&
      isLoopbackHost(canonicalHost) &&
      parsed.hostname !== canonicalHost
    ) {
      parsed.hostname = canonicalHost;
      return parsed.toString();
    }
  } catch {
    return value;
  }
  return value;
}

export function rewriteLocation(value, upstreamIssuer, connectIssuer) {
  if (typeof value !== "string" || value.length === 0) return value;
  const rewritten = rewriteUrl(value, upstreamIssuer, connectIssuer);
  const absolute = /^https?:\/\//i.test(rewritten)
    ? rewritten
    : rewritten.startsWith("/")
      ? `${connectIssuer}${rewritten}`
      : `${connectIssuer}/${rewritten}`;
  const hosted = rewriteHostedLoginLocation(absolute, connectIssuer);
  return normalizeConnectPublicUrl(hosted, connectIssuer);
}

export function rewriteHostedLoginLocation(value, connectIssuer) {
  if (typeof value !== "string" || value.length === 0) return value;
  try {
    const parsed = new URL(value, connectIssuer);
    const canonical = new URL(connectIssuer);
    const canonicalHost = resolveCanonicalHostname(connectIssuer);
    const sameLoopbackOrigin =
      parsed.protocol === canonical.protocol &&
      parsed.port === canonical.port &&
      isLoopbackHost(parsed.hostname) &&
      isLoopbackHost(canonicalHost);
    if (!sameLoopbackOrigin && parsed.origin !== canonical.origin) return value;
    if (parsed.pathname === "/ui/v2/login" || parsed.pathname === "/ui/v2/login/login") {
      return `${connectIssuer}/login${parsed.search}`;
    }
  } catch {
    return value;
  }
  return normalizeConnectPublicUrl(value, connectIssuer);
}

export async function proxyToZitadel(request, options = {}) {
  if (!isZitadelConfigured()) {
    throw new Error("ZITADEL_NOT_CONFIGURED");
  }
  const config = options.config || getZitadelConfig();
  const connectIssuer = options.connectIssuer || getPublicAppUrl();
  const upstreamFetch = options.fetch || fetch;
  const requestUrl = new URL(request.url);

  if (requestUrl.pathname === "/oauth/v2/keys" && isProductionIdTokenSigningEnabled()) {
    const jwks = await getConnectJwksDocument();
    if (jwks) {
      return new Response(JSON.stringify(jwks), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
      });
    }
  }

  const upstreamFetchBase = config.apiBase || config.issuer;
  const upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, upstreamFetchBase).toString();

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  const publicHost = resolveProxyPublicHost(request, connectIssuer);
  const publicProto = resolveProxyPublicProto(request, connectIssuer);

  headers.set("X-Forwarded-Host", publicHost);
  headers.set("X-Forwarded-Proto", publicProto);
  headers.set("X-Forwarded-Path", requestUrl.pathname);

  const upstreamHost = new URL(config.issuer).host;
  headers.set("Host", upstreamHost);
  headers.set("x-zitadel-public-host", publicHost);
  headers.set("x-zitadel-instance-host", upstreamHost);

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.text();
  }

  let upstreamResponse;
  try {
    upstreamResponse = await upstreamFetch(upstreamUrl, init);
  } catch (cause) {
    return new Response(
      JSON.stringify({
        error: {
          code: "ZITADEL_PROXY_FAILED",
          message: `Connect could not reach the identity core at ${config.issuer}.`,
          cause: String(cause?.message || cause),
        },
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return buildProxiedResponse(upstreamResponse, config.issuer, connectIssuer, requestUrl, options);
}

function rewriteProxiedLocation(value, upstreamIssuer, connectIssuer) {
  if (typeof value !== "string" || value.length === 0) return value;
  let loc = rewriteUrl(value, upstreamIssuer, connectIssuer);
  if (!/^https?:\/\//i.test(loc)) {
    loc = loc.startsWith("/") ? `${connectIssuer}${loc}` : `${connectIssuer}/${loc}`;
  }
  try {
    const parsed = new URL(loc, connectIssuer);
    if (parsed.pathname === "/ui/v2/login" || parsed.pathname === "/ui/v2/login/login") {
      loc = `${connectIssuer}/login${parsed.search}`;
    } else {
      loc = parsed.toString();
    }
  } catch {
    return normalizeConnectPublicUrl(loc, connectIssuer);
  }
  return normalizeConnectPublicUrl(loc, connectIssuer);
}

async function buildProxiedResponse(upstreamResponse, upstreamIssuer, connectIssuer, requestUrl, options = {}) {
  const headers = new Headers();
  for (const [key, value] of upstreamResponse.headers.entries()) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (lower === "location") {
      headers.set("location", rewriteProxiedLocation(value, upstreamIssuer, connectIssuer));
      continue;
    }
    if (lower === "set-cookie") {
      headers.append(key, rewriteSetCookieDomain(value, resolveCanonicalHostname(connectIssuer)));
      continue;
    }
    headers.set(key, value);
  }

  const contentType = upstreamResponse.headers.get("content-type") || "";
  const isDiscovery =
    requestUrl.pathname === "/.well-known/openid-configuration" && contentType.includes("application/json");
  const status = upstreamResponse.status;

  if (isDiscovery) {
    const payload = await upstreamResponse.json().catch(() => null);
    if (payload && typeof payload === "object") {
      const rewritten = rewriteDiscovery(payload, upstreamIssuer, connectIssuer);
      return new Response(JSON.stringify(rewritten), { status, headers });
    }
  }

  const isTokenResponse =
    requestUrl.pathname === "/oauth/v2/token" && contentType.includes("application/json");
  if (isTokenResponse && typeof options.rewriteTokenResponseBody === "function") {
    const payload = await upstreamResponse.json().catch(() => null);
    if (payload && typeof payload === "object") {
      try {
        const rewritten = await options.rewriteTokenResponseBody(payload, {
          upstreamIssuer,
          connectIssuer,
          fetchImpl: options.fetch || fetch,
        });
        return new Response(JSON.stringify(rewritten), { status, headers });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: {
              code: error?.code || "CONNECT_TOKEN_REWRITE_FAILED",
              message:
                error?.message ||
                "Connect could not rewrite the upstream token response for the public issuer.",
            },
          }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  }

  const bodyBuffer = await upstreamResponse.arrayBuffer();
  return new Response(bodyBuffer, { status, headers });
}
