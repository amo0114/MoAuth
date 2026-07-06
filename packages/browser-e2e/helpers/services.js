const CONNECT_URL = process.env.MOAUTH_CONNECT_PUBLIC_URL || "http://127.0.0.1:3000";
const ACCOUNT_URL = process.env.MOAUTH_ACCOUNT_PUBLIC_URL || "http://127.0.0.1:3002";

const SERVICE_WAIT_TIMEOUT_MS = Number(process.env.BROWSER_E2E_SERVICE_TIMEOUT_MS || 60_000);
const SERVICE_WAIT_INTERVAL_MS = Number(process.env.BROWSER_E2E_SERVICE_INTERVAL_MS || 2_000);

export function serviceUrls() {
  return { connectUrl: CONNECT_URL, accountUrl: ACCOUNT_URL };
}

const ACCOUNT_HEALTH_PATH =
  process.env.MOAUTH_ACCOUNT_HEALTH_PROBE_PATH || "/api/health/ready";

export async function probeServiceHealth() {
  const [connect, account] = await Promise.all([
    probeEndpoint(`${CONNECT_URL}/login`),
    probeReadyEndpoint(`${ACCOUNT_URL}${ACCOUNT_HEALTH_PATH}`),
  ]);

  return {
    ok: connect.ok && account.ok,
    connectUrl: CONNECT_URL,
    accountUrl: ACCOUNT_URL,
    connect,
    account,
  };
}

export async function waitForServices({
  timeoutMs = SERVICE_WAIT_TIMEOUT_MS,
  intervalMs = SERVICE_WAIT_INTERVAL_MS,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastHealth = await probeServiceHealth();

  while (!lastHealth.ok && Date.now() < deadline) {
    await sleep(intervalMs);
    lastHealth = await probeServiceHealth();
  }

  if (!lastHealth.ok) {
    throw new Error(formatServiceUnavailableMessage(lastHealth));
  }

  return lastHealth;
}

export async function areServicesReachable(request) {
  try {
    const [connect, account] = await Promise.all([
      request.get(`${CONNECT_URL}/login`, { maxRedirects: 0, timeout: 5000 }),
      request.get(`${ACCOUNT_URL}${ACCOUNT_HEALTH_PATH}`, { maxRedirects: 0, timeout: 5000 }),
    ]);
    if (connect.status() >= 500) return false;
    if (account.status() >= 500) return false;
    const body = await account.json().catch(() => null);
    return body?.ok === true;
  } catch {
    return false;
  }
}

function formatServiceUnavailableMessage(health) {
  const lines = [
    "Browser e2e requires live Connect and Account dev servers.",
    "",
    "Start them in separate terminals:",
    "  npm run dev:connect   # http://127.0.0.1:3000",
    "  npm run dev:account   # http://127.0.0.1:3002",
    "",
    "Then rerun:",
    "  npm run test:browser-e2e",
    "",
    `Connect (${health.connectUrl}): ${describeEndpoint(health.connect)}`,
    `Account (${health.accountUrl}): ${describeEndpoint(health.account)}`,
  ];
  return lines.join("\n");
}

function describeEndpoint(result) {
  if (result.error) return `unreachable (${result.error})`;
  if (result.status >= 500) return `HTTP ${result.status}`;
  return `HTTP ${result.status}`;
}

async function probeEndpoint(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    return { ok: response.status < 500, status: response.status };
  } catch (cause) {
    return { ok: false, error: String(cause?.message || cause) };
  }
}

async function probeReadyEndpoint(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { ok: false, status: response.status };
    }
    const body = await response.json();
    return { ok: body?.ok === true, status: response.status };
  } catch (cause) {
    return { ok: false, error: String(cause?.message || cause) };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}