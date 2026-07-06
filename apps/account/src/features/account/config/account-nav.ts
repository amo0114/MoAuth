import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AppWindow,
  LayoutGrid,
  MonitorSmartphone,
  Rocket,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";

export type AccountNavLink = {
  title: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  external?: boolean;
  /** 平台管理员走 Console（/admin/*），不展示开发者自助入口 */
  hideForAdmin?: boolean;
};

export type AccountNavRole = "user" | "admin";

export type AccountNavGroup = {
  label: string;
  requiredRole?: AccountNavRole;
  items: AccountNavLink[];
};

/**
 * 分组导航配置（对齐 new-api sidebar-group 结构）。
 * - "个人中心" 组：普通用户可见的账号管理链接
 * - "管理后台" 组：超级管理员可见的用户/系统设置链接
 *   P1 阶段先以结构占位形式存在，权限 gating 在 P2 通过 user.isAdmin 接入。
 */
export const ACCOUNT_NAV_GROUPS: AccountNavGroup[] = [
  {
    label: "个人中心",
    requiredRole: "user",
    items: [
      { title: "总览", href: "/account/overview", icon: LayoutGrid },
      { title: "资料", href: "/account/profile", icon: User },
      { title: "安全", href: "/account/security", icon: Shield },
      { title: "会话", href: "/account/sessions", icon: MonitorSmartphone },
      { title: "授权应用", href: "/account/applications", icon: AppWindow },
      { title: "申请接入", href: "/account/developer", icon: Rocket, hideForAdmin: true },
      { title: "活动", href: "/account/activity", icon: Activity },
    ],
  },
  {
    label: "管理后台",
    requiredRole: "admin",
    items: [
      { title: "用户管理", href: "/admin/users", icon: Users },
      { title: "应用管理", href: "/admin/applications", icon: AppWindow },
      { title: "系统设置", href: "/admin/settings", icon: Settings },
    ],
  },
];

/** 扁平链接列表（向后兼容 CommandMenu / TopNav）。 */
export const ACCOUNT_NAV_LINKS: AccountNavLink[] = ACCOUNT_NAV_GROUPS.flatMap(
  (group) => group.items
);
