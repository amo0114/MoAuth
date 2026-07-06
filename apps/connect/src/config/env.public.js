import { identityBrand } from "./brand.js";

function normalizeUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

export function getConnectIssuer() {
  return normalizeUrl(process.env.MOAUTH_CONNECT_ISSUER || "http://127.0.0.1:3000");
}

export function getPublicAppUrl() {
  return normalizeUrl(process.env.MOAUTH_CONNECT_PUBLIC_URL || getConnectIssuer());
}

export function getAccountPublicUrl() {
  return normalizeUrl(
    process.env.MOAUTH_ACCOUNT_PUBLIC_URL || identityBrand.accountBaseUrl || "http://127.0.0.1:3002"
  );
}

export function isPasswordLoginFallbackEnabled() {
  return process.env.CONNECT_PASSWORD_LOGIN_FALLBACK === "true";
}