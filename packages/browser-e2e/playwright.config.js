import { defineConfig, devices } from "@playwright/test";

const connectUrl = process.env.MOAUTH_CONNECT_PUBLIC_URL || "http://127.0.0.1:3000";
const accountUrl = process.env.MOAUTH_ACCOUNT_PUBLIC_URL || "http://127.0.0.1:3002";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.js",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  metadata: {
    connectUrl,
    accountUrl,
  },
});