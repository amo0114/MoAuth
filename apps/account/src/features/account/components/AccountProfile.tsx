"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Loader2,
  Mail,
  Pencil,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { cn } from "../../../lib/utils.js";
import type { AccountProfile as AccountProfileData, AccountUser } from "../types";
import { useAccountProfile } from "../hooks/useAccountProfile";
import { AccountCenterShell } from "./AccountCenterShell";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";

type ProfileFormState = {
  displayName: string;
  firstName: string;
  lastName: string;
};

function getProfileFormState(
  user: AccountUser,
  profile: AccountProfileData | null
): ProfileFormState {
  return {
    displayName: profile?.displayName || profile?.loginName || user.loginName || "",
    firstName: profile?.firstName || "",
    lastName: profile?.lastName || "",
  };
}

function ProfileNotice({
  tone,
  children,
}: {
  tone: "danger" | "info";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        tone === "danger"
          ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200"
      )}
    >
      {tone === "danger" ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      ) : (
        <BadgeCheck className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}

function ProfileField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1.5 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 break-words text-sm font-medium text-foreground",
          mono && "font-mono text-xs"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function SettingsInputField({
  id,
  label,
  description,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10"
      />
      {description ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function AccountProfile({ user }: { user: AccountUser }) {
  const { profile, loading, saving, notice, updateProfile } = useAccountProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(() =>
    getProfileFormState(user, null)
  );

  useEffect(() => {
    setForm(getProfileFormState(user, profile));
  }, [profile, user]);

  const displayName = profile?.displayName || profile?.loginName || user.loginName;
  const loginName = profile?.loginName || user.loginName;
  const email = profile?.email || user.email || "";
  const emailVerified = profile?.emailVerified ?? user.emailVerified ?? false;
  const subjectId = profile?.sub || user.sub;
  const initials = useMemo(() => {
    const source = displayName || loginName || "U";
    return source.slice(0, 1).toUpperCase();
  }, [displayName, loginName]);

  function resetForm() {
    setForm(getProfileFormState(user, profile));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await updateProfile({
      displayName: form.displayName.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
    });
    if (ok) setIsEditing(false);
  }

  return (
    <AccountCenterShell user={user} activePath="/account/profile">
      <SectionPageLayout
        title="个人资料"
        description="管理账号身份资料。这里的信息会同步到统一身份核心，并用于接入应用的基础展示。"
        breadcrumbs={[{ label: "账户中心", href: "/account/overview" }, "个人资料"]}
        maxWidth="full"
        bodyClassName="overflow-hidden p-0 sm:p-0"
        actions={
          isEditing ? (
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setIsEditing(false);
                  resetForm();
                }}
                disabled={saving}
              >
                <X className="mr-1.5 size-4" />
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                form="account-profile-form"
                className="w-full sm:w-auto"
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 size-4" />
                )}
                保存
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="mr-1.5 size-4" />
              编辑资料
            </Button>
          )
        }>
        <div className="flex h-full min-h-0 flex-col overflow-auto">
          {/* Card 1: 身份概览 */}
          <Card className="overflow-hidden rounded-none border-x-0 border-t-0 shadow-none">
            <CardHeader className="border-b p-4 sm:p-5 bg-black/[0.01] dark:bg-white/[0.01]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">身份概览</CardTitle>
                  <CardDescription>
                    当前登录账号的主体、邮箱和资料同步状态。
                  </CardDescription>
                </div>
                {loading ? (
                  <Badge variant="secondary" className="gap-1.5">
                    <Loader2 className="size-3 animate-spin" />
                    同步中
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    正常
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {notice ? (
                <div className="mb-4 sm:mb-5">
                  <ProfileNotice tone={notice.tone}>{notice.message}</ProfileNotice>
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
                <div className="min-w-0 rounded-lg border bg-muted/20 p-3 sm:p-4">
                  <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                    <div className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-lg border bg-background text-base font-semibold">
                      {loading && !profile ? (
                        <div className="size-5 sm:size-6 rounded-full bg-muted animate-pulse" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {loading && !profile ? (
                        <div className="space-y-2 mt-1">
                          <div className="h-5 w-32 rounded bg-muted animate-pulse" />
                          <div className="h-4 w-24 rounded bg-muted/50 animate-pulse" />
                        </div>
                      ) : (
                        <>
                          <h2 className="truncate text-base sm:text-lg font-semibold tracking-tight">
                            {displayName}
                          </h2>
                          <p className="mt-0.5 sm:mt-1 truncate text-xs sm:text-sm text-muted-foreground">
                            {loginName}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <dl className="mt-4 sm:mt-5 divide-y">
                    <ProfileField
                      label="用户 ID"
                      mono
                      value={
                        <span className="block truncate rounded-md bg-background px-2 py-1">
                          {subjectId}
                        </span>
                      }
                    />
                    <ProfileField label="账户名" value={loginName} />
                    <ProfileField
                      label="邮箱"
                      value={
                        email ? email : <span className="text-muted-foreground">未设置</span>
                      }
                    />
                  </dl>
                </div>

                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="flex min-w-0 items-start gap-3 rounded-lg border bg-background px-3 py-2.5">
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">邮箱验证</span>
                        {emailVerified ? (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                            已验证
                          </Badge>
                        ) : (
                          <Badge variant="secondary">未验证</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        已验证邮箱可用于账号恢复和接入应用资料展示。
                      </p>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-start gap-3 rounded-lg border bg-background px-3 py-2.5">
                    <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">资料来源</span>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        资料由 Account BFF 同步到隐藏身份核心，不暴露底层认证入口。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: 基础资料 */}
          <Card className="overflow-hidden rounded-none border-x-0 shadow-none">
            <CardHeader className="border-b p-4 sm:p-5 bg-black/[0.01] dark:bg-white/[0.01]">
              <CardTitle className="text-base font-semibold">基础资料</CardTitle>
              <CardDescription>
                更新显示名和姓名字段。保存后接入应用可读取最新资料。
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <form id="account-profile-form" onSubmit={handleSubmit}>
                {isEditing ? (
                  <div className="grid min-w-0 gap-x-5 gap-y-6 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <SettingsInputField
                        id="profile-display-name"
                        label="显示名"
                        description="建议使用易识别的真实姓名或昵称。"
                        value={form.displayName}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, displayName: value }))
                        }
                      />
                    </div>
                    <SettingsInputField
                      id="profile-first-name"
                      label="名 (First Name)"
                      value={form.firstName}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, firstName: value }))
                      }
                    />
                    <SettingsInputField
                      id="profile-last-name"
                      label="姓 (Last Name)"
                      value={form.lastName}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, lastName: value }))
                      }
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted/20 px-3 sm:px-4">
                    <dl className="divide-y">
                      <ProfileField
                        label="显示名"
                        value={
                          loading && !profile ? <div className="h-5 w-32 rounded bg-muted animate-pulse" /> : displayName
                        }
                      />
                      <ProfileField
                        label="名 (First Name)"
                        value={
                          loading && !profile ? (
                            <div className="h-5 w-20 rounded bg-muted animate-pulse" />
                          ) : profile?.firstName ? (
                            profile.firstName
                          ) : (
                            <span className="text-muted-foreground">未设置</span>
                          )
                        }
                      />
                      <ProfileField
                        label="姓 (Last Name)"
                        value={
                          loading && !profile ? (
                            <div className="h-5 w-20 rounded bg-muted animate-pulse" />
                          ) : profile?.lastName ? (
                            profile.lastName
                          ) : (
                            <span className="text-muted-foreground">未设置</span>
                          )
                        }
                      />
                    </dl>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Card 3: 危险区域 */}
          <Card className="overflow-hidden rounded-none border-x-0 border-b-0 border-red-200 shadow-none dark:border-red-900/50">
            <CardHeader className="border-b border-red-100 dark:border-red-900/30 p-4 sm:p-5 bg-red-50/50 dark:bg-red-950/20">
              <CardTitle className="text-base font-semibold text-red-700 dark:text-red-400">危险区域</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    删除账号将永久移除所有相关数据及授权应用，无法撤销。此操作上线前应接入二次确认与强认证。
                  </p>
                </div>
                <Button type="button" variant="destructive" className="shrink-0 w-full sm:w-auto" disabled>
                  <Trash2 className="mr-1.5 size-4" />
                  永久注销账号 (暂不可用)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout>
    </AccountCenterShell>
  );
}
