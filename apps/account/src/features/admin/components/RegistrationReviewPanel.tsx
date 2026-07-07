"use client";

import * as React from "react";
import { Check, X, Loader2, AlertCircle } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";

interface ReviewRecord {
  id: string;
  userId: string;
  email: string;
  loginName: string;
  displayName: string;
  reviewStatus: string;
  reviewNote: string | null;
  createdAt: string;
}

interface RegistrationReviewPanelProps {
  reviews: ReviewRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export function RegistrationReviewPanel({ reviews, loading, onRefresh }: RegistrationReviewPanelProps) {
  const [actionTarget, setActionTarget] = React.useState<{
    id: string;
    action: "approve" | "reject";
  } | null>(null);
  const [reviewNote, setReviewNote] = React.useState("");
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleConfirm() {
    if (!actionTarget) return;
    setProcessing(true);
    setError(null);

    try {
      const url = `/api/admin/registration-reviews/${actionTarget.id}/${actionTarget.action}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote: reviewNote || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "操作失败");
      }
      setActionTarget(null);
      setReviewNote("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 dark:text-zinc-400">
        <Loader2 className="size-4 animate-spin" />
        加载审核列表...
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500 dark:text-zinc-400">
        <Check className="size-8 text-green-400" />
        <span>暂无待审核注册</span>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-slate-200 dark:divide-zinc-800">
        {reviews.map((record) => (
          <div key={record.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                  {record.displayName || record.loginName}
                </span>
                {statusBadge(record.reviewStatus)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                {record.email} {record.loginName ? `· @${record.loginName}` : ""}
              </div>
              <div className="text-xs text-slate-400 dark:text-zinc-500">
                注册时间: {formatDate(record.createdAt)}
              </div>
              {record.reviewNote && (
                <div className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
                  备注: {record.reviewNote}
                </div>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                onClick={() => setActionTarget({ id: record.id, action: "reject" })}
              >
                <X className="mr-1 size-3.5" />
                拒绝
              </Button>
              <Button
                size="sm"
                onClick={() => setActionTarget({ id: record.id, action: "approve" })}
              >
                <Check className="mr-1 size-3.5" />
                通过
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!actionTarget} onOpenChange={(open) => { if (!open) { setActionTarget(null); setReviewNote(""); setError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.action === "approve" ? "确认通过审核" : "确认拒绝注册"}
            </DialogTitle>
            <DialogDescription>
              {actionTarget?.action === "approve"
                ? "审核通过后，用户将可以登录其账号。"
                : "拒绝后，该用户将被删除且无法登录。此操作不可撤销。"}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              <AlertCircle className="size-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="review-note" className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              审核备注（可选）
            </label>
            <textarea
              id="review-note"
              rows={3}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="输入备注信息..."
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionTarget(null); setReviewNote(""); setError(null); }} disabled={processing}>
              取消
            </Button>
            <Button
              variant={actionTarget?.action === "reject" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  处理中
                </>
              ) : (
                actionTarget?.action === "approve" ? "确认通过" : "确认拒绝"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function statusBadge(status: string) {
  const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { label: "待审核", variant: "secondary" },
    approving: { label: "批准中", variant: "outline" },
    rejecting: { label: "拒绝中", variant: "outline" },
    approve_failed: { label: "批准失败", variant: "destructive" },
    reject_failed: { label: "拒绝失败", variant: "destructive" },
  };
  const info = variants[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
