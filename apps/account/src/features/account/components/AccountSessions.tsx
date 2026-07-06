"use client";

import React, { useState } from "react";
import { MonitorSmartphone } from "lucide-react";

import { useCenterResource } from "../hooks/useCenterResource";
import { getSessionList } from "../api/getSessionList";
import type { AccountUser } from "../types";
import { AccountCenterShell } from "./AccountCenterShell";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";
import { CardGroup, Divider } from "./AccountUI";
import { Skeleton } from "../../../components/ui/skeleton";

function formatTime(value: string | number | Date) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch {
    return String(value);
  }
}

export function AccountSessions({ user }: { user: AccountUser }) {
  const { data: sessions, loading, error } = useCenterResource(getSessionList);

  return (
    <AccountCenterShell user={user} activePath="/account/sessions">
      <SectionPageLayout
        title="设备与会话"
        description="查看并管理正在使用您的账号登录的设备与浏览器会话"
        breadcrumbs={[{ label: "账户中心", href: "/account/overview" }, "设备与会话"]}
        maxWidth="5xl"
      >
      <div className="max-w-3xl">
        {error ? (
          <div className="mb-6 px-4 py-3 rounded-xl text-sm font-medium border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {loading ? (
          <CardGroup delayIndex={1}>
            <div className="p-6">
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          </CardGroup>
        ) : null}

        {sessions?.length ? (
          <CardGroup delayIndex={1}>
            {sessions.map((session, idx) => (
              <React.Fragment key={session.id}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 sm:py-5 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors duration-200 group">
                  <div className="flex items-center gap-4 mb-3 sm:mb-0">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-slate-500 dark:text-zinc-400 flex-shrink-0">
                      <MonitorSmartphone size={24} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="text-[15px] text-slate-900 dark:text-zinc-100 font-semibold flex items-center gap-2">
                        {session.label}
                        {session.current && (
                          <span className="text-[12px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/50 font-semibold">当前设备</span>
                        )}
                      </div>
                      <div className="text-[13px] text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">{session.kind}</div>
                    </div>
                  </div>
                  <div className="flex items-center sm:justify-end gap-4 ml-16 sm:ml-0">
                    <div className="text-[13px] text-slate-500 dark:text-zinc-400 font-medium">{formatTime(session.createdAt)}</div>
                    {!session.current && (
                      <button className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-zinc-700 text-red-600 dark:text-red-400 text-[13px] font-medium bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800/50 transition-colors">
                        退出
                      </button>
                    )}
                  </div>
                </div>
                {idx !== sessions.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </CardGroup>
        ) : null}
      </div>
      </SectionPageLayout>
    </AccountCenterShell>
  );
}