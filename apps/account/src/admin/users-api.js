import { listUsers } from "@moauth/zitadel-client";
import { getAccountAdminSubjects } from "../config/env.js";

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
    .filter((u) => u.human) // 只显示人类用户，过滤机器账户
    .map((u) => {
      const userId = u.userId;
      const loginName = u.preferredLoginName || u.username;
      const email = u.human?.email?.email || null;
      const emailVerified = u.human?.email?.isVerified || false;
      const displayName = u.human?.profile?.displayName || loginName;

      // 根据 Zitadel 状态映射到管理后台状态
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
 * 用户状态类型定义
 */
export const USER_STATUS = {
  ACTIVE: "active",
  DISABLED: "disabled",
  PENDING: "pending",
};
