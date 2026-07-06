"use client";

import React from "react";
import Link from "next/link";

import type { AccountUser } from "../types";
import { AccountSidebar } from "./AccountSidebar";
import { CommandMenu } from "./CommandMenu";
import { ProfileDropdown } from "./ProfileDropdown";
import { ThemeToggle } from "../../../components/ui/theme-toggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../../../components/ui/sidebar";
import { Separator } from "../../../components/ui/separator";
import { BrandLogo } from "../../../components/brand/BrandLogo";
import { identityBrand } from "../../../config/brand.js";

interface AccountCenterShellProps {
  user: AccountUser;
  activePath?: string;
  showAdmin?: boolean;
  children: React.ReactNode;
}

/**
 * 账号中心外壳：SidebarProvider + Inset 布局（对齐 new-api AppSidebar + SiteHeader）。
 * - Cmd/Ctrl+B 切换折叠态，cookie 持久化用于 SSR 一致性
 * - Sidebar 在移动端通过 Sheet 抽屉展示
 * - 顶栏含 SidebarTrigger / 品牌名 / 右侧操作区
 * - showAdmin 可显式覆盖；默认基于 user.isAdmin 推导
 */
export function AccountCenterShell({
  user,
  showAdmin,
  children,
}: AccountCenterShellProps) {
  const showAdminResolved = showAdmin ?? Boolean(user?.isAdmin);

  return (
    <SidebarProvider defaultOpen>
      <AccountSidebar user={user} showAdmin={showAdminResolved} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-[#E7E1D7]/60 bg-white/90 px-4 backdrop-blur-xl transition-all duration-300 dark:border-white/[0.04] dark:bg-zinc-900/90 shadow-sm">
          <SidebarTrigger className="-ml-1 hover:bg-[#F2E3D6] transition-colors duration-300 rounded-lg" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-[#1F2421] dark:text-zinc-50 hover:text-[#C4612F] transition-colors duration-300 font-heading"
          >
            <BrandLogo size={24} />
            {identityBrand.accountName}
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <CommandMenu isAdmin={showAdminResolved} />
            <ThemeToggle />
            <Separator orientation="vertical" className="h-5" />
            <ProfileDropdown user={user} />
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-[#0a0a0a]">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
