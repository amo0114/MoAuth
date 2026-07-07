import { AUDIT_EVENT_TYPES } from "@moauth/audit-store";
import {
  deactivateHumanUser,
  getHumanUser,
  listUsers,
  reactivateHumanUser,
  requestPasswordReset,
  ZITADEL_ERROR_CODES,
} from "@moauth/zitadel-client";
import { getAccountAdminSubjects } from "../config/env.js";
import { recordAuditEvent } from "../audit/service.js";
import { getRegistrationReviewStore } from "../registration-review/store.js";

/**
 * 从 Zitadel 获取所有用户并转换为管理后台所需格式
 */
export async function listAllUsers() {
  const response = await listUsers({});
  const adminSubjects = new Set(getAccountAdminSubjects());

  if (!response.result || response.result.length === 0) {
    return [];
  }

  return response.result
    .filter((u) => u.human)
    .map((u) => {
      const userId = u.userId;
      const loginName = u.preferredLoginName || u.username;
      const email = u.human?.email?.email || null;
      const emailVerified = u.human?.email?.isVerified || false;
      const displayName = u.human?.profile?.displayName || loginName;

      let status = "active";
      if (u.state === "USER_STATE_INACTIVE") {
        status = "disabled";
      } else if (email && !emailVerified) {
        status = "pending";
      }

      return {
        id: userId,
        loginName,
        email,
        emailVerified,
        displayName,
        status,
        isAdmin: adminSubjects.has(userId),
        state: u.state,
        createdAt: u.details?.creationDate || null,
        updatedAt: u.details?.changeDate || null,
      };
    });
}

/**
 * 设置用户启用/禁用状态
 * 保护规则:
 * 1. 管理员不可禁用自己
 * 2. 有审核记录且非 approved 的用户不可通过此 API 启用 (必须走审核流程)
 * 3. 已处目标状态则拒绝
 */
export async function setUserStatus(userId, targetStatus, actor, options = {}) {
  const user = await getHumanUser(userId, options);
  if (!user) {
    throw Object.assign(new Error("用户不存在"), { code: "USER_NOT_FOUND", status: 404 });
  }

  // 管理员不可禁用自己
  if (targetStatus === "disabled" && userId === actor.sub) {
    throw Object.assign(new Error("不能禁用自己"), { code: "USER_STATUS_SELF_DISABLE", status: 400 });
  }

  // 已处目标状态 → 400
  const isCurrentlyInactive = user.state === "USER_STATE_INACTIVE";
  if (targetStatus === "disabled" && isCurrentlyInactive) {
    throw Object.assign(new Error("用户已处于禁用状态"), { code: "USER_STATUS_NOOP", status: 400 });
  }
  if (targetStatus === "active" && !isCurrentlyInactive) {
    throw Object.assign(new Error("用户已处于启用状态"), { code: "USER_STATUS_NOOP", status: 400 });
  }

  // 启用时必须检查: 有审核记录且非 approved 的用户不能绕过审核流程
  if (targetStatus === "active") {
    const reviewStore = getRegistrationReviewStore();
    const reviews = reviewStore.list({ userId });
    const unapprovedReviewExists = reviews.some((r) => r.reviewStatus !== "approved");
    if (unapprovedReviewExists) {
      throw Object.assign(
        new Error("该用户处于审核流程中，请通过审核队列操作"),
        { code: "USER_STATUS_REVIEW_BLOCKED", status: 403 }
      );
    }
  }

  if (targetStatus === "disabled") {
    await deactivateHumanUser(userId, options);
  } else {
    await reactivateHumanUser(userId, options);
  }

  recordAuditEvent({
    eventType: `admin_user_${targetStatus}`,
    sub: actor.sub,
    summary: `${targetStatus === "disabled" ? "禁用" : "启用"}用户 ${userId}`,
    metadata: { userId, targetStatus },
  });

  return { status: targetStatus };
}

/**
 * 请求 Zitadel 向用户发送密码重置邮件。
 *
 * 管理员不会接触临时密码或验证码；自我操作必须走用户侧忘记密码/修改密码流程。
 */
export async function requestUserPasswordReset(userId, actor, options = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw Object.assign(new Error("用户 ID 不能为空"), {
      code: "USER_PASSWORD_RESET_INVALID_USER",
      status: 400,
    });
  }

  if (normalizedUserId === actor?.sub) {
    throw Object.assign(new Error("不能通过管理员操作重置自己的密码"), {
      code: "USER_PASSWORD_RESET_SELF",
      status: 400,
    });
  }

  try {
    await requestPasswordReset(normalizedUserId, options);
  } catch (error) {
    throw mapPasswordResetUpstreamError(error);
  }

  recordAuditEvent({
    eventType: AUDIT_EVENT_TYPES.ADMIN_USER_PASSWORD_RESET_REQUESTED,
    sub: actor.sub,
    summary: `请求用户 ${normalizedUserId} 重置密码`,
    metadata: { userId: normalizedUserId, delivery: "email" },
  });

  return { status: "password_reset_requested", userId: normalizedUserId };
}

export function mapAdminUserError(error) {
  if (
    error?.code === "USER_NOT_FOUND" ||
    error?.code === "USER_PASSWORD_RESET_NOT_FOUND"
  ) {
    return { status: 404, body: { error: error.message, code: error.code } };
  }
  if (
    error?.code === "USER_STATUS_SELF_DISABLE" ||
    error?.code === "USER_STATUS_NOOP" ||
    error?.code === "USER_PASSWORD_RESET_INVALID_USER" ||
    error?.code === "USER_PASSWORD_RESET_SELF"
  ) {
    return { status: 400, body: { error: error.message, code: error.code } };
  }
  if (error?.code === "USER_STATUS_REVIEW_BLOCKED") {
    return { status: 403, body: { error: error.message, code: error.code } };
  }
  if (error?.code === "USER_PASSWORD_RESET_RATE_LIMITED") {
    return { status: 429, body: { error: error.message, code: error.code } };
  }
  if (error?.code === "USER_PASSWORD_RESET_UNAVAILABLE") {
    return { status: error.status || 502, body: { error: error.message, code: error.code } };
  }
  return {
    status: error?.status || 500,
    body: { error: error?.message || "操作失败", code: error?.code || "ADMIN_USER_OPERATION_FAILED" },
  };
}

export const USER_STATUS = {
  ACTIVE: "active",
  DISABLED: "disabled",
  PENDING: "pending",
};

function mapPasswordResetUpstreamError(error) {
  const upstreamStatus = error?.details?.status || error?.status;
  if (error?.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND || upstreamStatus === 404) {
    return Object.assign(new Error("用户不存在"), {
      code: "USER_PASSWORD_RESET_NOT_FOUND",
      status: 404,
      cause: error,
    });
  }
  if (error?.code === ZITADEL_ERROR_CODES.ZITADEL_RATE_LIMITED || upstreamStatus === 429) {
    return Object.assign(new Error("密码重置请求过于频繁，请稍后重试"), {
      code: "USER_PASSWORD_RESET_RATE_LIMITED",
      status: 429,
      cause: error,
    });
  }
  return Object.assign(new Error("密码重置服务暂时不可用，请稍后重试"), {
    code: "USER_PASSWORD_RESET_UNAVAILABLE",
    status: 502,
    cause: error,
  });
}
