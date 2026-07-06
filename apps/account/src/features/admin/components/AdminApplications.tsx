"use client";

import * as React from "react";
import { AppWindow, Loader2, Plus, ShieldAlert } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import type { AccountUser } from "../../account/types";

type OidcApplication = {
  id: string;
  clientId: string;
  displayName: string;
  env: string;
  status: string;
  redirectUris: string[];
  provisioningPolicy: string;
  discoveryUrl?: string;
  clientSecret?: string;
};

type ApplicationRequest = {
  id: string;
  displayName: string;
  homepageUrl?: string | null;
  description?: string | null;
  redirectUris: string[];
  minUserLevel: number;
  status: string;
  createdAt: string;
};

export function AdminApplications({ user: _user }: { user: AccountUser }) {
  const [applications, setApplications] = React.useState<OidcApplication[]>([]);
  const [requests, setRequests] = React.useState<ApplicationRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    displayName: "",
    homepageUrl: "",
    description: "",
    logoUrl: "",
    redirectUris: "",
    env: "dev",
    provisioningPolicy: "allowlist",
    minUserLevel: 0,
  });

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, reqRes] = await Promise.all([
        fetch("/api/admin/applications"),
        fetch("/api/admin/application-requests"),
      ]);
      if (!appsRes.ok) throw new Error("Failed to load applications");
      if (!reqRes.ok) throw new Error("Failed to load application requests");
      const appsData = await appsRes.json();
      const reqData = await reqRes.json();
      setApplications(appsData.applications || []);
      setRequests(reqData.requests || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    reload();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setCreatedSecret(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          homepageUrl: form.homepageUrl || null,
          description: form.description || null,
          logoUrl: form.logoUrl || null,
          redirectUris: form.redirectUris.split("\n").map((line) => line.trim()).filter(Boolean),
          env: form.env,
          provisioningPolicy: form.provisioningPolicy,
          minUserLevel: form.minUserLevel,
          clientType: "confidential",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create application");
      setNotice(`已创建应用 ${data.application.displayName}`);
      if (data.application.clientSecret) {
        setCreatedSecret(data.application.clientSecret);
      }
      setForm({
        displayName: "",
        homepageUrl: "",
        description: "",
        logoUrl: "",
        redirectUris: "",
        env: "dev",
        provisioningPolicy: "allowlist",
        minUserLevel: 0,
      });
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create application");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(app: OidcApplication) {
    const nextStatus = app.status === "active" ? "disabled" : "active";
    const response = await fetch(`/api/admin/applications/${app.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Failed to update status");
      return;
    }
    await reload();
  }

  async function approveRequest(requestId: string) {
    const response = await fetch(`/api/admin/application-requests/${requestId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env: "dev", provisioningPolicy: "allowlist" }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Failed to approve request");
      return;
    }
    setNotice(`已批准申请并创建 client_id: ${data.application?.clientId}`);
    if (data.application?.clientSecret) setCreatedSecret(data.application.clientSecret);
    await reload();
  }

  async function rejectRequest(requestId: string) {
    const response = await fetch(`/api/admin/application-requests/${requestId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNote: "不符合当前接入要求" }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Failed to reject request");
      return;
    }
    await reload();
  }

  return (
    <SectionPageLayout
      maxWidth="5xl"
      breadcrumbs={[{ label: "管理后台", href: "/admin/applications" }, { label: "应用管理" }]}
      title="应用管理"
      description="创建、编辑与审批 OIDC 应用。保存后自动同步 Zitadel 与 Connect 注册表。"
    >
      {notice ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {createdSecret ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-medium">Client Secret（仅展示一次，请立即保存）</div>
          <code className="mt-2 block break-all">{createdSecret}</code>
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" />
              创建 OAuth2/OIDC 应用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="displayName">应用名</Label>
                <Input
                  id="displayName"
                  required
                  value={form.displayName}
                  onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  placeholder="MoNexus"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homepageUrl">应用主页</Label>
                <Input
                  id="homepageUrl"
                  value={form.homepageUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, homepageUrl: event.target.value }))}
                  placeholder="https://monexus.example.com"
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
                <Label htmlFor="logoUrl">应用图标 URL</Label>
                <Input
                  id="logoUrl"
                  value={form.logoUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
                  placeholder="https://example.com/logo.png"
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
                  placeholder="http://127.0.0.1:3003/api/auth/moauth/callback"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="env">环境</Label>
                  <select
                    id="env"
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={form.env}
                    onChange={(event) => setForm((prev) => ({ ...prev, env: event.target.value }))}
                  >
                    <option value="dev">dev</option>
                    <option value="staging">staging</option>
                    <option value="prod">prod</option>
                  </select>
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
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                创建应用
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4" />
              待审批申请
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <div className="text-sm text-slate-500">加载中…</div> : null}
            {!loading && requests.length === 0 ? (
              <div className="text-sm text-slate-500">暂无待审批申请</div>
            ) : null}
            {requests.map((request) => (
              <div key={request.id} className="rounded-lg border border-slate-200 p-3">
                <div className="font-medium">{request.displayName}</div>
                <div className="mt-1 text-xs text-slate-500">{request.redirectUris.join(", ")}</div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => approveRequest(request.id)}>
                    批准
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => rejectRequest(request.id)}>
                    拒绝
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AppWindow className="size-4" />
            已注册应用
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{app.displayName}</div>
                  <div className="mt-1 text-xs text-slate-500">client_id: {app.clientId}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{app.env}</Badge>
                  <Badge variant={app.status === "active" ? "default" : "secondary"}>{app.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => toggleStatus(app)}>
                    {app.status === "active" ? "停用" : "启用"}
                  </Button>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">{app.redirectUris.join(" · ")}</div>
              {app.discoveryUrl ? (
                <div className="mt-2 text-xs text-slate-500">Discovery: {app.discoveryUrl}</div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </SectionPageLayout>
  );
}