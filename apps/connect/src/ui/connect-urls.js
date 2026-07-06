import { identityBrand } from "../config/brand.js";

export function buildAccountUrl(path, authRequestId, options = {}) {
  const base = options.accountBaseUrl || identityBrand.accountBaseUrl || "http://127.0.0.1:3002";
  const target = new URL(path, base);
  const returnTo = options.returnTo || (typeof window !== "undefined" ? window.location.href : "");
  if (returnTo) {
    target.searchParams.set("return_to", returnTo);
  }
  if (authRequestId) {
    target.searchParams.set("auth_request", authRequestId);
  }
  if (options.requireLogin) {
    target.searchParams.set("require_login", "1");
  }
  return target.toString();
}
