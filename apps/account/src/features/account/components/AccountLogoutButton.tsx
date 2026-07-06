"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { SidebarMenuButton } from "../../../components/ui/sidebar";

export function AccountLogoutButton({ className }: { className?: string }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      window.location.assign("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <SidebarMenuButton
      onClick={handleLogout}
      disabled={loggingOut}
      className={className || "hover:text-[#b42335] dark:hover:text-[#ef4444]"}
      tooltip="退出登录"
    >
      <LogOut />
      <span>{loggingOut ? "退出中…" : "退出登录"}</span>
    </SidebarMenuButton>
  );
}
