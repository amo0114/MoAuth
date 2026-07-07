import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresRegistrationStore } from "../src/index.js";

const databaseUrl = process.env.MOAUTH_REGISTRATION_STORE_TEST_DATABASE_URL;

function testOptions() {
  return {
    skip: databaseUrl ? false : "Set MOAUTH_REGISTRATION_STORE_TEST_DATABASE_URL to run Postgres registration-store tests.",
  };
}

function schemaName(name) {
  return `moauth_reg_${process.pid}_${Date.now()}_${name}`.toLowerCase();
}

async function withStore(name, fn) {
  const schema = schemaName(name);
  const store = createPostgresRegistrationStore({
    connectionString: databaseUrl,
    schemaName: schema,
    poolMax: 12,
  });
  try {
    await store._resetForTests();
    await fn(store);
  } finally {
    await store.pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await store.close();
  }
}

test("Postgres registration store preserves config and invite lifecycle", testOptions(), async () => {
  await withStore("lifecycle", async (store) => {
    assert.deepEqual(await store.getConfig(), { mode: "open", updatedAt: null, updatedBy: null });

    const updated = await store.setConfig({ mode: "invite", updatedBy: "admin-1" });
    assert.equal(updated.mode, "invite");
    assert.equal(updated.updatedBy, "admin-1");
    assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

    const invite = await store.createInviteCode({ maxUseCount: 2 });
    assert.equal(invite.usedCount, 0);
    assert.equal(invite.maxUseCount, 2);

    const first = await store.reserveInviteCode(invite.code);
    assert.equal((await store.getInviteCode(invite.code)).usedCount, 1);
    assert.equal(await store.releaseInviteCode(first.reservationId), true);
    assert.equal(await store.releaseInviteCode(first.reservationId), false);
    assert.equal((await store.getInviteCode(invite.code)).usedCount, 0);

    const second = await store.reserveInviteCode(invite.code);
    assert.equal(await store.consumeInviteCode(second.reservationId, { userId: "user-1", email: "u@example.com" }), true);
    assert.equal(await store.consumeInviteCode(second.reservationId, { userId: "user-1", email: "u@example.com" }), false);
    assert.equal((await store.getInviteCode(invite.code)).usedCount, 1);
  });
});
test("Postgres reserveInviteCode serializes concurrent maxUseCount=1 reservations", testOptions(), async () => {
  await withStore("concurrent", async (store) => {
    const invite = await store.createInviteCode({ maxUseCount: 1 });

    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () => store.reserveInviteCode(invite.code))
    );

    const fulfilled = attempts.filter((result) => result.status === "fulfilled");
    const rejected = attempts.filter((result) => result.status === "rejected");

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 9);
    assert.equal((await store.getInviteCode(invite.code)).usedCount, 1);
    assert.ok(rejected.every((result) => /邀请码已用完/.test(result.reason.message)));
  });
});
