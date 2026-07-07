"use client";

import * as React from "react";
import { Plus, X, Loader2, Copy, Check } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";

interface InviteCode {
  code: string;
  maxUseCount: number;
  usedCount: number;
  isRevoked: boolean;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export function InviteCodeManager() {
  const [codes, setCodes] = React.useState<InviteCode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  function fetchCodes() {
    setLoading(true);
    setError(null);
    fetch("/api/admin/invite-codes")
      .then((res) => { if (!res.ok) throw new Error("Failed to load"); return res.json(); })
      .then((data) => setCodes(data.codes || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  React.useEffect(() => { fetchCodes(); }, []);

  async function handleCreate(formData: FormData) {
    const maxUseCount = parseInt(formData.get("maxUseCount") as string) || 1;
    const expiresAt = formData.get("expiresAt") as string || null;

    try {
      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUseCount, expiresAt: expiresAt || null }),
      });
      if (!res.ok) throw new Error("创建失败");
      setShowCreate(false);
      fetchCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  }

  async function handleRevoke(code: string) {
    try {
      const res = await fetch(`/api/admin/invite-codes/${encodeURIComponent(code)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("作废失败");
      fetchCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作废失败");
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-zinc-400">
          共 {codes.length} 个邀请码
        </span>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 size-4" />
          生成邀请码
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 dark:text-zinc-400">
          <Loader2 className="size-4 animate-spin" />
          加载中...
        </div>
      ) : codes.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
          暂无邀请码，点击上方按钮生成。
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-zinc-300">邀请码</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-zinc-300">使用量</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-zinc-300">过期时间</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-zinc-300">状态</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-zinc-300">创建时间</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600 dark:text-zinc-300">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
              {codes.map((c) => {
                const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
                const status = c.isRevoked ? "revoked" : expired ? "expired" : c.usedCount >= c.maxUseCount ? "exhausted" : "active";
                return (
                  <tr key={c.code} className="bg-white dark:bg-zinc-900">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-zinc-800">
                          {c.code}
                        </code>
                        <button
                          onClick={() => handleCopy(c.code)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                          title="复制"
                        >
                          {copiedCode === c.code ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-zinc-300">
                      {c.usedCount}/{c.maxUseCount}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-zinc-300">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("zh-CN") : "永不过期"}
                    </td>
                    <td className="px-4 py-2.5">
                      {statusBadge(status)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-zinc-400">
                      {new Date(c.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-500 hover:text-red-700"
                          onClick={() => handleRevoke(c.code)}
                        >
                          <X className="mr-1 size-3" />
                          作废
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <form action={handleCreate}>
            <DialogHeader>
              <DialogTitle>生成邀请码</DialogTitle>
              <DialogDescription>
                新邀请码生成后可复制发送给用户。
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="max-use-count">最大使用次数</Label>
                <Input
                  id="max-use-count"
                  name="maxUseCount"
                  type="number"
                  min={1}
                  defaultValue={1}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="expires-at">过期时间（可选）</Label>
                <Input
                  id="expires-at"
                  name="expiresAt"
                  type="date"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button type="submit">生成</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    active: { label: "有效", variant: "default" },
    exhausted: { label: "已用完", variant: "secondary" },
    expired: { label: "已过期", variant: "outline" },
    revoked: { label: "已作废", variant: "destructive" },
  };
  const info = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}
