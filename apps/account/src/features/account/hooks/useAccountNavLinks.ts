"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import {
  ACCOUNT_NAV_GROUPS,
  ACCOUNT_NAV_LINKS,
  type AccountNavGroup,
  type AccountNavLink,
  type AccountNavRole,
} from "../config/account-nav";

export type AccountNavLinkView = AccountNavLink & {
  isActive: boolean;
};

export type AccountNavGroupView = {
  label: string;
  requiredRole?: AccountNavRole;
  items: AccountNavLinkView[];
};

function isPathActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // 前缀匹配，但避免 /account/profile 误匹配 /account/profile-other
  if (pathname.startsWith(href + "/")) return true;
  return false;
}

function toLinkView(link: AccountNavLink, pathname: string): AccountNavLinkView {
  return {
    disabled: false,
    external: false,
    ...link,
    isActive: isPathActive(pathname, link.href),
  };
}

function groupShouldRender(
  group: AccountNavGroup,
  options: { showAdmin?: boolean }
): boolean {
  if (group.requiredRole !== "admin") return true;
  return Boolean(options.showAdmin);
}

function linkShouldRender(
  link: AccountNavLink,
  options: { isAdmin?: boolean }
): boolean {
  if (link.hideForAdmin && options.isAdmin) return false;
  return true;
}

/**
 * 返回分组视图（用于 Sidebar）。
 * - showAdmin: 是否渲染管理后台组。P1 阶段暂未接入真实 role，默认 false。
 *   P2 接入 user.isAdmin 后由调用方传入。
 */
export function useAccountNavGroups(
  options: { showAdmin?: boolean; isAdmin?: boolean } = {}
): AccountNavGroupView[] {
  const pathname = usePathname();
  const showAdmin = options.showAdmin ?? false;
  const isAdmin = options.isAdmin ?? false;

  return useMemo(
    () =>
      ACCOUNT_NAV_GROUPS.filter((group) =>
        groupShouldRender(group, { showAdmin })
      ).map((group) => ({
        label: group.label,
        requiredRole: group.requiredRole,
        items: group.items
          .filter((link) => linkShouldRender(link, { isAdmin }))
          .map((link) => toLinkView(link, pathname)),
      })),
    [pathname, showAdmin, isAdmin]
  );
}

/**
 * 扁平链接视图（向后兼容 TopNav / CommandMenu）。
 * 也会根据 showAdmin 过滤管理组链接。
 */
export function useAccountNavLinks(
  options: { showAdmin?: boolean; isAdmin?: boolean } = {}
): AccountNavLinkView[] {
  const groups = useAccountNavGroups(options);
  return useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  );
}

export { ACCOUNT_NAV_LINKS };
