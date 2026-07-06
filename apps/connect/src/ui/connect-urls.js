import { getAccountPublicUrl } from "../config/env.public.js";
import { identityBrand } from "../config/brand.js";

export function buildAccountUrl(path, authRequestId, options = {}) {
  const base = identityBrand.accountBaseUrl || getAccountPublicUrl();
  const target = new URL(path, base);
  if (typeof window !== "undefined") {
    target.searchParams.set("return_to", window.location.href);
  }
  if (authRequestId) {
    target.searchParams.set("auth_request", authRequestId);
  }
  if (options.requireLogin) {
    target.searchParams.set("require_login", "1");
  }
  return target.toString();
}