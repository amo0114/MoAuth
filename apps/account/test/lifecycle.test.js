import assert from "node:assert/strict";
import test from "node:test";
import { OidcContractError } from "@moauth/connect-contract";
import { ZITADEL_ERROR_CODES } from "@moauth/zitadel-client";

import { humanizeZitadelLifecycleError } from "../src/api/lifecycle-error-message.js";
import { resetAccountSessionStoreForTests } from "../src/session/account-session-store.js";
import { createAccountSession } from "../src/session/account-session.js";
import {
  changeAccountPassword,
  confirmEmailVerification,
  registerAccountUser,
  requestAccountPasswordReset,
  resetAccountPassword,
} from "../src/lifecycle/service.ts";
import {
  createInviteCode,
  getInviteCode,
  resetRegistrationConfigForTests,
  setRegistrationConfig,
} from "../src/registration/config-store.js";
import {
  getRegistrationReviewStore,
  resetRegistrationReviewStoreForTests,
} from "../src/registration-review/store.js";
import {
  getAccountPublicErrorMessage,
  getRegistrationModeNotice,
} from "../src/ui/account-public-error-message.js";

const origEnv = { ...process.env };

function withEnv(partial, fn) {
  return async () => {
    process.env = { ...origEnv, ...partial, NODE_ENV: "test", MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002" };
    resetAccountSessionStoreForTests();
    resetRegistrationConfigForTests();
    resetRegistrationReviewStoreForTests();
    try {
      return await fn();
    } finally {
      process.env = { ...origEnv };
      resetAccountSessionStoreForTests();
      resetRegistrationConfigForTests();
      resetRegistrationReviewStoreForTests();
    }
  };
}

const zitadelEnv = {
  ZITADEL_ISSUER: "https://zitadel.example.com",
  ZITADEL_SERVICE_USER_TOKEN: "pat-test",
  ZITADEL_ORG_ID: "org-1",
};

test(
  "registerAccountUser returns verify redirect and dev code",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/v2/users/human") {
        return ok({ userId: "user-new", emailCode: "MAIL99" });
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await registerAccountUser(
      { email: "new@example.com", password: "Password1!", displayName: "New User" },
      { fetch: fetchMock }
    );

    assert.equal(result.status, "REGISTERED");
    assert.match(result.redirectUrl, /\/verify-email\?/);
    assert.equal(result.dev.emailVerificationCode, "MAIL99");
  })
);

test(
  "registerAccountUser blocks closed registration before validation and Zitadel calls",
  withEnv(zitadelEnv, async () => {
    setRegistrationConfig({ mode: "closed" }, { sub: "admin" });
    const fetchMock = async () => {
      throw new Error("Zitadel should not be called for closed registration");
    };

    await assert.rejects(
      registerAccountUser({ email: "", password: "" }, { fetch: fetchMock }),
      (error) =>
        error.code === "REGISTRATION_CLOSED" &&
        error.status === 403 &&
        error.message === "注册已关闭，请联系管理员。"
    );
  })
);

test("humanizeZitadelLifecycleError hides internal Zitadel registration failures", () => {
  const message = humanizeZitadelLifecycleError(
    new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED,
      "Zitadel rejected the registration request.",
      { status: 503 }
    )
  );

  assert.equal(message, "身份服务暂时不可用，请稍后重试。");
  assert.equal(
    humanizeZitadelLifecycleError(
      new OidcContractError(
        ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
        "Missing required Zitadel configuration: ZITADEL_SERVICE_USER_TOKEN.",
        {}
      )
    ),
    "服务暂时不可用，请稍后重试。"
  );
});

test("public account error messages do not expose backend internals", () => {
  assert.equal(
    getAccountPublicErrorMessage(ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED, "registration"),
    "注册服务暂时不可用，请稍后重试。"
  );
  assert.equal(
    getAccountPublicErrorMessage("REGISTRATION_CLOSED", "registration"),
    "管理员已关闭注册，暂不接受新账号。"
  );
  assert.equal(
    getAccountPublicErrorMessage(ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID, "verifyEmail"),
    "验证码无效或已过期，请检查后重试。"
  );
  assert.equal(
    getAccountPublicErrorMessage("UNKNOWN_INTERNAL_DEBUG_CODE", "login"),
    "登录服务暂时不可用，请稍后重试。"
  );
});

test("registration mode notices explain policy before submission", () => {
  assert.deepEqual(getRegistrationModeNotice("closed"), {
    tone: "danger",
    message: "管理员已关闭注册，暂不接受新账号。",
  });
  assert.deepEqual(getRegistrationModeNotice("invite"), {
    tone: "info",
    message: "当前仅支持邀请注册，请准备有效邀请码。",
  });
  assert.deepEqual(getRegistrationModeNotice("review"), {
    tone: "info",
    message: "当前注册需要管理员审核，审核通过后即可登录。",
  });
  assert.equal(getRegistrationModeNotice("open"), null);
});

test(
  "registerAccountUser review mode deactivates and creates pending review",
  withEnv(zitadelEnv, async () => {
    setRegistrationConfig({ mode: "review" }, { sub: "admin" });
    const calls = [];
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      calls.push(key);
      if (key === "POST https://zitadel.example.com/v2/users/human") {
        return ok({ userId: "review-user", emailCode: "MAIL99" });
      }
      if (key === "PUT https://zitadel.example.com/v2/users/review-user/deactivate") {
        return ok({});
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await registerAccountUser(
      { email: "review@example.com", password: "Password1!", displayName: "Review User" },
      { fetch: fetchMock }
    );

    assert.equal(result.status, "PENDING_REVIEW");
    assert.deepEqual(calls, [
      "POST https://zitadel.example.com/v2/users/human",
      "PUT https://zitadel.example.com/v2/users/review-user/deactivate",
    ]);
    const reviews = getRegistrationReviewStore().list({ userId: "review-user" });
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].reviewStatus, "pending");
  })
);

test(
  "registerAccountUser review mode compensates by deleting when deactivate fails",
  withEnv(zitadelEnv, async () => {
    setRegistrationConfig({ mode: "review" }, { sub: "admin" });
    const calls = [];
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      calls.push(key);
      if (key === "POST https://zitadel.example.com/v2/users/human") {
        return ok({ userId: "review-fail", emailCode: "MAIL99" });
      }
      if (key === "PUT https://zitadel.example.com/v2/users/review-fail/deactivate") {
        return ok({ error: "down" }, 503);
      }
      if (key === "DELETE https://zitadel.example.com/v2/users/review-fail") {
        return ok({});
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    await assert.rejects(
      registerAccountUser(
        { email: "review-fail@example.com", password: "Password1!", displayName: "Review Fail" },
        { fetch: fetchMock }
      ),
      (error) => error.code === "REGISTRATION_REVIEW_FAILED" && error.status === 503
    );
    assert.deepEqual(calls, [
      "POST https://zitadel.example.com/v2/users/human",
      "PUT https://zitadel.example.com/v2/users/review-fail/deactivate",
      "DELETE https://zitadel.example.com/v2/users/review-fail",
    ]);
    assert.equal(getRegistrationReviewStore().list({ userId: "review-fail" }).length, 0);
  })
);

test(
  "registerAccountUser invite mode consumes reservation on success",
  withEnv(zitadelEnv, async () => {
    setRegistrationConfig({ mode: "invite" }, { sub: "admin" });
    const invite = createInviteCode({ maxUseCount: 1 });
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/v2/users/human") {
        return ok({ userId: "invite-user", emailCode: "MAIL99" });
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await registerAccountUser(
      { email: "invite@example.com", password: "Password1!", displayName: "Invite User", inviteCode: invite.code },
      { fetch: fetchMock }
    );

    assert.equal(result.status, "REGISTERED");
    assert.equal(getInviteCode(invite.code).usedCount, 1);
    await assert.rejects(
      registerAccountUser(
        { email: "invite2@example.com", password: "Password1!", displayName: "Invite User 2", inviteCode: invite.code },
        { fetch: fetchMock }
      ),
      (error) => error.code === "INVITE_CODE_INVALID" && error.status === 403
    );
  })
);

test(
  "registerAccountUser invite mode releases reservation when Zitadel registration fails",
  withEnv(zitadelEnv, async () => {
    setRegistrationConfig({ mode: "invite" }, { sub: "admin" });
    const invite = createInviteCode({ maxUseCount: 1 });
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/v2/users/human") {
        return ok({ error: "down" }, 503);
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    await assert.rejects(
      registerAccountUser(
        { email: "invite-fail@example.com", password: "Password1!", displayName: "Invite Fail", inviteCode: invite.code },
        { fetch: fetchMock }
      ),
      /Zitadel rejected the registration request/
    );
    assert.equal(getInviteCode(invite.code).usedCount, 0);
  })
);

test(
  "requestAccountPasswordReset does not leak missing email",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/management/v1/users/_search") {
        return ok({ result: [] });
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await requestAccountPasswordReset({ email: "missing@example.com" }, { fetch: fetchMock });
    assert.equal(result.status, "PASSWORD_RESET_REQUESTED");
    assert.equal(result.dev, undefined);
  })
);

test(
  "resetAccountPassword completes when user and code are valid",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/management/v1/users/_search") {
        return ok({
          result: [
            {
              id: "user-1",
              preferredLoginName: "alice",
              human: { email: { email: "alice@example.com", isEmailVerified: true } },
            },
          ],
        });
      }
      if (key === "POST https://zitadel.example.com/v2/users/user-1/password") {
        return ok({});
      }
      throw new Error(`Unexpected fetch ${key}`);
    };

    const result = await resetAccountPassword(
      { email: "alice@example.com", verificationCode: "CODE1", newPassword: "NewPass2026!" },
      { fetch: fetchMock }
    );
    assert.equal(result.status, "PASSWORD_RESET_COMPLETED");
  })
);

test(
  "confirmEmailVerification and changeAccountPassword call Zitadel",
  withEnv(zitadelEnv, async () => {
    const fetchMock = async (url, init) => {
      const key = `${init?.method || "GET"} ${String(url)}`;
      if (key === "POST https://zitadel.example.com/v2/users/user-1/email/verify") return ok({});
      if (key === "POST https://zitadel.example.com/v2/users/user-1/password") return ok({});
      throw new Error(`Unexpected fetch ${key}`);
    };

    const verified = await confirmEmailVerification(
      { userId: "user-1", verificationCode: "MAIL1" },
      { fetch: fetchMock }
    );
    assert.equal(verified.status, "EMAIL_VERIFIED");

    const session = createAccountSession({
      session: { sessionId: "sess-1", sessionToken: "tok-1" },
      sub: "user-1",
      loginName: "alice",
      now: new Date("2026-06-30T12:00:00.000Z"),
    });
    const changed = await changeAccountPassword(
      session,
      { currentPassword: "old", newPassword: "newPass2026!" },
      { fetch: fetchMock }
    );
    assert.equal(changed.status, "PASSWORD_CHANGED");
  })
);

function ok(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  };
}
