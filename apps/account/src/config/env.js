import { identityBrand } from "./brand.js";

export function getAccountPublicUrl() {
  return normalizeUrl(process.env.MOAUTH_ACCOUNT_PUBLIC_URL || "http://127.0.0.1:3002");
}

export function getConnectPublicUrl() {
  return normalizeUrl(process.env.MOAUTH_CONNECT_PUBLIC_URL || identityBrand.connectBaseUrl);
}

export function getHandoffInternalToken() {
  return String(process.env.MOAUTH_HANDOFF_INTERNAL_TOKEN || "").trim();
}

export function getAccountAdminSubjects() {
  const raw = String(process.env.MOAUTH_ACCOUNT_ADMIN_SUBJECTS || "").trim();
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAccountAdminSubject(sub) {
  if (!sub) return false;
  const subjects = getAccountAdminSubjects();
  if (subjects.length === 0) return false;
  const normalized = String(sub);
  return subjects.some((entry) => entry === normalized);
}

function normalizeUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}