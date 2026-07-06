"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AppWindow,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  MonitorSmartphone,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { getAccountMe } from "../api/getAccountMe";
import { getActivityList } from "../api/getActivityList";
import { getApplicationList } from "../api/getApplicationList";
import { getSecuritySummary } from "../api/getSecuritySummary";
import { getSessionList } from "../api/getSessionList";
import { useCenterResource } from "../hooks/useCenterResource";
import type { AccountUser, ActivityEvent } from "../types";
import { AccountCenterShell } from "./AccountCenterShell";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { cn } from "../../../lib/utils.js";

type MetricTileProps = {
  label: string;
  value: ReactNode;
  description: string;
  icon: LucideIcon;
};

type QuickLinkProps = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

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

function MetricTile({ label, value, description, icon: Icon }: MetricTileProps) {
  return (
    <div className="min-w-0 rounded-lg border bg-background px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </p>
          <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function QuickLink({ href, title, description, icon: Icon }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
        <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-3 py-3 sm:px-4">
      <span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="truncate text-sm font-medium">{event.summary}</p>
          <time className="shrink-0 text-xs text-muted-foreground">
            {formatTime(event.createdAt)}
          </time>
        </div>
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
          {event.eventType}
        </p>
      </div>
    </div>
  );
}

export function AccountOverview({
  user,
  productName,
}: {
  user: AccountUser;
  productName: string;
}) {
  const [me, setMe] = useState<AccountUser>(user);
  const { data: activities, loading: activitiesLoading, error: activitiesError } =
    useCenterResource(getActivityList);
  const { data: sessions, loading: sessionsLoading } =
    useCenterResource(getSessionList);
  const { data: applications, loading: applicationsLoading } =
    useCenterResource(getApplicationList);
  const { data: security, loading: securityLoading } =
    useCenterResource(getSecuritySummary);

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      try {
        const nextUser = await getAccountMe();
        if (!cancelled) setMe(nextUser);
      } catch {}
    }
    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const initials = useMemo(() => {
    return (me.loginName || "U").slice(0, 1).toUpperCase();
  }, [me.loginName]);

  const recentActivities = activities?.slice(0, 3) ?? [];
  const securityStatus = security?.password?.set ? "已设置" : "待设置";
  const passkeyText = securityLoading ? "—" : `${security?.passkeys?.count ?? 0}`;

  return (
    <AccountCenterShell user={me} activePath="/account/overview">
      <SectionPageLayout
        title="总览"
        description={`集中查看账号状态、安全摘要与连接到 ${productName} 的应用。`}
        breadcrumbs={[{ label: "账户中心", href: "/account/overview" }, "总览"]}
        maxWidth="full"
        bodyClassName="overflow-hidden p-0 sm:p-0"
        actions={
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link href="/account/profile">
              <UserRound className="mr-1.5 size-4" />
              编辑资料
            </Link>
          </Button>
        }
      >
        <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-x-0 border-b-0 shadow-none">
          <CardHeader className="border-b p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">账户总览工作区</CardTitle>
                <CardDescription>
                  账号主体、访问入口和最近活动集中在同一个管理面板。
                </CardDescription>
              </div>
              <Badge variant="outline" className="gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                会话有效
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="min-h-0 flex-1 overflow-auto p-0">
            <div className="divide-y">
              <section className="p-4 sm:p-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
                  <div className="min-w-0 rounded-lg border bg-muted/20 p-3 sm:p-4">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-background text-base font-semibold">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-semibold tracking-tight">
                            {me.loginName}
                          </h2>
                          {me.isAdmin ? (
                            <Badge variant="secondary">管理员</Badge>
                          ) : (
                            <Badge variant="outline">普通用户</Badge>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {me.email || "未设置邮箱"}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="min-w-0 rounded-lg border bg-background px-3 py-2.5">
                        <dt className="text-xs text-muted-foreground">用户 ID</dt>
                        <dd className="mt-1 truncate font-mono text-xs font-medium">
                          {me.sub}
                        </dd>
                      </div>
                      <div className="min-w-0 rounded-lg border bg-background px-3 py-2.5">
                        <dt className="text-xs text-muted-foreground">邮箱状态</dt>
                        <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                          <CheckCircle2
                            className={cn(
                              "size-4",
                              me.emailVerified
                                ? "text-emerald-600"
                                : "text-muted-foreground"
                            )}
                          />
                          {me.emailVerified ? "已验证" : "未验证"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <MetricTile
                      label="活动会话"
                      value={sessionsLoading ? <Skeleton className="h-7 w-12" /> : sessions?.length ?? "—"}
                      description="正在使用此账号的浏览器与设备会话。"
                      icon={MonitorSmartphone}
                    />
                    <MetricTile
                      label="授权应用"
                      value={applicationsLoading ? <Skeleton className="h-7 w-12" /> : applications?.length ?? "—"}
                      description={`已连接到 ${productName} 或其他接入方的应用。`}
                      icon={AppWindow}
                    />
                    <MetricTile
                      label="密码状态"
                      value={securityLoading ? <Skeleton className="h-7 w-16" /> : securityStatus}
                      description="密码与后续 MFA 策略会影响登录安全。"
                      icon={KeyRound}
                    />
                    <MetricTile
                      label="Passkey"
                      value={passkeyText}
                      description="已登记的免密登录设备数量。"
                      icon={Fingerprint}
                    />
                  </div>
                </div>
              </section>

              <section className="p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">快速入口</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      常用账号管理动作集中在这里。
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <QuickLink
                    href="/account/profile"
                    title="个人资料"
                    description="更新显示名与姓名字段"
                    icon={UserRound}
                  />
                  <QuickLink
                    href="/account/security"
                    title="登录与安全"
                    description="管理密码、MFA 与 Passkey"
                    icon={ShieldCheck}
                  />
                  <QuickLink
                    href="/account/sessions"
                    title="设备与会话"
                    description="查看当前登录设备"
                    icon={MonitorSmartphone}
                  />
                  <QuickLink
                    href="/account/applications"
                    title="授权应用"
                    description="审查已连接应用权限"
                    icon={AppWindow}
                  />
                </div>
              </section>

              <section className="p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">最近动态</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      最近的登录、安全和资料变更事件。
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/account/activity">
                      <Activity className="mr-1.5 size-4" />
                      查看全部
                    </Link>
                  </Button>
                </div>

                <div className="overflow-hidden rounded-lg border bg-muted/20">
                  {activitiesLoading ? (
                    <div className="space-y-3 p-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : null}

                  {!activitiesLoading && activitiesError ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      活动记录暂不可用：{activitiesError}
                    </div>
                  ) : null}

                  {!activitiesLoading && !activitiesError && recentActivities.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      暂无活动记录。
                    </div>
                  ) : null}

                  {!activitiesLoading && !activitiesError && recentActivities.length > 0 ? (
                    <div className="divide-y bg-background">
                      {recentActivities.map((event) => (
                        <ActivityRow key={event.id} event={event} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </SectionPageLayout>
    </AccountCenterShell>
  );
}
