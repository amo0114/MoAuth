"use client";

import * as React from "react";
import { Loader2, Rocket } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { AccountCenterShell } from "./AccountCenterShell";
import type { AccountUser } from "../types";

type ApplicationRequest = {
  id: string;
  displayName: string;
  status: string;
  createdAt: string;
  createdClientId?: string | null;
};

export function DeveloperApply({ user }: { user: AccountUser }) {
  const [requests, setRequests] = React.useState<ApplicationRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    displayName: "",
    homepageUrl: "",
    description: "",
    logoUrl: "",
    redirectUris: "",
    minUserLevel: 0,
  });

  async function reload() {
    setLoading(true);
    try {
      const response = await fetch("/api/developer/applications");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load requests");
      setRequests(data.requests || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    reload();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/developer/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          homepageUrl: form.homepageUrl || null,
          description: form.description || null,
          logoUrl: form.logoUrl || null,
          redirectUris: form.redirectUris.split("\n").map((line) => line.trim()).filter(Boolean),
          minUserLevel: form.minUserLevel,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to submit request");
      setNotice("申请已提交，等待管理员审批。");
      setForm({
        displayName: "",
        homepageUrl: "",
        description: "",
        logoUrl: "",
        redirectUris: "",
        minUserLevel: 0,
      });
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AccountCenterShell user={user} activePath="/account/developer">
      <SectionPageLayout
        title="申请接入"
        description="提交 OAuth2/OIDC 应用接入申请。审批通过后将获得 client_id 与接入说明。"
        breadcrumbs={[{ label: "账户中心", href: "/account/overview" }, "申请接入"]}
        maxWidth="4xl"
      >
        {notice ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="size-4" />
              创建一个新的 OAuth2/OIDC 应用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="displayName">应用名（具有唯一性）</Label>
                <Input
                  id="displayName"
                  required
                  value={form.displayName}
                  onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homepageUrl">应用主页</Label>
                <Input
                  id="homepageUrl"
                  value={form.homepageUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, homepageUrl: event.target.value }))}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">应用描述</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="redirectUris">回调地址（每行一个）</Label>
                <textarea
                  id="redirectUris"
                  required
                  className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={form.redirectUris}
                  onChange={(event) => setForm((prev) => ({ ...prev, redirectUris: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoUrl">应用图标 URL</Label>
                <Input
                  id="logoUrl"
                  value={form.logoUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minUserLevel">最低等级</Label>
                <select
                  id="minUserLevel"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={form.minUserLevel}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, minUserLevel: Number(event.target.value) }))
                  }
                >
                  {[0, 1, 2, 3, 4].map((level) => (
                    <option key={level} value={level}>
                      {level} 级
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                提交申请
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">我的申请</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <div className="text-sm text-slate-500">加载中…</div> : null}
            {!loading && requests.length === 0 ? (
              <div className="text-sm text-slate-500">暂无申请记录</div>
            ) : null}
            {requests.map((request) => (
              <div key={request.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="font-medium">{request.displayName}</div>
                <div className="mt-1 text-slate-500">状态：{request.status}</div>
                {request.createdClientId ? (
                  <div className="mt-1 text-slate-500">client_id: {request.createdClientId}</div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </SectionPageLayout>
    </AccountCenterShell>
  );
}