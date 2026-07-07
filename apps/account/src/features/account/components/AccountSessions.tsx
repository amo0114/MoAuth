"use client";

import React, { useState } from "react";
import { Loader2, LogOut, MonitorSmartphone } from "lucide-react";

import { useCenterResource } from "../hooks/useCenterResource";
import { getSessionList } from "../api/getSessionList";
import { revokeSession } from "../api/revokeSession";
import type { AccountUser } from "../types";
import { AccountCenterShell } from "./AccountCenterShell";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";
import { CardGroup, Divider } from "./AccountUI";
import { Skeleton } from "../../../components/ui/skeleton";
import { getUserFriendlyErrorMessage } from "../../../lib/errors";

function formatTime(value: string | number | Date) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch {
    return String(value);
  }
}

export function AccountSessions({ user }: { user: AccountUser }) {
  const { data, loading, error, reload } = useCenterResource(getSessionList);
  const [notice, setNotice] = useState<{
    tone: "danger" | "info";
    message: string;
  } | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const sessions = data?.sessions ?? [];
  const remoteSessionListingUnsupported = data?.capabilities?.remoteSessionListing === false;

  async function handleRevoke(sessionId: string, current: boolean) {
    setNotice(null);
    setRevokingSessionId(sessionId);
    try {
      await revokeSession(sessionId);
      if (current) {
        window.location.assign("/login");
        return;
      }
      setNotice({ tone: "info", message: "会话已退出。" });
      reload();
    } catch (cause) {
      setNotice({ tone: "danger", message: getUserFriendlyErrorMessage(cause) });
    } finally {
      setRevokingSessionId(null);
    }
  }

  return (
    <AccountCenterShell user={user} activePath="/account/sessions">
      <SectionPageLayout
        title="设备与会话"
        description="查看并管理正在使用您的账号登录的设备与浏览器会话"
        breadcrumbs={[{ label: "账户中心", href: "/account/overview" }, "设备与会话"]}
        maxWidth="5xl"
      >
      <div className="max-w-3xl">
        {notice ? (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium border shadow-sm ${
            notice.tone === "info"
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400"
          }`}>
            {notice.message}
          </div>
        ) : null}

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

        {!loading && remoteSessionListingUnsupported ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            当前部署使用加密 Cookie 会话，只能管理当前浏览器会话；跨设备会话列表需要接入服务端会话存储后启用。
          </div>
        ) : null}

        {sessions.length ? (
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
                    <div className="text-right text-[13px] text-slate-500 dark:text-zinc-400 font-medium">
                      <div>创建：{formatTime(session.createdAt)}</div>
                      {session.expiresAt ? <div className="mt-0.5">到期：{formatTime(session.expiresAt)}</div> : null}
                    </div>
                    {session.revocable ? (
                      <button
                        disabled={revokingSessionId === session.id}
                        onClick={() => handleRevoke(session.id, Boolean(session.current))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-zinc-700 text-red-600 dark:text-red-400 text-[13px] font-medium bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800/50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {revokingSessionId === session.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <LogOut className="size-3.5" />
                        )}
                        {session.current ? "退出当前会话" : "退出"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {idx !== sessions.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </CardGroup>
        ) : null}

        {!loading && !sessions.length && !error ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            当前没有可显示的 Account 会话。
          </div>
        ) : null}
      </div>
      </SectionPageLayout>
    </AccountCenterShell>
  );
}
