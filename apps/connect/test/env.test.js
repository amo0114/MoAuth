import assert from "node:assert/strict";
import test from "node:test";

import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  getAccountHealthProbePath,
  getAccountInternalUrl,
  getConnectIdTokenSigningPrivateKeyPem,
  getIdTokenSigningMode,
  isConnectIdTokenResignEnabled,
  isDevIdTokenResignEnabled,
  isPasswordLoginFallbackEnabled,
  isProductionIdTokenSigningEnabled,
} from "../src/config/env.js";

const origEnv = { ...process.env };

test("isPasswordLoginFallbackEnabled defaults to false when unset", () => {
  process.env = { ...origEnv };
  delete process.env.CONNECT_PASSWORD_LOGIN_FALLBACK;
  delete process.env.NODE_ENV;
  assert.equal(isPasswordLoginFallbackEnabled(), false);
  process.env = { ...origEnv };
});

test("isDevIdTokenResignEnabled requires dev runtime and signing secret", () => {
  process.env = { ...origEnv, MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET: "dev-secret" };
  delete process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE;
  delete process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY;
  delete process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE;
  delete process.env.NODE_ENV;
  assert.equal(isDevIdTokenResignEnabled(), true);

  process.env = {
    ...origEnv,
    NODE_ENV: "production",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET: "dev-secret",
  };
  delete process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE;
  delete process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY;
  delete process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE;
  assert.equal(isDevIdTokenResignEnabled(), false);
  assert.equal(getIdTokenSigningMode(), "off");
  process.env = { ...origEnv };
});

test("getConnectIdTokenSigningPrivateKeyPem reads PRIVATE_KEY_FILE when inline key is unset", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "moauth-env-key-"));
  const keyPath = path.join(dir, "private.pem");
  writeFileSync(keyPath, "-----BEGIN PRIVATE KEY-----\nFILE-KEY\n-----END PRIVATE KEY-----\n", "utf8");

  process.env = {
    ...origEnv,
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY_FILE: keyPath,
  };
  delete process.env.MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY;

  assert.match(getConnectIdTokenSigningPrivateKeyPem(), /FILE-KEY/);
  process.env = { ...origEnv };
});

test("production-jwks mode activates when private key is configured", () => {
  process.env = {
    ...origEnv,
    NODE_ENV: "production",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET: "dev-secret",
  };
  assert.equal(getIdTokenSigningMode(), "production-jwks");
  assert.equal(isProductionIdTokenSigningEnabled(), true);
  assert.equal(isConnectIdTokenResignEnabled(), true);
  assert.equal(isDevIdTokenResignEnabled(), false);
  process.env = { ...origEnv };
});

test("explicit dev-hs256 mode is ignored in production", () => {
  process.env = {
    ...origEnv,
    NODE_ENV: "production",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_MODE: "dev-hs256",
    MOAUTH_CONNECT_ID_TOKEN_SIGNING_SECRET: "dev-secret",
  };
  assert.equal(getIdTokenSigningMode(), "off");
  assert.equal(isDevIdTokenResignEnabled(), false);
  assert.equal(isConnectIdTokenResignEnabled(), false);
  process.env = { ...origEnv };
});

test("getAccountInternalUrl prefers internal URL over public URL", () => {
  process.env = {
    ...origEnv,
    MOAUTH_ACCOUNT_PUBLIC_URL: "https://id.example.com",
    MOAUTH_ACCOUNT_INTERNAL_URL: "http://account:3002",
  };
  assert.equal(getAccountInternalUrl(), "http://account:3002");
  process.env = { ...origEnv };
});

test("getAccountInternalUrl falls back to public URL when internal is unset", () => {
  process.env = { ...origEnv, MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002" };
  delete process.env.MOAUTH_ACCOUNT_INTERNAL_URL;
  assert.equal(getAccountInternalUrl(), "http://127.0.0.1:3002");
  process.env = { ...origEnv };
});

test("getAccountHealthProbePath defaults to readiness endpoint", () => {
  process.env = { ...origEnv };
  delete process.env.MOAUTH_ACCOUNT_HEALTH_PROBE_PATH;
  assert.equal(getAccountHealthProbePath(), "/api/health/ready");
  process.env = { ...origEnv };
});

test("isPasswordLoginFallbackEnabled is true only when env is literal true", () => {
  process.env = { ...origEnv, CONNECT_PASSWORD_LOGIN_FALLBACK: "true" };
  assert.equal(isPasswordLoginFallbackEnabled(), true);

  process.env = { ...origEnv, CONNECT_PASSWORD_LOGIN_FALLBACK: "false" };
  assert.equal(isPasswordLoginFallbackEnabled(), false);

  process.env = { ...origEnv, CONNECT_PASSWORD_LOGIN_FALLBACK: "1" };
  assert.equal(isPasswordLoginFallbackEnabled(), false);
  process.env = { ...origEnv };
});