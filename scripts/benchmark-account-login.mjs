#!/usr/bin/env node
/**
 * Measure Account POST /api/login latency (password + handoff issue).
 * Requires Connect (3000) for authRequest + Account (3002) + Zitadel (8081).
 * Usage: node scripts/benchmark-account-login.mjs [--rounds 10] [--login admin|alice]
 */

import { createHash, randomBytes } from "node:crypto";
import net from "node:net";

const CONNECT_URL = process.env.MOAUTH_CONNECT_PUBLIC_URL || "http://127.0.0.1:3000";
const ACCOUNT_URL = process.env.MOAUTH_ACCOUNT_PUBLIC_URL || "http://127.0.0.1:3002";
const CLIENT_ID = process.env.MOAUTH_BENCH_CLIENT_ID || "379664707612573699";
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
  const runs = [];

  for (let round = 1; round <= rounds; round += 1) {
    runs.push(await measureAccountLogin(credentials, round));
    if (round < rounds) await sleep(300);
  }

  const values = runs.map((r) => r.accountLoginMs);
  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        target: `${ACCOUNT_URL}/api/login`,
        loginProfile,
        credentials: { loginName: credentials.loginName },
        rounds,
        runs,
        summary: {
          accountLoginMs: {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: roundMs(values.reduce((s, v) => s + v, 0) / values.length),
            values,
          },
        },
        note: "Includes Zitadel: getAuthRequest + createPasswordSession + hydratePasswordSession + getHumanUser (parallelized in service.js)",
      },
      null,
      2
    )
  );
}

async function measureAccountLogin(credentials, round) {
  const authRequestId = await createAuthRequest(round);
  const started = performance.now();
  const response = await fetch(`${ACCOUNT_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      authRequestId,
      loginName: credentials.loginName,
      password: credentials.password,
    }),
  });
  const body = await response.json();
  const accountLoginMs = roundMs(performance.now() - started);

  if (!response.ok || body.status !== "HANDOFF_ISSUED") {
    throw new Error(
      `Round ${round}: login failed (status=${response.status}, body=${JSON.stringify(body)})`
    );
  }

  return {
    round,
    authRequestId,
    accountLoginMs,
    httpStatus: response.status,
    handoffStatus: body.status,
  };
}

async function createAuthRequest(round) {
  const verifier = base64UrlEncode(randomBytes(32));
  const challenge = base64UrlEncode(createHash("sha256").update(verifier).digest());
  const url = new URL(`${CONNECT_URL}/oauth/v2/authorize`);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", `acct_bench_${round}`);
  url.searchParams.set("nonce", `acct_bench_nonce_${round}`);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  const response = await fetch(url, { redirect: "manual" });
  const location = response.headers.get("location") || "";
  const authRequestId = new URL(location, CONNECT_URL).searchParams.get("authRequest");
  if (!authRequestId) {
    throw new Error(`Failed to obtain authRequest (status=${response.status}, location=${location})`);
  }
  return authRequestId;
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64url");
}

function roundMs(value) {
  return Math.round(value * 100) / 100;
}

function readRounds() {
  const index = process.argv.indexOf("--rounds");
  if (index === -1 || !process.argv[index + 1]) return 10;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 10;
}

function readLoginProfile() {
  const index = process.argv.indexOf("--login");
  const value = index === -1 ? "admin" : process.argv[index + 1] || "admin";
  if (!CREDENTIALS[value]) throw new Error(`Unknown --login "${value}"`);
  return value;
}

async function waitForPort(host, port, timeoutMs = 120_000) {
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