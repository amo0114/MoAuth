import { test, expect } from "@playwright/test";

import { serviceUrls } from "../helpers/services.js";

const { connectUrl, accountUrl } = serviceUrls();

test.describe("Handoff API boundaries (live Account)", () => {
  test("Account handoff consume rejects missing internal token", async ({ request }) => {
    const response = await request.post(`${accountUrl}/api/handoff/consume`, {
      data: { code: "fake-code", authRequestId: "V2_test" },
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error?.code).toBe("HANDOFF_UNAUTHORIZED");
  });

  test("Connect consent API requires active SSO cookie", async ({ request }) => {
    const response = await request.post(`${connectUrl}/api/consent`, {
      data: { authRequest: "V2_test", action: "allow" },
      headers: { "Content-Type": "application/json" },
    });
    expect([401, 404, 503]).toContain(response.status());
  });
});