#!/usr/bin/env node
/**
 * Measure end-to-end latency: OIDC authorize -> Account login -> handoff -> consent -> token -> userinfo.
 * Usage: node scripts/benchmark-full-chain-latency.mjs [--rounds 3] [--login alice|admin]
 */

import { createHash, randomBytes } from "node:crypto";
import net from "node:net";

const CONNECT_URL = process.env.MOAUTH_CONNECT_PUBLIC_URL || "http://127.0.0.1:3000";
const ACCOUNT_URL = process.env.MOAUTH_ACCOUNT_PUBLIC_URL || "http://127.0.0.1:3002";
const CLIENT_ID = process.env.MOAUTH_BENCH_CLIENT_ID || "379664707612573699";
const CLIENT_SECRET =
  process.env.MOAUTH_BENCH_CLIENT_SECRET ||
  "3moqEVhwj8ElnPWRbt3BKZxr7xp8xBfsKcC73VqTD40j1WYS4Zxb8lgpaItIfj4a";
const REDIRECT_URI =
  process.env.MOAUTH_BENCH_REDIRECT_URI || "http://127.0.0.1:3001/api/auth/moauth/callback";

const CREDENTIALS = {
  alice: { loginName: "alice@example.com", password: "Password123!" },
  admin: { loginName: "moauth-admin@moauth.localhost", password: "MoAuthAdminPass2026!" },
};

const rounds = readRounds();
const loginProfile = readLoginProfile();

async function main() {
  await waitForPort("127.0.0.1", 3000);
  await waitForPort("127.0.0.1", 3002);
  await waitForPort("127.0.0.1", 8081);

  const credentials = CREDENTIALS[loginProfile];
  const runResults = [];

  for (let round = 1; round <= rounds; round += 1) {
    const result = await runFullChain(credentials, round);
    runResults.push(result);
    if (round < rounds) {
      await sleep(500);
    }
  }

  const summary = summarize(runResults);
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), loginProfile, rounds, runs: runResults, summary }, null, 2));
}

async function runFullChain(credentials, round) {
  const pkceVerifier = base64UrlEncode(randomBytes(32));
  const codeChallenge = base64UrlEncode(createHash("sha256").update(pkceVerifier).digest());
  const state = `bench_state_${round}_${Date.now()}`;
  const nonce = `bench_nonce_${round}_${Date.now()}`;

  const timings = {};
  const chainStart = performance.now();

  // Step 1: OIDC authorize -> authRequest
  const authorizeUrl = new URL(`${CONNECT_URL}/oauth/v2/authorize`);
  authorizeUrl.searchParams.set("client_id", CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("nonce", nonce);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const authorizeStarted = performance.now();
  const authorizeResponse = await fetch(authorizeUrl, { redirect: "manual" });
  const authorizeLocation = authorizeResponse.headers.get("location") || "";
  timings.authorizeMs = roundMs(performance.now() - authorizeStarted);

  const authRequestId = extractAuthRequestId(authorizeLocation);
  if (!authRequestId) {
    throw new Error(`Round ${round}: authorize did not return authRequest (status=${authorizeResponse.status}, location=${authorizeLocation})`);
  }

  // Step 2: Account password login -> handoff redirect
  const loginStarted = performance.now();
  const loginResponse = await fetch(`${ACCOUNT_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      authRequestId,
      loginName: credentials.loginName,
      password: credentials.password,
    }),
  });
  const loginBody = await loginResponse.json();
  timings.accountLoginMs = roundMs(performance.now() - loginStarted);

  if (!loginResponse.ok || loginBody.status !== "HANDOFF_ISSUED") {
    throw new Error(
      `Round ${round}: account login failed (status=${loginResponse.status}, body=${JSON.stringify(loginBody)})`
    );
  }

  const handoffUrl = loginBody.redirectUrl;
  const handoffCode = new URL(handoffUrl).searchParams.get("code");

  // Step 3: Connect handoff consume -> SSO cookie
  const handoffStarted = performance.now();
  const jar = new CookieJar();
  const handoffResponse = await fetch(handoffUrl, {
    redirect: "manual",
    headers: { Accept: "text/html" },
  });
  jar.ingest(handoffResponse);
  timings.handoffConsumeMs = roundMs(performance.now() - handoffStarted);

  const handoffLocation = handoffResponse.headers.get("location") || "";
  if (handoffResponse.status !== 307 && handoffResponse.status !== 302 && handoffResponse.status !== 303) {
    throw new Error(`Round ${round}: handoff failed (status=${handoffResponse.status}, location=${handoffLocation})`);
  }
  if (!handoffLocation.includes("/login?authRequest=")) {
    throw new Error(`Round ${round}: handoff redirected unexpectedly (${handoffLocation})`);
  }

  const connectCookie = jar.get("moauth_connect_session");
  if (!connectCookie) {
    throw new Error(`Round ${round}: Connect SSO cookie missing after handoff`);
  }

  // Step 4: Consent allow -> callback with authorization code
  const consentStarted = performance.now();
  const consentResponse = await fetch(`${CONNECT_URL}/api/consent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Cookie: jar.header(),
    },
    body: JSON.stringify({ authRequest: authRequestId, action: "allow" }),
  });
  const consentBody = await consentResponse.json();
  timings.consentMs = roundMs(performance.now() - consentStarted);

  if (!consentResponse.ok || consentBody.status !== "AUTH_REQUEST_FINALIZED") {
    throw new Error(
      `Round ${round}: consent failed (status=${consentResponse.status}, body=${JSON.stringify(consentBody)})`
    );
  }

  const callbackUrl = new URL(consentBody.callbackUrl);
  const authCode = callbackUrl.searchParams.get("code");
  if (!authCode) {
    throw new Error(`Round ${round}: callback missing authorization code (${consentBody.callbackUrl})`);
  }

  // Step 5: Token exchange
  const tokenStarted = performance.now();
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code: authCode,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: pkceVerifier,
  });
  const tokenResponse = await fetch(`${CONNECT_URL}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  const tokenText = await tokenResponse.text();
  let tokenJson;
  try {
    tokenJson = JSON.parse(tokenText);
  } catch {
    throw new Error(
      `Round ${round}: token exchange returned non-JSON (status=${tokenResponse.status}, body=${tokenText.slice(0, 200)})`
    );
  }
  timings.tokenExchangeMs = roundMs(performance.now() - tokenStarted);

  if (!tokenResponse.ok || !tokenJson.access_token) {
    throw new Error(
      `Round ${round}: token exchange failed (status=${tokenResponse.status}, body=${JSON.stringify(tokenJson)})`
    );
  }

  timings.totalMs = roundMs(performance.now() - chainStart);

  return {
    round,
    authRequestId,
    handoffCodePrefix: handoffCode?.slice(0, 8) || null,
    authCodePrefix: authCode.slice(0, 8),
    tokenType: tokenJson.token_type || null,
    hasIdToken: Boolean(tokenJson.id_token),
    expiresIn: tokenJson.expires_in ?? null,
    timings,
  };
}

function summarize(runs) {
  const keys = ["authorizeMs", "accountLoginMs", "handoffConsumeMs", "consentMs", "tokenExchangeMs", "totalMs"];
  const summary = {};
  for (const key of keys) {
    const values = runs.map((run) => run.timings[key]);
    summary[key] = {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: roundMs(values.reduce((sum, value) => sum + value, 0) / values.length),
      values,
    };
  }
  return summary;
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  ingest(response) {
    const raw =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : splitSetCookieHeader(response.headers.get("set-cookie"));
    for (const entry of raw) {
      const pair = entry.split(";")[0];
      const separator = pair.indexOf("=");
      if (separator <= 0) continue;
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (name && value) {
        this.cookies.set(name, value);
      }
    }
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  get(name) {
    return this.cookies.get(name) || null;
  }
}

function splitSetCookieHeader(headerValue) {
  if (!headerValue) return [];
  return headerValue.split(/,(?=\s*[^;,]+=)/);
}

function extractAuthRequestId(location) {
  if (!location) return null;
  try {
    const url = new URL(location, CONNECT_URL);
    return url.searchParams.get("authRequest") || url.searchParams.get("auth_request");
  } catch {
    return null;
  }
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64url");
}

function roundMs(value) {
  return Math.round(value * 100) / 100;
}

function readRounds() {
  const index = process.argv.indexOf("--rounds");
  if (index === -1 || !process.argv[index + 1]) return 3;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 3;
}

function readLoginProfile() {
  const index = process.argv.indexOf("--login");
  const value = index === -1 ? "admin" : process.argv[index + 1] || "admin";
  if (!CREDENTIALS[value]) {
    throw new Error(`Unknown --login profile "${value}". Use alice or admin.`);
  }
  return value;
}

async function waitForPort(host, port, timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.connect({ host, port }, () => {
          socket.end();
          resolve();
        });
        socket.setTimeout(2_000);
        socket.on("error", reject);
        socket.on("timeout", () => {
          socket.destroy();
          reject(new Error("timeout"));
        });
      });
      return;
    } catch {
      await sleep(1_000);
    }
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});