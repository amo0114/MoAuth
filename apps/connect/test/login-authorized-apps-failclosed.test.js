import assert from "node:assert/strict";
import test from "node:test";

import { AUTHORIZED_APPS_ERROR_CODES } from "@moauth/authorized-apps-store";

import { checkAuthorizedAppFromAccount } from "../src/authorized-apps/account-client.js";

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

test(
  "checkAuthorizedAppFromAccount throws when Account projection check fails",
  withEnv(
    {
      MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-secret",
    },
    async () => {
      await assert.rejects(
        () =>
          checkAuthorizedAppFromAccount(
            { sub: "user-1", clientId: "client-1", scopes: ["openid"] },
            {
              fetch: async () =>
                new Response(
                  JSON.stringify({
                    error: {
                      code: AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_UNAVAILABLE,
                      message: "Authorized apps projection is unavailable.",
                    },
                  }),
                  { status: 503, headers: { "Content-Type": "application/json" } }
                ),
            }
          ),
        (error) => {
          assert.equal(error.code, AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_UNAVAILABLE);
          return true;
        }
      );
    }
  )
);
