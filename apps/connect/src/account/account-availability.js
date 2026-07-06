import {
  getAccountHealthNegativeCacheMs,
  getAccountHealthPositiveCacheMs,
  getAccountHealthProbePath,
  getAccountHealthProbeTimeoutMs,
  getAccountInternalUrl,
} from "../config/env.js";

let healthCache = {
  available: null,
  expiresAt: 0,
};

export function resetAccountHealthCache() {
  healthCache = { available: null, expiresAt: 0 };
}

export async function isAccountCenterAvailable(options = {}) {
  const now = Date.now();
  if (!options.bypassCache && healthCache.expiresAt > now && healthCache.available !== null) {
    return healthCache.available;
  }

  const fetchImpl = options.fetch || fetch;
  const timeoutMs = options.timeoutMs ?? getAccountHealthProbeTimeoutMs();
  const probeUrl = `${getAccountInternalUrl()}${getAccountHealthProbePath()}`;

  let available = false;
  try {
    const response = await fetchImpl(probeUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      const body = await response.json();
      available = body?.ok === true;
    }
  } catch {
    available = false;
  }

  const cacheMs = available
    ? getAccountHealthPositiveCacheMs()
    : getAccountHealthNegativeCacheMs();
  healthCache = {
    available,
    expiresAt: now + cacheMs,
  };

  return available;
}