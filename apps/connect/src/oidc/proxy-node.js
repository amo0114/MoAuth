import { isConnectIdTokenResignEnabled } from "../config/env.js";
import { proxyToZitadel as proxyToZitadelCore } from "./proxy-core.js";

export async function proxyToZitadel(request, options = {}) {
  if (!isConnectIdTokenResignEnabled()) {
    return proxyToZitadelCore(request, options);
  }

  const { rewriteOidcTokenResponseBody } = await import("./id-token-issuer.js");
  const upstreamFetch = options.fetch || fetch;

  return proxyToZitadelCore(request, {
    ...options,
    rewriteTokenResponseBody: (body, ctx) =>
      rewriteOidcTokenResponseBody(body, {
        upstreamIssuer: ctx.upstreamIssuer,
        connectIssuer: ctx.connectIssuer,
        fetchImpl: ctx.fetchImpl || upstreamFetch,
      }),
  });
}