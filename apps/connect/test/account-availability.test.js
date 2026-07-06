import assert from "node:assert/strict";
import test from "node:test";

import {
  isAccountCenterAvailable,
  resetAccountHealthCache,
} from "../src/account/account-availability.js";

const origEnv = { ...process.env };

test.afterEach(() => {
  process.env = origEnv;
  resetAccountHealthCache();
});

test("isAccountCenterAvailable returns true when Account ready endpoint reports ok", async () => {
  process.env.MOAUTH_ACCOUNT_INTERNAL_URL = "http://account:3002";
  const available = await isAccountCenterAvailable({
    fetch: async (url) => {
      assert.equal(url, "http://account:3002/api/health/ready");
      return Response.json({ ok: true, service: "account" });
    },
  });
  assert.equal(available, true);
});

test("isAccountCenterAvailable returns false on connection failure", async () => {
  process.env.MOAUTH_ACCOUNT_INTERNAL_URL = "http://127.0.0.1:3002";
  const available = await isAccountCenterAvailable({
    fetch: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  assert.equal(available, false);
});

test("isAccountCenterAvailable returns false when ready endpoint reports not ok", async () => {
  process.env.MOAUTH_ACCOUNT_INTERNAL_URL = "http://127.0.0.1:3002";
  const available = await isAccountCenterAvailable({
    fetch: async () => Response.json({ ok: false, service: "account" }, { status: 503 }),
  });
  assert.equal(available, false);
});

test("isAccountCenterAvailable returns false when ready body is missing ok", async () => {
  process.env.MOAUTH_ACCOUNT_INTERNAL_URL = "http://127.0.0.1:3002";
  const available = await isAccountCenterAvailable({
    fetch: async () => Response.json({ service: "account" }),
  });
  assert.equal(available, false);
});

test("isAccountCenterAvailable caches negative results until bypassed", async () => {
  process.env.MOAUTH_ACCOUNT_INTERNAL_URL = "http://127.0.0.1:3002";
  process.env.MOAUTH_ACCOUNT_HEALTH_NEGATIVE_CACHE_MS = "60000";
  let calls = 0;

  const fetch = async () => {
    calls += 1;
    throw new Error("ECONNREFUSED");
  };

  assert.equal(await isAccountCenterAvailable({ fetch }), false);
  assert.equal(await isAccountCenterAvailable({ fetch }), false);
  assert.equal(calls, 1);

  assert.equal(await isAccountCenterAvailable({ fetch, bypassCache: true }), false);
  assert.equal(calls, 2);
});

test("isAccountCenterAvailable falls back to public URL when internal URL is unset", async () => {
  delete process.env.MOAUTH_ACCOUNT_INTERNAL_URL;
  process.env.MOAUTH_ACCOUNT_PUBLIC_URL = "http://127.0.0.1:3002";

  const available = await isAccountCenterAvailable({
    fetch: async (url) => {
      assert.equal(url, "http://127.0.0.1:3002/api/health/ready");
      return Response.json({ ok: true, service: "account" });
    },
  });
  assert.equal(available, true);
});