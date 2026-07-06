"use client";

import React, { useState } from "react";
import { AppWindow, Loader2 } from "lucide-react";

import { useCenterResource } from "../hooks/useCenterResource";
import { getApplicationList } from "../api/getApplicationList";
import { revokeApplication } from "../api/revokeApplication";
import type { AccountUser } from "../types";
import { AccountCenterShell } from "./AccountCenterShell";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";
import { CardGroup, Divider } from "./AccountUI";
import { Skeleton } from "../../../components/ui/skeleton";
import { getUserFriendlyErrorMessage } from "../../../lib/errors";

function formatGrantedAt(value: string | number | Date) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch {
    return String(value);
  }
}

export function AccountApplications({ user }: { user: AccountUser }) {
  const { data: applications, loading, error, reload } = useCenterResource(getApplicationList);
  const [revokingClientId, setRevokingClientId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "danger" | "info";
    message: string;
  } | null>(null);

  const handleRevoke = async (clientId: string) => {
    setRevokingClientId(clientId);
    setNotice(null);
    try {
      await revokeApplication(clientId);
      setNotice({ tone: "info", message: "应用授权已撤销" });
      await reload();
    } catch (cause) {
      setNotice({ tone: "danger", message: getUserFriendlyErrorMessage(cause) });
    } finally {
      setRevokingClientId(null);
    }
  };

  return (
    <AccountCenterShell user={user} activePath="/account/applications">
      <SectionPageLayout
        title="授权应用"
        description="管理有权访问您账号数据的第三方或关联应用"
        breadcrumbs={[{ label: "账户中心", href: "/account/overview" }, "授权应用"]}
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

        {applications?.length ? (
          <CardGroup delayIndex={1}>
            {applications.map((app, idx) => (
              <React.Fragment key={app.clientId}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 sm:py-5 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors duration-200 group">
                  <div className="flex items-center gap-4 mb-3 sm:mb-0">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center flex-shrink-0">
                      <AppWindow size={24} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="text-[15px] text-slate-900 dark:text-zinc-100 font-semibold">{app.displayName}</div>
                      <div className="text-[13px] text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                        {app.status} • {(app.scopes || []).join(", ")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center sm:justify-end gap-4 ml-16 sm:ml-0">
                    {app.grantedAt ? (
                      <div className="text-[13px] text-slate-500 dark:text-zinc-400 font-medium">
                        授权于：{formatGrantedAt(app.grantedAt)}
                      </div>
                    ) : null}
                    <button
                      disabled={revokingClientId === app.clientId}
                      onClick={() => handleRevoke(app.clientId)}
                      className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-zinc-700 text-red-600 dark:text-red-400 text-[13px] font-medium bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800/50 transition-colors"
                    >
                      {revokingClientId === app.clientId ? <Loader2 className="w-4 h-4 animate-spin" /> : "撤销"}
                    </button>
                  </div>
                </div>
                {idx !== applications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </CardGroup>
        ) : null}
      </div>
      </SectionPageLayout>
    </AccountCenterShell>
  );
}