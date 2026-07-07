import { readFileSync } from "node:fs";

import {
  getAccountPublicUrl,
  getConnectIssuer,
  getPublicAppUrl,
  isPasswordLoginFallbackEnabled,
} from "./env.public.js";

export { getAccountPublicUrl, getConnectIssuer, getPublicAppUrl, isPasswordLoginFallbackEnabled };

/** Service-to-service probe base URL; defaults to public URL for local dev. */
export function getAccountInternalUrl() {
  const internal = String(process.env.MOAUTH_ACCOUNT_INTERNAL_URL || "").trim();
  return internal ? normalizeUrl(internal) : getAccountPublicUrl();
}

export function getAccountHealthProbePath() {
  const path = String(process.env.MOAUTH_ACCOUNT_HEALTH_PROBE_PATH || "/api/health/ready").trim();
  return path.startsWith("/") ? path : `/${path}`;
}

export function getAccountHealthProbeTimeoutMs() {
  const raw = Number(process.env.MOAUTH_ACCOUNT_HEALTH_PROBE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 2500;
}

export function getAccountHealthPositiveCacheMs() {
  const raw = Number(process.env.MOAUTH_ACCOUNT_HEALTH_POSITIVE_CACHE_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 10_000;
}

export function getAccountHealthNegativeCacheMs() {
  const raw = Number(process.env.MOAUTH_ACCOUNT_HEALTH_NEGATIVE_CACHE_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 30_000;
}

export function getHandoffInternalToken() {
  return String(process.env.MOAUTH_HANDOFF_INTERNAL_TOKEN || "").trim();
}

export function getConnectAdminApiToken() {
  return String(process.env.MOAUTH_CONNECT_ADMIN_API_TOKEN || "").trim();
}

export function getAccountHandoffConsumeUrl() {
  return `${getAccountPublicUrl()}/api/handoff/consume`;
}

export function getAccountAuthorizedAppsUrl() {
  return `${getAccountPublicUrl()}/api/internal/authorized-apps`;
}

export function getIdTokenSigningSecret() {
  return String(process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET || "").trim();
}

export function getConnectIdTokenSigningPrivateKeyFile() {
  return String(process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE || "").trim();
}

export function getConnectIdTokenSigningPrivateKeyPem() {
  const inline = String(process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY || "").trim();
  if (inline) return inline;

  const keyFile = getConnectIdTokenSigningPrivateKeyFile();
  if (!keyFile) return "";

  return readFileSync(keyFile, "utf8").trim();
}

export function getConnectIdTokenSigningKeyId() {
  const kid = String(process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_KID || "").trim();
  return kid || "moauth-connect-1";
}

export function getConnectIdTokenSigningAlgorithm() {
  const alg = String(process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_ALG || "RS256").trim().toUpperCase();
  return alg === "ES256" ? "ES256" : "RS256";
}

function isDevRuntime() {
  return process.env.NODE_ENV !== "production";
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function getRuntimeSecret(envName, devFallback) {
  const value = String(process.env[envName] || "").trim();
  if (value) return value;
  if (isProductionRuntime()) {
    throw new Error(`${envName} is required in production.`);
  }
  return devFallback;
}

function normalizeIdTokenSigningMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (["production-jwks", "production"].includes(mode)) return "production-jwks";
  if (["dev-hs256", "dev"].includes(mode)) return "dev-hs256";
  if (["off", "disabled", "none"].includes(mode)) return "off";
  return null;
}

export function getIdTokenSigningMode() {
  const explicit = normalizeIdTokenSigningMode(process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE);
  if (explicit === "production-jwks") return "production-jwks";
  if (explicit === "off") return "off";
  if (explicit === "dev-hs256") {
    return isDevRuntime() ? "dev-hs256" : "off";
  }
  if (getConnectIdTokenSigningPrivateKeyPem()) return "production-jwks";
  if (getIdTokenSigningSecret() && isDevRuntime()) return "dev-hs256";
  return "off";
}

/** Dev-only HS256 re-sign; never enabled in NODE_ENV=production. */
export function isDevIdTokenResignEnabled() {
  return getIdTokenSigningMode() === "dev-hs256";
}

export function isProductionIdTokenSigningEnabled() {
  return getIdTokenSigningMode() === "production-jwks";
}

export function isConnectIdTokenResignEnabled() {
  const mode = getIdTokenSigningMode();
  return mode === "dev-hs256" || mode === "production-jwks";
}

function normalizeUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}
