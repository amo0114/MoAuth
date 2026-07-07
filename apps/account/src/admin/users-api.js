import { deactivateHumanUser, getHumanUser, listUsers, reactivateHumanUser } from "@moauth/zitadel-client";
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

export const USER_STATUS = {
  ACTIVE: "active",
  DISABLED: "disabled",
  PENDING: "pending",
};
