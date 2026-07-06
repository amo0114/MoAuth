"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../../../components/ui/command";
import { useAccountNavLinks } from "../hooks/useAccountNavLinks";

type CommandMenuProps = {
  isAdmin?: boolean;
};

export function CommandMenu({ isAdmin = false }: CommandMenuProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const navLinks = useAccountNavLinks({ showAdmin: isAdmin, isAdmin });

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((current) => !current);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="输入命令或搜索页面..." />
      <CommandList>
        <CommandEmpty>未找到结果。</CommandEmpty>
        <CommandGroup heading="导航">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <CommandItem
                key={link.href}
                onSelect={() => {
                  runCommand(() => router.push(link.href));
                }}
              >
                <Icon className="mr-2 h-4 w-4 text-[#1D1D1F]/60" />
                <span>{link.title}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="系统">
          <CommandItem
            onSelect={() => {
              runCommand(async () => {
                await fetch("/api/logout", { method: "POST" });
                window.location.assign("/login");
              });
            }}
            className="text-red-600 data-[selected='true']:bg-red-50/50 data-[selected='true']:text-red-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>退出登录</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}