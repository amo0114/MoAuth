const SUBBOOST_CLIENT_ID = "380559739236450307";
const SUBBOOST_CALLBACK = "http://127.0.0.1:3001/api/auth/moauth/callback";
const STATE = "state_01234567890123456789";

export function createMockZitadelFetch(registry) {
  return async function mockZitadelFetch(url, init) {
    const key = `${init?.method || "GET"} ${String(url)}`;
    const authRequestMatch = key.match(/auth_requests\/([^/]+)$/);
    if (authRequestMatch && init?.method === "GET") {
      const authRequestId = decodeURIComponent(authRequestMatch[1]);
      const record = registry.authRequests.get(authRequestId);
      if (!record) {
        return response(404, { error: "not found" });
      }
      return response(200, { authRequest: record });
    }

    if (key.endsWith("/v2/sessions") && init?.method === "POST") {
      const body = JSON.parse(init.body);
      if (body.checks?.password?.password !== "alice-password") {
        return response(401, { error: "invalid credentials" });
      }
      return response(200, {
        sessionId: "sess-alice",
        sessionToken: "tok-alice",
        factors: {
          user: {
            id: "zitadel-user-alice",
            loginName: "alice@example.com",
            email: "alice@example.com",
            emailVerified: true,
          },
        },
      });
    }

    const finalizeMatch = key.match(/auth_requests\/([^/]+)$/);
    if (finalizeMatch && init?.method === "POST") {
      const authRequestId = decodeURIComponent(finalizeMatch[1]);
      const record = registry.authRequests.get(authRequestId);
      const body = JSON.parse(init.body);
      if (!record) {
        return response(404, { error: "not found" });
      }
      if (body.session?.sessionId !== "sess-alice") {
        return response(409, { error: "not ready" });
      }
      return response(200, {
        callbackUrl: `${record.redirectUri}?code=auth-code-${authRequestId}&state=${record.state}`,
      });
    }

    throw new Error(`Unexpected Zitadel fetch: ${key}`);
  };
}

export function seedSubBoostAuthRequest(registry, authRequestId, options = {}) {
  registry.authRequests.set(authRequestId, {
    id: authRequestId,
    clientId: SUBBOOST_CLIENT_ID,
    redirectUri: SUBBOOST_CALLBACK,
    scope: ["openid", "profile", "email"],
    state: options.state || STATE,
    prompt: options.prompt || [],
  });
}

export function getSubBoostConstants() {
  return {
    clientId: SUBBOOST_CLIENT_ID,
    callback: SUBBOOST_CALLBACK,
    state: STATE,
    alice: {
      loginName: "alice@example.com",
      password: "alice-password",
      email: "alice@example.com",
      sub: "zitadel-user-alice",
    },
  };
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  };
}