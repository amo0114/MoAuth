const authRequestCache = new Map();
const CACHE_TTL_MS = 60000; // 60 秒

export function getCachedAuthRequest(authRequestId) {
  const entry = authRequestCache.get(authRequestId);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    authRequestCache.delete(authRequestId);
    return null;
  }

  return entry.data;
}

export function setCachedAuthRequest(authRequestId, data) {
  authRequestCache.set(authRequestId, {
    data,
    timestamp: Date.now(),
  });

  cleanupExpiredCache();
}

function cleanupExpiredCache() {
  if (authRequestCache.size < 100) return;

  const now = Date.now();
  for (const [key, entry] of authRequestCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      authRequestCache.delete(key);
    }
  }
}

export function clearAuthRequestCache(authRequestId) {
  if (authRequestId) {
    authRequestCache.delete(authRequestId);
  } else {
    authRequestCache.clear();
  }
}
