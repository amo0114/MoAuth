import { OidcContractError } from "@moauth/connect-contract";
import {
  ZITADEL_ERROR_CODES,
  changeUserPassword,
  deactivateHumanUser,
  deleteHumanUser,
  isZitadelConfigured,
  registerHumanUser,
  requestPasswordReset,
  resendEmailVerificationCode,
  searchHumanUserByEmail,
  setPasswordWithVerificationCode,
  verifyUserEmail,
} from "@moauth/zitadel-client";

import { getAccountPublicUrl } from "../config/env.js";
import { buildAuthContextPath, shouldReturnVerificationCodes } from "../config/runtime.js";
import { getRegistrationConfig, reserveInviteCode, consumeInviteCode, releaseInviteCode } from "../registration/config-store.js";
import { getRegistrationReviewStore } from "../registration-review/store.js";
import { recordAuditEvent } from "../audit/service.js";


export async function registerAccountUser(input, options = {}) {
  assertZitadelReady();

  const config = getRegistrationConfig();
  if (config.mode === "closed") {
    throw lifecycleError("REGISTRATION_CLOSED", "注册已关闭，请联系管理员。", 403);
  }

  validateRegistrationInput(input);

  if (config.mode === "invite") {
    return await registerWithInvite(input, options);
  }

  if (config.mode === "review") {
    return await registerForReview(input, options);
  }

  const result = await registerHumanUser(
    {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
    },
    {
      ...options,
      returnVerificationCode: shouldReturnVerificationCodes(),
    }
  );

  const verifyPath = buildAuthContextPath("/verify-email", input.authRequestId);
  const redirectUrl = `${getAccountPublicUrl()}${verifyPath}${verifyPath.includes("?") ? "&" : "?"}user_id=${encodeURIComponent(result.userId)}`;

  return {
    status: "REGISTERED",
    userId: result.userId,
    loginName: result.loginName,
    email: result.email,
    redirectUrl,
    dev: devPayload({
      emailVerificationCode: result.emailCode,
    }),
  };
}

async function registerForReview(input, options) {
  const result = await registerHumanUser(
    {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
    },
    {
      ...options,
      returnVerificationCode: shouldReturnVerificationCodes(),
    }
  );

  const { userId, loginName, email } = result;

  try {
    await deactivateHumanUser(userId, options);
  } catch (error) {
    try {
      await deleteHumanUser(userId, options);
    } catch (deleteError) {
      recordAuditEvent({
        eventType: "registration_review_compensation_failed",
        sub: null,
        summary: `审核模式补偿失败(1): deactivate+delete 均失败, userId=${userId}`,
        metadata: { userId, deactivateError: error.message, deleteError: deleteError.message },
      });
    }
    throw lifecycleError("REGISTRATION_REVIEW_FAILED", "注册处理失败，请稍后重试。", 503);
  }

  try {
    getRegistrationReviewStore().create({ userId, loginName, email, displayName: input.displayName || loginName });
  } catch (error) {
    try {
      await deleteHumanUser(userId, options);
    } catch (deleteError) {
      recordAuditEvent({
        eventType: "registration_review_compensation_failed",
        sub: null,
        summary: `审核模式补偿失败(2): store 写入失败+delete 失败, userId=${userId}`,
        metadata: { userId, storeError: error.message, deleteError: deleteError.message },
      });
    }
    throw lifecycleError("REGISTRATION_REVIEW_FAILED", "注册处理失败，请稍后重试。", 503);
  }

  return {
    status: "PENDING_REVIEW",
    message: "注册成功，等待管理员审核。",
    userId,
    loginName,
    email,
  };
}

async function registerWithInvite(input, options) {
  if (!input.inviteCode) {
    throw lifecycleError("INVITE_CODE_REQUIRED", "需要邀请码才能注册。", 403);
  }

  let reservation;
  try {
    reservation = reserveInviteCode(input.inviteCode);
  } catch (error) {
    throw lifecycleError("INVITE_CODE_INVALID", error.message, 403);
  }

  let result;
  try {
    result = await registerHumanUser(
      {
        email: input.email,
        password: input.password,
        displayName: input.displayName,
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
      },
      {
        ...options,
        returnVerificationCode: shouldReturnVerificationCodes(),
      }
    );
  } catch (error) {
    releaseInviteCode(reservation.reservationId);
    throw error;
  }

  consumeInviteCode(reservation.reservationId, {
    userId: result.userId,
    email: result.email,
  });

  const verifyPath = buildAuthContextPath("/verify-email", input.authRequestId);
  const redirectUrl = `${getAccountPublicUrl()}${verifyPath}${verifyPath.includes("?") ? "&" : "?"}user_id=${encodeURIComponent(result.userId)}`;

  return {
    status: "REGISTERED",
    userId: result.userId,
    loginName: result.loginName,
    email: result.email,
    redirectUrl,
    dev: devPayload({
      emailVerificationCode: result.emailCode,
    }),
  };
}

export async function confirmEmailVerification({ userId, verificationCode }, options = {}) {
  assertZitadelReady();
  if (!userId || !verificationCode) {
    throw lifecycleError("EMAIL_VERIFY_BAD_REQUEST", "User id and verification code are required.", 400);
  }

  await verifyUserEmail(userId, verificationCode, options);
  return {
    status: "EMAIL_VERIFIED",
    userId,
  };
}

export async function sendEmailVerification({ userId }, options = {}) {
  assertZitadelReady();
  if (!userId) {
    throw lifecycleError("EMAIL_VERIFY_BAD_REQUEST", "User id is required.", 400);
  }

  const result = await resendEmailVerificationCode(userId, {
    ...options,
    returnVerificationCode: shouldReturnVerificationCodes(),
  });

  return {
    status: "EMAIL_VERIFICATION_SENT",
    userId,
    dev: devPayload({ emailVerificationCode: result.emailCode }),
  };
}

export async function requestAccountPasswordReset({ email }, options = {}) {
  assertZitadelReady();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw lifecycleError("PASSWORD_FORGOT_BAD_REQUEST", "Email is required.", 400);
  }

  const user = await searchHumanUserByEmail(normalizedEmail, options);
  if (user?.id) {
    const reset = await requestPasswordReset(user.id, {
      ...options,
      returnVerificationCode: shouldReturnVerificationCodes(),
    });
    return {
      status: "PASSWORD_RESET_REQUESTED",
      message: "如果该邮箱已注册，我们已发送密码重置说明。",
      dev: devPayload({
        userId: user.id,
        verificationCode: reset.verificationCode,
      }),
    };
  }

  return {
    status: "PASSWORD_RESET_REQUESTED",
    message: "如果该邮箱已注册，我们已发送密码重置说明。",
  };
}

export async function resetAccountPassword({ email, verificationCode, newPassword }, options = {}) {
  assertZitadelReady();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !verificationCode || !newPassword) {
    throw lifecycleError(
      "PASSWORD_RESET_BAD_REQUEST",
      "Email, verification code, and new password are required.",
      400
    );
  }

  const user = await searchHumanUserByEmail(normalizedEmail, options);
  if (!user?.id) {
    throw lifecycleError("PASSWORD_RESET_BAD_REQUEST", "Invalid reset request.", 400);
  }

  await setPasswordWithVerificationCode(user.id, verificationCode, newPassword, options);
  return {
    status: "PASSWORD_RESET_COMPLETED",
    sub: user.id,
    loginName: user.loginName,
    email: user.email,
  };
}

export async function changeAccountPassword(session, { currentPassword, newPassword }, options = {}) {
  assertZitadelReady();
  if (!currentPassword || !newPassword) {
    throw lifecycleError("PASSWORD_CHANGE_BAD_REQUEST", "Current and new passwords are required.", 400);
  }

  try {
    await changeUserPassword(session.sub, currentPassword, newPassword, options);
  } catch (error) {
    if (error instanceof OidcContractError && error.code === ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID) {
      throw lifecycleError("PASSWORD_CHANGE_INVALID", "Current password is incorrect.", 401);
    }
    throw error;
  }

  return { status: "PASSWORD_CHANGED" };
}

function validateRegistrationInput(input) {
  const email = String(input?.email || "").trim();
  const password = String(input?.password || "");
  if (!email || !password) {
    throw lifecycleError("REGISTER_BAD_REQUEST", "Email and password are required.", 400);
  }
  if (password.length < 8) {
    throw lifecycleError("REGISTER_BAD_REQUEST", "Password must be at least 8 characters.", 422);
  }
}

function assertZitadelReady() {
  if (!isZitadelConfigured()) {
    throw lifecycleError("ZITADEL_NOT_CONFIGURED", "Identity core is not configured.", 503);
  }
}

function devPayload(values) {
  if (!shouldReturnVerificationCodes()) return undefined;
  const dev = Object.fromEntries(Object.entries(values).filter(([, value]) => value));
  return Object.keys(dev).length ? dev : undefined;
}

function lifecycleError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}