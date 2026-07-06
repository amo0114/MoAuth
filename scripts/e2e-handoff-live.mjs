#!/usr/bin/env node

const CONNECT_URL = process.env.MOAUTH_CONNECT_PUBLIC_URL || "http://127.0.0.1:3000";
const ACCOUNT_URL = process.env.MOAUTH_ACCOUNT_PUBLIC_URL || "http://127.0.0.1:3002";

async function probe(name, url) {
  try {
    const response = await fetch(url, { redirect: "manual" });
    return { name, url, ok: response.status < 500, status: response.status };
  } catch (error) {
    return { name, url, ok: false, error: String(error) };
  }
}

const checks = await Promise.all([
  probe("connect-login", `${CONNECT_URL}/login`),
  probe("account-login", `${ACCOUNT_URL}/login`),
  probe("connect-discovery", `${CONNECT_URL}/.well-known/openid-configuration`),
]);

const failed = checks.filter((check) => !check.ok);

if (failed.length) {
  console.error("Live handoff smoke failed. Start services first:");
  console.error("  npm run dev:connect");
  console.error("  npm run dev:account");
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.url} -> ${check.error || check.status}`);
  }
  process.exit(1);
}

console.log("Live handoff smoke passed:");
for (const check of checks) {
  console.log(`- ${check.name}: HTTP ${check.status}`);
}
console.log("Next: open SubBoost login, complete Account password login, verify Connect consent (no password form).");