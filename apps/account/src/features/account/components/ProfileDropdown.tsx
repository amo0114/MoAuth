"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, Loader2 } from "lucide-react";

import { identityBrand } from "../../../config/brand.js";
import type { AccountUser } from "../types";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

export function ProfileDropdown({ user }: { user: AccountUser }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = user.loginName || "用户";
  const avatarFallback = displayName.substring(0, 1).toUpperCase();

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
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="relative flex items-center justify-center outline-none transition-transform hover:scale-105 active:scale-95 ease-[cubic-bezier(0.25,1,0.5,1)] duration-300 rounded-full focus:ring-[4px] focus:ring-[#007AFF]/20">
        <Avatar className="h-[34px] w-[34px] border-transparent shadow-none">
          <AvatarFallback className="bg-black/5 dark:bg-white/10 text-[#1D1D1F] dark:text-white transition-colors">
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60 p-1.5">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-white/40 border border-white/50 text-[#1D1D1F] text-lg backdrop-blur-md shadow-sm">
              {avatarFallback}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
            <p className="truncate text-[15px] font-semibold text-[#1D1D1F] drop-shadow-sm">
              {displayName}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-medium leading-none text-[#1D1D1F]/60 font-artistic">
                {identityBrand.accountName}
              </span>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => router.push("/account/profile")} className="py-2.5 px-3">
          <User className="mr-2 h-4 w-4 opacity-70" />
          <span className="font-medium">个人资料</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={handleLogout}
          disabled={loggingOut}
          className="py-2.5 px-3"
        >
          {loggingOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin opacity-70" />
          ) : (
            <LogOut className="mr-2 h-4 w-4 opacity-70" />
          )}
          <span className="font-medium">{loggingOut ? "退出中..." : "退出登录"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
