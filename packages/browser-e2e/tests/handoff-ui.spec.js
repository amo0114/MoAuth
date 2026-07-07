import { test, expect } from "@playwright/test";

import { serviceUrls } from "../helpers/services.js";

const { connectUrl, accountUrl } = serviceUrls();
const AUTH_REQUEST_ID = "V2_playwright-handoff";

test.describe("Handoff UI (live Connect + Account)", () => {
  test("Connect redirects to Account login when authRequest is present (no password form on Connect)", async ({
    page,
  }) => {
    await page.goto(`${connectUrl}/login?authRequest=${AUTH_REQUEST_ID}`, { waitUntil: "networkidle" });

    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(accountUrl)}/login`));
    await expect(page).toHaveURL(/auth_request=V2_playwright-handoff/);

    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.locator("#login-name")).toBeVisible();
    await expect(page.getByRole("button", { name: /登录并继续|Sign in and continue/i })).toBeVisible();
  });

  test("Account login page collects password locally", async ({ page }) => {
    await page.goto(`${accountUrl}/login?auth_request=${AUTH_REQUEST_ID}`);

    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.locator("#login-name")).toBeVisible();
    await expect(page.getByRole("button", { name: /登录并继续|Continue at/i })).toBeVisible();
    await expect(page.getByText(/登录后将继续前往 Connect|signing in through/i)).toBeVisible();
  });

  test("Connect bare login page does not expose password inputs when fallback is off", async ({ page }) => {
    await page.goto(`${connectUrl}/login`);

    await expect(page.locator("#login-password")).toHaveCount(0);
    await expect(page.locator("#login-name")).toHaveCount(0);
    await expect(page.getByText(/缺少|missing authRequest|Missing authRequest/i)).toBeVisible();
  });
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
