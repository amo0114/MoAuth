#!/usr/bin/env node
/**
 * Browser chain navigation test — traces redirect hops and detects flicker/failures.
 * Usage: node scripts/test-chain-navigation.mjs [--include-account-down]
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CONNECT_URL = process.env.MOAUTH_CONNECT_PUBLIC_URL || "http://127.0.0.1:3000";
const ACCOUNT_URL = process.env.MOAUTH_ACCOUNT_PUBLIC_URL || "http://127.0.0.1:3002";
const SUBBOOST_URL = process.env.SUBBOOST_URL || "http://127.0.0.1:3001";
const ADMIN = {
  loginName: "moauth-admin@moauth.localhost",
  password: "MoAuthAdminPass2026!",
};

const OUT_DIR = path.join(process.cwd(), "scripts", ".chain-test-artifacts");
const INCLUDE_ACCOUNT_DOWN = process.argv.includes("--include-account-down");
const results = [];

function record(name, status, detail = "", extra = {}) {
  const entry = { name, status, detail, ...extra };
  results.push(entry);
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function createNavTrace() {
  return [];
}

function attachTrace(page, trace) {
  const t0 = Date.now();
  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return;
    trace.push({ url: frame.url(), atMs: Date.now() - t0 });
  });
}

async function pollUnavailable(page, durationMs = 2000, intervalMs = 100) {
  const transitions = [];
  let lastVisible = null;
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    const visible = (await page.locator(".connect-card--unavailable, .unavailable-flow").count().catch(() => 0)) > 0;
    if (lastVisible !== null && visible !== lastVisible) {
      transitions.push({ atMs: Date.now() - start, url: page.url(), visible });
    }
    lastVisible = visible;
    await page.waitForTimeout(intervalMs);
  }
  return transitions;
}

function analyzeTrace(trace) {
  const urls = trace.map((e) => e.url);
  const connectHops = urls.filter((u) => u.includes(":3000")).length;
  const accountHops = urls.filter((u) => u.includes(":3002")).length;
  const subboostHops = urls.filter((u) => u.includes(":3001")).length;
  const errorHops = urls.filter((u) => u.includes("error=") || u.includes("moauth_callback_error")).length;
  return { urls, connectHops, accountHops, subboostHops, errorHops, total: urls.length };
}

function isSubboostErrorUrl(url) {
  return url.includes("moauth_callback_error") || url.includes("error=moauth");
}

async function maybeAllowConsent(page) {
  const allow = page.getByRole("button", { name: /允许|Allow|授权|Continue to/i });
  if ((await allow.count()) === 0) return false;
  await allow.first().click();
  await page.waitForTimeout(1200);
  return true;
}

async function fillAccountLoginIfPresent(page) {
  const loginName = page.locator("#loginName");
  if ((await loginName.count()) === 0) return false;
  await loginName.fill(ADMIN.loginName);
  await page.locator("#password").fill(ADMIN.password);
  await page.getByRole("button", { name: /登录并继续|Sign in and continue/i }).click();
  return true;
}

async function runSubBoostFullChain(browser, label, startUrl) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const trace = createNavTrace();
  attachTrace(page, trace);

  try {
    const started = Date.now();
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(600);
    const flickerEarly = await pollUnavailable(page, 1500);

    if (isAccountLoginUrl(page.url())) {
      const flickerBeforeLogin = await pollUnavailable(page, 500);
      const filled = await fillAccountLoginIfPresent(page);
      if (!filled) {
        record(label, "FAIL", `Account login form missing at ${page.url()}`);
        return false;
      }
      await page.waitForTimeout(2500);
      flickerEarly.push(...flickerBeforeLogin);
    }

    if (isConnectLoginUrl(page.url())) {
      const flickerOnConnect = await pollUnavailable(page, 1500);
      flickerEarly.push(...flickerOnConnect);
      const allowed = await maybeAllowConsent(page);
      if (allowed) {
        await page.waitForTimeout(2000);
      }
    }

    const flickerLate = await pollUnavailable(page, 1500);
    const allFlicker = [...flickerEarly, ...flickerLate];
    const finalUrl = page.url();
    const analysis = analyzeTrace(trace);
    const hasUnavailable = (await page.locator(".connect-card--unavailable").count()) > 0;
    const subboostError = isSubboostErrorUrl(finalUrl) || analysis.errorHops > 0;
    const reachedSubboost = finalUrl.startsWith(SUBBOOST_URL) && !subboostError;

    const passed = !subboostError && !hasUnavailable && allFlicker.length === 0 && analysis.errorHops === 0;

    record(
      label,
      passed ? "PASS" : "FAIL",
      `final=${finalUrl} elapsed=${Date.now() - started}ms hops=${analysis.total} flicker=${allFlicker.length} subboostOk=${reachedSubboost}`,
      { trace: analysis.urls, flicker: allFlicker, analysis }
    );
    await page.screenshot({ path: path.join(OUT_DIR, `${label.replace(/\W+/g, "-").toLowerCase()}.png`), fullPage: true });
    return passed;
  } catch (error) {
    record(label, "FAIL", String(error?.message || error));
    await page.screenshot({ path: path.join(OUT_DIR, `${label.replace(/\W+/g, "-").toLowerCase()}-error.png`), fullPage: true }).catch(() => {});
    return false;
  } finally {
    await context.close();
  }
}

async function runAccountSsoSkip(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const trace = createNavTrace();
  attachTrace(page, trace);

  try {
    await page.goto(`${SUBBOOST_URL}/api/auth/moauth/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(500);
    if (!isAccountLoginUrl(page.url())) {
      record("Account SSO skip (cold)", "SKIP", `landed on ${page.url()} before account login`);
      return true;
    }

    await fillAccountLoginIfPresent(page);
    await page.waitForTimeout(3000);
    const firstLanding = page.url();

    await page.goto(`${SUBBOOST_URL}/api/auth/moauth/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    const flicker = await pollUnavailable(page, 1500);

    const passwordVisible = (await page.locator("#password").count()) > 0;
    const onAccount = isAccountLoginUrl(page.url());
    const analysis = analyzeTrace(trace);

    const passed = flicker.length === 0 && (!onAccount || !passwordVisible || firstLanding.includes("3000"));
    record(
      "Account SSO skip (warm)",
      passed ? "PASS" : "FAIL",
      `first=${firstLanding} second=${page.url()} passwordForm=${passwordVisible} flicker=${flicker.length}`,
      { trace: analysis.urls, flicker }
    );
    return passed;
  } catch (error) {
    record("Account SSO skip (warm)", "FAIL", String(error?.message || error));
    return false;
  } finally {
    await context.close();
  }
}

async function runAccountDownScenario(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const trace = createNavTrace();
  attachTrace(page, trace);

  try {
    await page.goto(`${SUBBOOST_URL}/api/auth/moauth/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    const flicker = await pollUnavailable(page, 2000);
    const hasUnavailable = (await page.locator(".connect-card--unavailable").count()) > 0;
    const stableOnConnect = isConnectLoginUrl(page.url()) && hasUnavailable;
    const analysis = analyzeTrace(trace);

    const passed = stableOnConnect && flicker.length === 0;
    record(
      "Account down: stable unavailable page",
      passed ? "PASS" : "FAIL",
      `url=${page.url()} unavailable=${hasUnavailable} flicker=${flicker.length}`,
      { trace: analysis.urls, flicker }
    );
    return passed;
  } catch (error) {
    record("Account down: stable unavailable page", "FAIL", String(error?.message || error));
    return false;
  } finally {
    await context.close();
  }
}

function isAccountLoginUrl(url) {
  return url.startsWith(`${ACCOUNT_URL}/login`);
}

function isConnectLoginUrl(url) {
  return url.startsWith(`${CONNECT_URL}/login`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const health = await fetch(`${ACCOUNT_URL}/api/health/ready`).then((r) => r.json()).catch(() => null);
  console.log("Chain navigation test (browser)");
  console.log(`Connect=${CONNECT_URL} Account=${ACCOUNT_URL} SubBoost=${SUBBOOST_URL}`);
  console.log(`Account ready: ${health?.ok === true ? "yes" : "no"}`);
  console.log("");

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    console.error("Playwright chromium not available:", error.message);
    process.exit(1);
  }

  await runSubBoostFullChain(browser, "SubBoost MoAuth login (full chain)", `${SUBBOOST_URL}/api/auth/moauth/login`);
  await runAccountSsoSkip(browser);

  if (INCLUDE_ACCOUNT_DOWN || health?.ok !== true) {
    await runAccountDownScenario(browser);
  } else {
    record("Account down: stable unavailable page", "SKIP", "pass --include-account-down to run");
  }

  await browser.close();

  const failed = results.filter((r) => r.status === "FAIL");
  const passed = results.filter((r) => r.status === "PASS");
  const skipped = results.filter((r) => r.status === "SKIP");

  const report = {
    testedAt: new Date().toISOString(),
    services: { connect: CONNECT_URL, account: ACCOUNT_URL, subboost: SUBBOOST_URL },
    accountReady: health?.ok === true,
    summary: { passed: passed.length, failed: failed.length, skipped: skipped.length },
    results,
  };

  const reportPath = path.join(OUT_DIR, "chain-navigation-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log("");
  console.log(`Summary: ${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped`);
  console.log(`Report: ${reportPath}`);

  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});