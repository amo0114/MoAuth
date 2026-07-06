"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "../../../components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { useAccountNavGroups } from "../hooks/useAccountNavLinks";
import { BrandLogo } from "../../../components/brand/BrandLogo";
import { identityBrand } from "../../../config/brand.js";
import type { AccountUser } from "../types";
import { AccountLogoutButton } from "./AccountLogoutButton";

type AccountSidebarProps = {
  user?: AccountUser;
  showAdmin?: boolean;
};

/**
 * 基于 shadcn Sidebar 的分组导航（对齐 new-api sidebar-group）。
 * - 支持折叠态（icon-only）+ tooltip
 * - 支持分组（个人中心 / 管理后台）
 * - 管理后台组通过 showAdmin 控制可见性
 */
export function AccountSidebar({ user, showAdmin = false }: AccountSidebarProps) {
  const groups = useAccountNavGroups({ showAdmin, isAdmin: Boolean(user?.isAdmin) });
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-[#E7E1D7] bg-[#FBF9F5] dark:border-white/[0.04] dark:bg-zinc-900">
      <SidebarHeader className="h-16 flex-row items-center justify-between px-4 group-data-[collapsible=icon]:justify-center">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-sm font-semibold text-[#1F2421] dark:text-zinc-50 font-heading transition-colors duration-300 hover:text-[#C4612F] group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:justify-center"
        >
          <BrandLogo
            size={30}
            className="shrink-0 group-data-[collapsible=icon]:!size-7"
          />
          <span className="text-base group-data-[collapsible=icon]:hidden">{identityBrand.accountName}</span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator className="bg-[#E7E1D7]" />

      <SidebarContent>
        {groups.map((group, groupIndex) => (
          <SidebarGroup key={group.label} className="animate-fade-in-up" style={{ animationDelay: `${groupIndex * 80}ms` }}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((link) => {
                  const Icon = link.icon;
                  const button = (
                    <SidebarMenuButton
                      asChild
                      isActive={link.isActive}
                      tooltip={link.title}
                    >
                      <Link href={link.href}>
                        <Icon />
                        <span>{link.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  );
                  return <SidebarMenuItem key={link.href}>{button}</SidebarMenuItem>;
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator className="bg-[#E7E1D7]" />
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountLogoutButton />
          </SidebarMenuItem>
        </SidebarMenu>
        {user ? (
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#5C635D] dark:text-zinc-400 group-data-[collapsible=icon]:justify-center">
            <span className="truncate group-data-[collapsible=icon]:hidden">{user.loginName}</span>
            <span className="hidden group-data-[collapsible=icon]:block w-6 h-6 rounded-full bg-gradient-to-br from-[#C4612F] to-[#A94E22] text-white flex items-center justify-center text-[10px] font-semibold">
              {user.loginName?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
