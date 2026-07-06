import { Agent, fetch as undiciFetch } from 'undici';

const globalAgent = new Agent({
  keepAliveTimeout: 60000,
  keepAliveMaxTimeout: 60000,
  connections: 50,
  pipelining: 1,
  connect: {
    timeout: 10000,
  },
});

export function createOptimizedFetch() {
  return async function optimizedFetch(url, options = {}) {
    const startTime = Date.now();

    const response = await undiciFetch(url, {
      ...options,
      dispatcher: globalAgent,
    });

    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - startTime;
      const method = options.method || 'GET';
      const pathname = new URL(url).pathname;
      console.log(`[HTTP] ${method} ${pathname} - ${response.status} ${duration}ms`);
    }

    return response;
  };
}

export function getGlobalAgent() {
  return globalAgent;
}
