"use client";

import { useState } from "react";
import { Loader2, LockKeyhole, ShieldCheck, Fingerprint } from "lucide-react";

import { getUserFriendlyErrorMessage } from "../../../lib/errors";
import { cn } from "../../../lib/utils.js";
import { changePassword } from "../api/changePassword";
import { getSecuritySummary } from "../api/getSecuritySummary";
import { useCenterResource } from "../hooks/useCenterResource";
import type { AccountUser } from "../types";
import { AccountCenterShell } from "./AccountCenterShell";
import { SectionPageLayout } from "../../../components/layout/SectionPageLayout";
import { CardGroup, Row, Divider, LiquidButton } from "./AccountUI";

export function AccountSecurity({ user }: { user: AccountUser }) {
  const { data, error, loading } = useCenterResource(getSecuritySummary);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordNotice, setPasswordNotice] = useState<{
    tone: "danger" | "info";
    message: string;
  } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  return (
    <AccountCenterShell user={user} activePath="/account/security">
      <SectionPageLayout
        title={<span className="font-heading text-3xl">登录与<span className="font-artistic text-[#C4612F]">安全</span></span>}
        description="管理您的密码、多因素认证与 Passkey"
        breadcrumbs={[{ label: "账户中心", href: "/account/overview" }, "登录与安全"]}
        maxWidth="5xl"
      >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-[#5C635D]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : null}

          {error ? (
            <div className="mb-6 px-5 py-4 rounded-2xl text-sm font-medium border-[1.5px] border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-sm">
              {error}
            </div>
          ) : null}

          {data ? (
            <>
              <CardGroup title="密码管理" delayIndex={1}>
                {!isChanging ? (
                  <Row
                    icon={<LockKeyhole className="w-5 h-5" />}
                    label="密码状态"
                    description="定期更新密码有助于保护账户安全"
                    value={data.password?.set ? "已设置" : "未设置"}
                    action={
                      <LiquidButton variant="secondary" onClick={() => setIsChanging(true)} className="px-5">
                        修改密码
                      </LiquidButton>
                    }
                  />
                ) : (
                  <form
                    className="p-7 space-y-5 bg-[#FBF9F5] dark:bg-zinc-800/50"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setChangingPassword(true);
                      setPasswordNotice(null);
                      try {
                        await changePassword({ currentPassword, newPassword });
                        setCurrentPassword("");
                        setNewPassword("");
                        setPasswordNotice({ tone: "info", message: "密码已更新。" });
                        setTimeout(() => setIsChanging(false), 2000);
                      } catch (cause) {
                        setPasswordNotice({
                          tone: "danger",
                          message: getUserFriendlyErrorMessage(cause),
                        });
                      } finally {
                        setChangingPassword(false);
                      }
                    }}
                  >
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-sm text-[#1F2421] dark:text-zinc-300 font-semibold" htmlFor="security-current-password">当前密码</label>
                        <input
                          id="security-current-password"
                          type="password"
                          value={currentPassword}
                          onChange={(event) => setCurrentPassword(event.target.value)}
                          required
                          className="w-full h-11 px-4 bg-white dark:bg-zinc-900 border-[1.5px] border-[#E7E1D7] dark:border-zinc-700 rounded-xl text-sm text-[#1F2421] dark:text-zinc-100 transition-all focus:outline-none focus:border-[#C4612F] focus:ring-2 focus:ring-[#C4612F]/20 shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-[#1F2421] dark:text-zinc-300 font-semibold" htmlFor="security-new-password">新密码</label>
                        <input
                          id="security-new-password"
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          required
                          className="w-full h-11 px-4 bg-white dark:bg-zinc-900 border-[1.5px] border-[#E7E1D7] dark:border-zinc-700 rounded-xl text-sm text-[#1F2421] dark:text-zinc-100 transition-all focus:outline-none focus:border-[#C4612F] focus:ring-2 focus:ring-[#C4612F]/20 shadow-sm"
                        />
                      </div>
                    </div>

                    {passwordNotice ? (
                      <div className={cn(
                        "px-5 py-4 rounded-2xl text-sm font-medium border-[1.5px] shadow-sm",
                        passwordNotice.tone === "info"
                          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-900/50 text-red-700 dark:text-red-400"
                      )}>
                        {passwordNotice.message}
                      </div>
                    ) : null}

                    <div className="pt-4 flex justify-end gap-3">
                      <LiquidButton type="button" variant="secondary" onClick={() => {
                        setIsChanging(false);
                        setPasswordNotice(null);
                      }} disabled={changingPassword}>
                        取消
                      </LiquidButton>
                      <LiquidButton type="submit" disabled={changingPassword}>
                        {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存更改"}
                      </LiquidButton>
                    </div>
                  </form>
                )}
              </CardGroup>

              <CardGroup title="高级安全" footer="相关安全功能将在后续版本更替中全面开放。" delayIndex={2}>
                <Row
                  icon={<ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />}
                  label="多因素认证 (MFA)"
                  description="为账户增加一层额外的安全保护"
                  value={data.mfa?.enabled ? "已启用" : "未启用"}
                  action={
                    <LiquidButton variant="secondary" className="opacity-50 cursor-not-allowed px-5 text-[13px]" disabled>
                      即将推出
                    </LiquidButton>
                  }
                />
                <Divider />
                <Row
                  icon={<Fingerprint className="w-5 h-5 text-indigo-500" />}
                  label="Passkey"
                  description="使用指纹、面容或设备 PIN 码更安全地登录"
                  value={`${data.passkeys?.count ?? 0} 个设备`}
                  action={
                    <LiquidButton variant="secondary" className="opacity-50 cursor-not-allowed px-5 text-[13px]" disabled>
                      即将推出
                    </LiquidButton>
                  }
                />
              </CardGroup>
            </>
          ) : null}
        </div>

        <div className="space-y-6">
          <CardGroup title="安全建议" delayIndex={3} className="sticky top-24">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">强密码建议</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    使用至少 12 位字符，包含大小写字母、数字和特殊符号。
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C4612F] mt-1.5 shrink-0"></div>
                  <p className="text-[#5C635D] dark:text-zinc-400 leading-relaxed">
                    避免在多个账户使用相同密码
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C4612F] mt-1.5 shrink-0"></div>
                  <p className="text-[#5C635D] dark:text-zinc-400 leading-relaxed">
                    建议每 3-6 个月更换一次密码
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C4612F] mt-1.5 shrink-0"></div>
                  <p className="text-[#5C635D] dark:text-zinc-400 leading-relaxed">
                    启用 MFA 可大幅提升账户安全性
                  </p>
                </div>
              </div>
            </div>
          </CardGroup>

          <CardGroup title="最近登录" delayIndex={4}>
            <div className="p-6 space-y-3">
              <div className="flex items-start gap-3 pb-3 border-b border-[#E7E1D7] dark:border-zinc-800">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 animate-gentle-pulse"></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1F2421] dark:text-zinc-200">当前会话</p>
                  <p className="text-xs text-[#5C635D] dark:text-zinc-400 mt-1">Chrome · 上海</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#5C635D] mt-1.5"></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1F2421] dark:text-zinc-200">昨天 14:20</p>
                  <p className="text-xs text-[#5C635D] dark:text-zinc-400 mt-1">Safari · 北京</p>
                </div>
              </div>
            </div>
          </CardGroup>
        </div>
      </div>
      </SectionPageLayout>
    </AccountCenterShell>
  );
}