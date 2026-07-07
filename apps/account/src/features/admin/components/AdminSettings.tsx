"use client";

import * as React from "react";
import { Save, RotateCcw, Loader2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";
import { RegistrationModeSelector, type RegistrationMode } from "./RegistrationModeSelector";
import { InviteCodeManager } from "./InviteCodeManager";
import { identityBrand } from "../../../config/brand.js";
import type { AccountUser } from "../../account/types";

interface AdminSettingsProps {
  user: AccountUser;
  children?: React.ReactNode;
}

export function AdminSettings({ user }: AdminSettingsProps) {
  const [mode, setMode] = React.useState<RegistrationMode>("open");
  const [savedMode, setSavedMode] = React.useState<RegistrationMode>("open");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [productName, setProductName] = React.useState(identityBrand.productName);
  const [supportEmail, setSupportEmail] = React.useState(identityBrand.supportEmail);

  React.useEffect(() => {
    async function fetchConfig() {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/registration-config");
        if (!res.ok) throw new Error("加载设置失败");
        const data = await res.json();
        const currentMode = data?.config?.mode || "open";
        setMode(currentMode);
        setSavedMode(currentMode);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载设置失败");
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const hasChanges = mode !== savedMode;

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/registration-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "保存失败");
      }
      const data = await res.json();
      const saved = data?.config?.mode || mode;
      setSavedMode(saved);
      setMode(saved);
      setNotice("设置已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setMode(savedMode);
    setError(null);
    setNotice(null);
  }

  return (
    <SectionPageLayout
      maxWidth="5xl"
      breadcrumbs={[
        { label: "管理后台", href: "/admin/settings" },
        { label: "系统设置" },
      ]}
      title="系统设置"
      description="配置身份认证、注册策略与品牌信息。修改后需保存生效。"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges || saving}>
            <RotateCcw className="mr-1.5 size-4" />
            重置
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                保存中
              </>
            ) : (
              <>
                <Save className="mr-1.5 size-4" />
                保存
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
            {notice}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>注册策略</CardTitle>
            <CardDescription>
              控制新用户如何注册账号。修改后点击保存生效。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 dark:text-zinc-400">
                <Loader2 className="size-4 animate-spin" />
                加载中...
              </div>
            ) : (
              <RegistrationModeSelector value={mode} onChange={setMode} />
            )}
          </CardContent>
        </Card>

        {mode === "invite" && (
          <Card>
            <CardHeader>
              <CardTitle>邀请码管理</CardTitle>
              <CardDescription>
                邀请码模式下，用户需凭有效邀请码注册。管理已生成的邀请码。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InviteCodeManager />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>品牌信息</CardTitle>
            <CardDescription>
              展示在登录页、邮件通知与账户中心的产品身份。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-name">产品名称</Label>
              <Input
                id="product-name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder={identityBrand.productName}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="support-email">支持邮箱</Label>
              <Input
                id="support-email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@example.com"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </SectionPageLayout>
  );
}
