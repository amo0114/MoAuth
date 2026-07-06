"use client";

import React, { useState } from "react";
import { MonitorSmartphone, Globe, ShieldAlert, Key, Search } from "lucide-react";

import { useCenterResource } from "../hooks/useCenterResource";
import { getActivityList } from "../api/getActivityList";
import type { AccountUser, ActivityEvent } from "../types";
import { AccountCenterShell } from "./AccountCenterShell";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";
import { CardGroup, Divider } from "./AccountUI";
import { Skeleton } from "../../../components/ui/skeleton";
import { cn } from "../../../lib/utils";

function getActivityIcon(eventType: string) {
  const t = eventType.toLowerCase();
  if (t.includes("login") || t.includes("session")) {
    return <MonitorSmartphone size={20} className="text-emerald-500" />;
  }
  if (t.includes("password")) {
    return <Key size={20} className="text-blue-500" />;
  }
  if (t.includes("alert") || t.includes("security") || t.includes("fail")) {
    return <ShieldAlert size={20} className="text-red-500" />;
  }
  return <Globe size={20} className="text-slate-500" />;
}

function isSecurityEvent(eventType: string) {
  const t = eventType.toLowerCase();
  return t.includes("password") || t.includes("alert") || t.includes("security") || t.includes("fail") || t.includes("mfa");
}

function isLoginEvent(eventType: string) {
  const t = eventType.toLowerCase();
  return t.includes("login") || t.includes("session");
}

function formatTime(value: string | number | Date) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

export function AccountActivity({ user }: { user: AccountUser }) {
  const { data: events, loading, error } = useCenterResource(getActivityList);
  const [filter, setFilter] = useState("all");

  const filteredEvents = events?.filter((e: ActivityEvent) => {
    if (filter === "all") return true;
    if (filter === "security" && isSecurityEvent(e.eventType)) return true;
    if (filter === "login" && isLoginEvent(e.eventType)) return true;
    return false;
  });

  return (
    <AccountCenterShell user={user} activePath="/account/activity">
      <SectionPageLayout
        title="活动记录"
        description="查看您账号最近的登录情况、安全事件与信息修改记录"
        breadcrumbs={[{ label: "账户中心", href: "/account/overview" }, "活动记录"]}
        maxWidth="5xl"
      >
      <div className="max-w-3xl">
        {error ? (
          <div className="mb-6 px-4 py-3 rounded-xl text-sm font-medium border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {["all", "login", "security"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[14px] font-medium transition-colors whitespace-nowrap",
                filter === f
                  ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-slate-900"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
              )}
            >
              {f === "all" ? "全部动态" : f === "login" ? "登录记录" : "安全事件"}
            </button>
          ))}
        </div>

        {loading ? (
          <CardGroup delayIndex={1}>
            <div className="p-6">
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          </CardGroup>
        ) : null}

        {!loading && !error && (!filteredEvents || filteredEvents.length === 0) ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            <Search className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">暂无相关活动记录</p>
          </div>
        ) : null}

        {filteredEvents?.length ? (
          <CardGroup delayIndex={1}>
            <div className="relative">
              <div className="absolute left-[39px] top-6 bottom-6 w-px bg-slate-100 dark:bg-zinc-800 hidden sm:block"></div>
              {filteredEvents.map((event: ActivityEvent, idx: number) => (
                <React.Fragment key={event.id}>
                  <div className="flex flex-col sm:flex-row px-6 py-5 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors duration-200 group relative">
                    <div className="hidden sm:flex w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 items-center justify-center relative z-10 shrink-0 mr-6 mt-1 group-hover:border-slate-200 dark:group-hover:border-zinc-700 transition-colors">
                      <div className="scale-75">{getActivityIcon(event.eventType)}</div>
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 sm:mb-0">
                        <div className="text-[15px] text-slate-900 dark:text-zinc-100 font-semibold flex items-center gap-2">
                          <span className="sm:hidden scale-75 inline-flex">{getActivityIcon(event.eventType)}</span>
                          {event.summary}
                        </div>
                        <div className="text-[13px] text-slate-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                          {formatTime(event.createdAt)}
                        </div>
                      </div>

                      <div className="text-[13px] text-slate-500 dark:text-zinc-400 mt-1 sm:mt-0.5 leading-relaxed">
                        {event.eventType}
                      </div>
                    </div>
                  </div>
                  {idx !== filteredEvents.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </div>
          </CardGroup>
        ) : null}
      </div>
      </SectionPageLayout>
    </AccountCenterShell>
  );
}