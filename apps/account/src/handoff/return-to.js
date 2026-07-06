import { getConnectPublicUrl } from "../config/env.js";

const ALLOWED_CONNECT_PATHS = new Set(["/login", "/login/handoff"]);

export function validateConnectReturnTo(returnTo, connectBaseUrl = getConnectPublicUrl()) {
  if (!returnTo || typeof returnTo !== "string") {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(returnTo, connectBaseUrl);
  } catch {
    return null;
  }

  const base = new URL(connectBaseUrl);
  if (parsed.origin !== base.origin) {
    return null;
  }

  if (!ALLOWED_CONNECT_PATHS.has(parsed.pathname)) {
    return null;
  }

  return parsed.toString();
}

export function buildHandoffRedirectUrl({ code, authRequestId, connectBaseUrl = getConnectPublicUrl() }) {
  const url = new URL("/login/handoff", connectBaseUrl);
  url.searchParams.set("code", code);
  url.searchParams.set("auth_request", authRequestId);
  return url.toString();
}