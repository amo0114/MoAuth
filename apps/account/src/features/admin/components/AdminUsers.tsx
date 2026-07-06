"use client";

import * as React from "react";
import { Users, Search, MoreHorizontal, ShieldCheck, Loader2 } from "lucide-react";

import { cn } from "../../../lib/utils.js";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";
import type { AccountUser } from "../../account/types";

interface AdminUsersProps {
  user: AccountUser;
  children?: React.ReactNode;
}

type User = {
  id: string;
  loginName: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  status: "active" | "disabled" | "pending";
  isAdmin: boolean;
  state: string;
  createdAt: string | null;
  updatedAt: string | null;
};

const STATUS_LABEL: Record<User["status"], string> = {
  active: "正常",
  pending: "待激活",
  disabled: "已禁用",
};

const STATUS_VARIANT: Record<User["status"], "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  disabled: "outline",
};

export function AdminUsers({ user: _user }: AdminUsersProps) {
  const [query, setQuery] = React.useState("");
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/admin/users");

        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.statusText}`);
        }

        const data = await response.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error("Failed to load users:", err);
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return users;
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.loginName.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q)
    );
  }, [query, users]);

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }

  return (
    <SectionPageLayout
      maxWidth="7xl"
      breadcrumbs={[
        { label: "管理后台", href: "/admin/users" },
        { label: "用户管理" },
      ]}
      title="用户管理"
      description="查看与管理已注册账户，支持搜索、禁用与权限调整。"
      actions={
        <Button size="sm">
          <Users className="mr-1.5 size-4" />
          新建用户
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索登录名 / 邮箱 / ID"
              className="pl-8"
              disabled={loading}
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            共 {filtered.length} 条
          </span>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            加载用户列表失败：{error}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">ID</TableHead>
                <TableHead>登录名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="w-[100px]">角色</TableHead>
                <TableHead className="w-[160px]">创建时间</TableHead>
                <TableHead className="w-[60px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-sm text-slate-500 dark:text-zinc-400"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      加载中...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-sm text-slate-500 dark:text-zinc-400"
                  >
                    {query ? "没有匹配的用户" : "暂无用户"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs text-slate-500 dark:text-zinc-400">
                      {row.id}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900 dark:text-zinc-100">
                      {row.displayName}
                      {row.displayName !== row.loginName && (
                        <div className="text-xs text-slate-500 dark:text-zinc-400">
                          @{row.loginName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-zinc-300">
                      {row.email || "—"}
                      {row.email && !row.emailVerified && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          未验证
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.isAdmin ? (
                        <Badge variant="outline" className="gap-1">
                          <ShieldCheck className="size-3.5" />
                          管理员
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-zinc-400">
                          用户
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-zinc-400">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>账户操作</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>查看详情</DropdownMenuItem>
                          <DropdownMenuItem>重置密码</DropdownMenuItem>
                          <DropdownMenuItem>
                            {row.isAdmin ? "取消管理员" : "设为管理员"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className={cn(
                              "text-red-600 dark:text-red-400",
                              "focus:text-red-700 dark:focus:text-red-300"
                            )}
                          >
                            {row.status === "disabled" ? "启用账户" : "禁用账户"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </SectionPageLayout>
  );
}
