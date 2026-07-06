import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOidcErrorRedirect,
  resolveLoginRoute,
} from "../src/oidc/prompt-flow.js";

test("resolveLoginRoute redirects to account when no SSO and fallback disabled", () => {
  const route = resolveLoginRoute({
    hasConnectSso: false,
    prompt: [],
    passwordFallbackEnabled: false,
  });
  assert.equal(route.type, "redirect_account");
});

test("resolveLoginRoute uses password fallback when enabled and no SSO", () => {
  const route = resolveLoginRoute({
    hasConnectSso: false,
    prompt: [],
    passwordFallbackEnabled: true,
  });
  assert.equal(route.type, "password_fallback");
});

test("resolveLoginRoute shows consent when SSO exists", () => {
  const route = resolveLoginRoute({
    hasConnectSso: true,
    prompt: [],
    passwordFallbackEnabled: false,
  });
  assert.equal(route.type, "consent");
});

test("resolveLoginRoute forces consent when Zitadel returns PROMPT_CONSENT", () => {
  const route = resolveLoginRoute({
    hasConnectSso: true,
    prompt: ["PROMPT_CONSENT"],
    passwordFallbackEnabled: false,
  });
  assert.equal(route.type, "consent");
  assert.equal(route.forceConsent, true);
});

test("resolveLoginRoute returns login_required for prompt=none without SSO", () => {
  const route = resolveLoginRoute({
    hasConnectSso: false,
    prompt: ["none"],
    passwordFallbackEnabled: false,
  });
  assert.equal(route.type, "login_required");
});

test("resolveLoginRoute clears SSO and redirects account for prompt=login", () => {
  const route = resolveLoginRoute({
    hasConnectSso: true,
    prompt: ["login"],
    passwordFallbackEnabled: false,
  });
  assert.equal(route.type, "redirect_account");
  assert.equal(route.clearSso, true);
});

test("buildOidcErrorRedirect preserves state and error", () => {
  const url = buildOidcErrorRedirect({
    redirectUri: "http://127.0.0.1:3001/api/auth/moauth/callback",
    state: "state_01234567890123456789",
    error: "login_required",
    errorDescription: "No active session",
  });
  assert.match(url, /error=login_required/);
  assert.match(url, /state=state_01234567890123456789/);
});