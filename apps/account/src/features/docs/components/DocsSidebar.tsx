"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const DOCS_NAV = [
  {
    title: "概览",
    items: [
      { title: "简介", href: "/docs" },
      { title: "快速开始", href: "/docs/getting-started" },
      { title: "架构设计", href: "/docs/architecture" },
    ],
  },
  {
    title: "核心概念",
    items: [
      { title: "身份与账号", href: "/docs/concepts/identity" },
      { title: "应用接入", href: "/docs/concepts/applications" },
      { title: "单点登录 (SSO)", href: "/docs/concepts/sso" },
    ],
  },
  {
    title: "开发指南",
    items: [
      { title: "OIDC 配置", href: "/docs/guides/oidc" },
      { title: "服务端 SDK", href: "/docs/guides/server-sdk" },
      { title: "客户端 SDK", href: "/docs/guides/client-sdk" },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-full">
      {DOCS_NAV.map((group, index) => (
        <div key={index} className="pb-8">
          <h4 className="mb-2 rounded-md px-2 py-1 text-sm font-semibold">
            {group.title}
          </h4>
          <div className="grid grid-flow-row auto-rows-max text-sm">
            {group.items.map((item, itemIndex) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={itemIndex}
                  href={item.href}
                  className={cn(
                    "group flex w-full items-center rounded-md border border-transparent px-2 py-1.5 text-muted-foreground hover:underline",
                    isActive
                      ? "font-medium text-foreground text-primary"
                      : "hover:text-foreground"
                  )}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
