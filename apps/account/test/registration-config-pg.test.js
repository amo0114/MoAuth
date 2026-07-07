import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresRegistrationStore } from "@moauth/registration-store-pg";

import {
  createInviteCode,
  getInviteCode,
  getRegistrationConfig,
  reserveInviteCode,
  resetRegistrationConfigForTests,
  setRegistrationConfig,
} from "../src/registration/config-store.js";

const databaseUrl = process.env.MOAUTH_REGISTRATION_STORE_TEST_DATABASE_URL;
const origEnv = { ...process.env };

function testOptions() {
  return {
    skip: databaseUrl ? false : "Set MOAUTH_REGISTRATION_STORE_TEST_DATABASE_URL to run Account pg registration-store tests.",
  };
}

function schemaName() {
  return `moauth_account_reg_${process.pid}_${Date.now()}`.toLowerCase();
}

async function withPgRegistrationBackend(fn) {
  const schema = schemaName();
  process.env = {
    ...origEnv,
    NODE_ENV: "test",
    MOAUTH_REGISTRATION_STORE_BACKEND: "pg",
    MOAUTH_REGISTRATION_STORE_DATABASE_URL: databaseUrl,
    MOAUTH_REGISTRATION_STORE_SCHEMA: schema,
  };
  try {
    await resetRegistrationConfigForTests();
    await fn();
  } finally {
    const cleanup = createPostgresRegistrationStore({
      connectionString: databaseUrl,
      schemaName: schema,
      autoMigrate: false,
    });
    await cleanup.pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await cleanup.close();
    process.env = { ...origEnv };
  }
}

test("Account registration config store can use pg backend", testOptions(), async () => {
  await withPgRegistrationBackend(async () => {
    assert.equal((await getRegistrationConfig()).mode, "open");
    assert.equal((await setRegistrationConfig({ mode: "invite" }, { sub: "admin" })).mode, "invite");

    const invite = await createInviteCode({ maxUseCount: 1 });
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () => reserveInviteCode(invite.code))
    );

    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((result) => result.status === "rejected").length, 9);
    assert.equal((await getInviteCode(invite.code)).usedCount, 1);
  });
});
