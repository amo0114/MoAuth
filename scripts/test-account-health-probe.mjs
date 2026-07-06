#!/usr/bin/env node
/**
 * Live integration checks for Account health endpoints and Connect availability probe.
 * Usage: node scripts/test-account-health-probe.mjs
 */
import assert from "node:assert/strict";

const ACCOUNT_URL = process.env.MOAUTH_ACCOUNT_PUBLIC_URL || "http://127.0.0.1:3002";
const CONNECT_URL = process.env.MOAUTH_CONNECT_PUBLIC_URL || "http://127.0.0.1:3000";

const results = [];

function record(name, status, detail = "") {
  results.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { response, body };
}

async function probeAccountLive() {
  try {
    const { response, body } = await fetchJson(`${ACCOUNT_URL}/api/health/live`);
    const passed = response.ok && body?.ok === true && body?.service === "account";
    record("Account /api/health/live", passed ? "PASS" : "FAIL", `status=${response.status}`);
    return passed;
  } catch (error) {
    record("Account /api/health/live", "FAIL", String(error?.message || error));
    return false;
  }
}

async function probeAccountReady() {
  try {
    const { response, body } = await fetchJson(`${ACCOUNT_URL}/api/health/ready`);
    const passed =
      response.ok &&
      body?.ok === true &&
      body?.checks?.zitadel === true &&
      body?.checks?.handoff === true;
    record(
      "Account /api/health/ready",
      passed ? "PASS" : "FAIL",
      `status=${response.status} checks=${JSON.stringify(body?.checks || {})}`
    );
    return passed;
  } catch (error) {
    record("Account /api/health/ready", "FAIL", String(error?.message || error));
    return false;
  }
}

async function probeConnectAvailabilityModule() {
  process.env.MOAUTH_ACCOUNT_PUBLIC_URL = ACCOUNT_URL;
  delete process.env.MOAUTH_ACCOUNT_INTERNAL_URL;
  delete process.env.MOAUTH_ACCOUNT_HEALTH_PROBE_PATH;

  const { isAccountCenterAvailable, resetAccountHealthCache } = await import(
    "../apps/connect/src/account/account-availability.js"
  );
  resetAccountHealthCache();

  const available = await isAccountCenterAvailable({ bypassCache: true });
  record("Connect isAccountCenterAvailable (module)", available ? "PASS" : "FAIL", `available=${available}`);
  return available;
}

async function obtainAuthRequestId() {
  const authorizeUrl = new URL("/oauth/v2/authorize", CONNECT_URL);
  authorizeUrl.searchParams.set("client_id", process.env.MOAUTH_CONNECT_CLIENT_ID || "380559739236450307");
  authorizeUrl.searchParams.set(
    "redirect_uri",
    "http://127.0.0.1:3001/api/auth/moauth/callback"
  );
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("code_challenge", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", "health-probe");

  const response = await fetch(authorizeUrl, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  const location = response.headers.get("location") || "";
  const match = location.match(/authRequest=([^&]+)/);
  assert.ok(match, `authorize did not return authRequest (status=${response.status})`);
  return match[1];
}

async function probeConnectLoginWithAuthRequest({ expectUnavailable, label }) {
  try {
    const authRequestId = await obtainAuthRequestId();
    const response = await fetch(`${CONNECT_URL}/login?authRequest=${authRequestId}`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    const showsUnavailable =
      response.status === 200 &&
      (html.includes("connect-card--unavailable") || html.includes("unavailable-flow"));
    const redirectsToAccount =
      response.status === 307 && (response.headers.get("location") || "").includes("3002");
    const passed = expectUnavailable ? showsUnavailable : !showsUnavailable;
    const detail = expectUnavailable
      ? showsUnavailable
        ? "unavailable page rendered"
        : `status=${response.status}, location=${response.headers.get("location") || "none"}`
      : showsUnavailable
        ? "unexpected unavailable page"
        : redirectsToAccount
          ? "redirects to Account login"
          : `status=${response.status}`;
    record(label, passed ? "PASS" : "FAIL", detail);
    return passed;
  } catch (error) {
    record(label, "FAIL", String(error?.message || error));
    return false;
  }
}

async function probeNegativeCache() {
  process.env.MOAUTH_ACCOUNT_PUBLIC_URL = "http://127.0.0.1:1";
  process.env.MOAUTH_ACCOUNT_HEALTH_NEGATIVE_CACHE_MS = "60000";

  const { isAccountCenterAvailable, resetAccountHealthCache } = await import(
    "../apps/connect/src/account/account-availability.js"
  );
  resetAccountHealthCache();

  let calls = 0;
  const fetch = async () => {
    calls += 1;
    throw new Error("ECONNREFUSED");
  };

  const first = await isAccountCenterAvailable({ fetch });
  const second = await isAccountCenterAvailable({ fetch });
  const passed = first === false && second === false && calls === 1;
  record("Connect negative cache suppresses repeat probes", passed ? "PASS" : "FAIL", `calls=${calls}`);
  return passed;
}

console.log("Account health probe — live integration");
console.log(`Account URL: ${ACCOUNT_URL}`);
console.log(`Connect URL: ${CONNECT_URL}`);
console.log("");

const accountUp = (await probeAccountLive()) && (await probeAccountReady());

if (accountUp) {
  await probeConnectAvailabilityModule();
  await probeConnectLoginWithAuthRequest({
    expectUnavailable: false,
    label: "Connect login routes to Account when Account ready",
  });
} else {
  record(
    "Connect isAccountCenterAvailable (module)",
    "SKIP",
    "Account not reachable"
  );
  record(
    "Connect login routes to Account when Account ready",
    "SKIP",
    "Account not reachable"
  );
  await probeConnectLoginWithAuthRequest({
    expectUnavailable: true,
    label: "Connect login shows unavailable when Account down",
  });
}

await probeNegativeCache();

const failed = results.filter((item) => item.status === "FAIL");
const passed = results.filter((item) => item.status === "PASS");
const skipped = results.filter((item) => item.status === "SKIP");
console.log("");
console.log(
  `Summary: ${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped (${results.length} total)`
);

const requiredWhenAccountUp = [
  "Account /api/health/live",
  "Account /api/health/ready",
  "Connect isAccountCenterAvailable (module)",
  "Connect login routes to Account when Account ready",
  "Connect negative cache suppresses repeat probes",
];
const requiredWhenAccountDown = [
  "Connect login shows unavailable when Account down",
  "Connect negative cache suppresses repeat probes",
];

const required = accountUp ? requiredWhenAccountUp : requiredWhenAccountDown;
const requiredFailed = results.filter(
  (item) => item.status === "FAIL" && required.includes(item.name)
);

if (requiredFailed.length > 0) {
  process.exitCode = 1;
}