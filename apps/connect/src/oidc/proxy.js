import { getZitadelConfig, isZitadelConfigured } from "../config/zitadel.js";
import { getConnectIssuer } from "../config/env.js";

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
  "device_authorization_endpoint",
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

export function rewriteDiscovery(body, upstreamIssuer, connectIssuer) {
  if (!body || typeof body !== "object") return body;
  const rewritten = { ...body };
  for (const [key, value] of Object.entries(rewritten)) {
    if (DISCOVERY_URL_FIELDS.has(key) && typeof value === "string") {
      rewritten[key] = rewriteUrl(value, upstreamIssuer, connectIssuer);
    }
  }
  return rewritten;
}

export function rewriteSetCookieDomain(setCookie, requestHost) {
  if (typeof setCookie !== "string") return setCookie;
  return setCookie.replace(/Domain=[^;]+/gi, `Domain=${requestHost}`);
}

export function rewriteLocation(value, upstreamIssuer, connectIssuer) {
  if (typeof value !== "string" || value.length === 0) return value;
  const rewritten = rewriteUrl(value, upstreamIssuer, connectIssuer);
  if (/^https?:\/\//i.test(rewritten)) return rewritten;
  if (rewritten.startsWith("/")) return `${connectIssuer}${rewritten}`;
  return `${connectIssuer}/${rewritten}`;
}

export async function proxyToZitadel(request, options = {}) {
  if (!isZitadelConfigured()) {
    throw new Error("ZITADEL_NOT_CONFIGURED");
  }
  const config = options.config || getZitadelConfig();
  const connectIssuer = options.connectIssuer || getConnectIssuer();
  const upstreamFetch = options.fetch || fetch;
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, config.issuer).toString();

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  headers.set("X-Forwarded-Host", requestUrl.host);
  headers.set("X-Forwarded-Proto", requestUrl.protocol.replace(":", ""));
  headers.set("X-Forwarded-Path", requestUrl.pathname);

  const upstreamHost = new URL(config.issuer).host;
  headers.set("x-zitadel-public-host", requestUrl.host);
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

  return buildProxiedResponse(upstreamResponse, config.issuer, connectIssuer, requestUrl);
}

async function buildProxiedResponse(upstreamResponse, upstreamIssuer, connectIssuer, requestUrl) {
  const headers = new Headers();
  for (const [key, value] of upstreamResponse.headers.entries()) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (lower === "location") {
      headers.set(key, rewriteLocation(value, upstreamIssuer, connectIssuer));
      continue;
    }
    if (lower === "set-cookie") {
      headers.append(key, rewriteSetCookieDomain(value, requestUrl.host));
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

  const bodyBuffer = await upstreamResponse.arrayBuffer();
  return new Response(bodyBuffer, { status, headers });
}