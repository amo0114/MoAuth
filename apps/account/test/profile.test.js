import assert from "node:assert/strict";
import test from "node:test";

import {
  getAccountProfile,
  patchAccountProfile,
  profileFromSession,
} from "../src/profile/service.js";
import { createAccountSession } from "../src/session/account-session.js";

const origEnv = { ...process.env };

function withEnv(partial, fn) {
  return async () => {
    process.env = { ...origEnv, ...partial };
    try {
      return await fn();
    } finally {
      process.env = { ...origEnv };
    }
  };
}

const session = createAccountSession({
  session: { sessionId: "sess-1", sessionToken: "tok-1" },
  sub: "user-1",
  loginName: "alice",
  email: "alice@example.com",
  emailVerified: true,
  now: new Date("2026-06-30T12:00:00.000Z"),
});

test("profileFromSession exposes stable profile shape", () => {
  const profile = profileFromSession(session);
  assert.equal(profile.loginName, "alice");
  assert.equal(profile.displayName, null);
  assert.equal(profile.avatarUrl, null);
});

test(
  "getAccountProfile merges Zitadel profile when configured",
  withEnv(
    {
      ZITADEL_ISSUER: "https://zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test",
      ZITADEL_ORG_ID: "org-1",
    },
    async () => {
      const fetchMock = async (url, init) => {
        const key = `${init?.method || "GET"} ${String(url)}`;
        if (key === "GET https://zitadel.example.com/management/v1/users/user-1") {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                user: {
                  id: "user-1",
                  preferredLoginName: "alice",
                  human: {
                    profile: {
                      firstName: "Alice",
                      lastName: "Wonderland",
                      displayName: "Alice Wonderland",
                    },
                    email: { email: "alice@example.com", isEmailVerified: true },
                  },
                },
              }),
            headers: new Headers(),
          };
        }
        throw new Error(`Unexpected fetch ${key}`);
      };

      const profile = await getAccountProfile(session, { fetch: fetchMock });
      assert.equal(profile.displayName, "Alice Wonderland");
      assert.equal(profile.firstName, "Alice");
    }
  )
);

test(
  "patchAccountProfile updates profile through Zitadel",
  withEnv(
    {
      ZITADEL_ISSUER: "https://zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test",
      ZITADEL_ORG_ID: "org-1",
    },
    async () => {
      const fetchMock = async (url, init) => {
        const key = `${init?.method || "GET"} ${String(url)}`;
        if (key === "PUT https://zitadel.example.com/management/v1/users/user-1/profile") {
          return { ok: true, status: 200, text: async () => "{}", headers: new Headers() };
        }
        if (key === "GET https://zitadel.example.com/management/v1/users/user-1") {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                user: {
                  id: "user-1",
                  preferredLoginName: "alice",
                  human: {
                    profile: {
                      firstName: "Alice",
                      lastName: "W.",
                      displayName: "Alice W.",
                    },
                    email: { email: "alice@example.com", isEmailVerified: true },
                  },
                },
              }),
            headers: new Headers(),
          };
        }
        throw new Error(`Unexpected fetch ${key}`);
      };

      const profile = await patchAccountProfile(
        session,
        { displayName: "Alice W.", firstName: "Alice", lastName: "W." },
        { fetch: fetchMock }
      );
      assert.equal(profile.displayName, "Alice W.");
    }
  )
);