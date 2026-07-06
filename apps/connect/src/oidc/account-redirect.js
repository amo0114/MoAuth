import { getAccountPublicUrl, getPublicAppUrl } from "../config/env.public.js";

export function buildAccountLoginUrl(authRequestId, options = {}) {
  const url = new URL("/login", getAccountPublicUrl());
  if (authRequestId) {
    url.searchParams.set("auth_request", authRequestId);
  }
  url.searchParams.set("return_to", `${getPublicAppUrl()}/login`);
  if (options.requireLogin) {
    url.searchParams.set("require_login", "1");
  }
  return url.toString();
}

export function buildConnectLoginUrl(authRequestId) {
  const url = new URL("/login", getPublicAppUrl());
  if (authRequestId) {
    url.searchParams.set("authRequest", authRequestId);
  }
  return url.toString();
}