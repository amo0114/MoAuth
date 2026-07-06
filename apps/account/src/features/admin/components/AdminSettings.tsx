"use client";

import * as React from "react";
import { Save, RotateCcw } from "lucide-react";

import { cn } from "../../../lib/utils.js";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";
import { identityBrand } from "../../../config/brand.js";
import type { AccountUser } from "../../account/types";

interface AdminSettingsProps {
  user: AccountUser;
  children?: React.ReactNode;
}

function SettingRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string;
  description: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-row items-center justify-between gap-4 py-4">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {title}
        </Label>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

/**
 * 系统设置（占位）：分块卡片展示关键开关与字段。
 * 后续接入真实 API 时替换本地 state。
 */
export function AdminSettings({ user: _user }: AdminSettingsProps) {
  const [allowRegister, setAllowRegister] = React.useState(true);
  const [requireEmailVerify, setRequireEmailVerify] = React.useState(true);
  const [enforceMfa, setEnforceMfa] = React.useState(false);
  const [productName, setProductName] = React.useState(identityBrand.productName);
  const [supportEmail, setSupportEmail] = React.useState(identityBrand.supportEmail);

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
          <Button variant="outline" size="sm">
            <RotateCcw className="mr-1.5 size-4" />
            重置
          </Button>
          <Button size="sm">
            <Save className="mr-1.5 size-4" />
            保存
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>认证策略</CardTitle>
            <CardDescription>
              控制注册与登录流程的全局策略。
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-slate-200 dark:divide-zinc-800">
            <SettingRow
              title="允许公开注册"
              description="关闭后，新用户无法通过注册页创建账户。"
              htmlFor="allow-register"
            >
              <Switch
                id="allow-register"
                checked={allowRegister}
                onCheckedChange={setAllowRegister}
              />
            </SettingRow>
            <SettingRow
              title="要求邮箱验证"
              description="开启后，新注册用户必须完成邮箱验证才能登录。"
              htmlFor="require-email-verify"
            >
              <Switch
                id="require-email-verify"
                checked={requireEmailVerify}
                onCheckedChange={setRequireEmailVerify}
              />
            </SettingRow>
            <SettingRow
              title="强制两步验证"
              description="开启后，所有用户必须启用至少一种 MFA / Passkey。"
              htmlFor="enforce-mfa"
            >
              <Switch
                id="enforce-mfa"
                checked={enforceMfa}
                onCheckedChange={setEnforceMfa}
              />
            </SettingRow>
          </CardContent>
        </Card>

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
