"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { BrandLogo } from "../components/brand/BrandLogo";
import { AuthLayout } from "../features/auth/components/AuthLayout";
import { cn } from "../lib/utils.js";
import {
  getAccountPublicErrorMessage,
  getRegistrationModeNotice,
} from "./account-public-error-message.js";

export function AccountRegisterPage({ productName, authRequestId = "", registrationMode = "open" }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [notice, setNotice] = useState(() => getRegistrationModeNotice(registrationMode));
  const [submitting, setSubmitting] = useState(false);
  const registrationClosed = registrationMode === "closed";
  const inviteRequired = registrationMode === "invite";
  const modeNotice = getRegistrationModeNotice(registrationMode);

  async function handleSubmit(event) {
    event.preventDefault();
    if (registrationClosed) {
      setNotice(getRegistrationModeNotice("closed"));
      return;
    }
    setNotice(modeNotice);
    setSubmitting(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          password,
          inviteCode: inviteCode.trim() || undefined,
          ...(authRequestId ? { authRequestId } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorCode = data?.error?.code;
        setNotice({ tone: "danger", message: getAccountPublicErrorMessage(errorCode, "registration") });
        return;
      }

      if (data.dev?.emailVerificationCode) {
        setNotice({
          tone: "info",
          message: `开发模式验证码：${data.dev.emailVerificationCode}`,
        });
      }

      if (data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }

      if (data.status === "PENDING_REVIEW") {
        setPassword("");
        setNotice({
          tone: "info",
          message: "注册申请已提交，等待管理员审核。审核通过后即可登录。",
        });
        return;
      }
    } catch {
      setNotice({ tone: "danger", message: getAccountPublicErrorMessage(null, "registration") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <section
        className={cn(
          "w-full rounded-[28px] border border-white/30 bg-white/10 px-6 py-8 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1),0_24px_64px_-12px_rgba(0,0,0,0.15)] backdrop-blur-[32px] sm:p-12",
          "transition-[background-color,border-color,box-shadow,transform] duration-500 ease-out"
        )}
      >
        <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
          <div className="mb-6 flex h-16 w-16 items-center justify-center">
            <BrandLogo size={60} priority variant="light" className="drop-shadow-md" />
          </div>
          <h1 className="mb-2 text-[26px] font-medium leading-tight tracking-tight text-[#1D1D1F] drop-shadow-sm font-artistic">
            创建 {productName} 账号
          </h1>
          <p className="text-center text-[15px] font-medium leading-relaxed tracking-wide text-[#1D1D1F]/80 drop-shadow-sm">
            {registrationClosed
              ? "管理员已关闭新账号注册。"
              : inviteRequired
                ? "请输入有效邀请码完成注册。"
                : registrationMode === "review"
                  ? "提交后需等待管理员审核。"
                  : "注册后请验证邮箱。"}
            {!registrationClosed && authRequestId ? "验证完成后将返回登录并继续业务应用授权。" : ""}
          </p>
        </div>

        {notice ? (
          <div
            className={cn(
              "mb-6 rounded-[14px] border p-3.5 text-[14px] font-medium leading-normal tracking-tight backdrop-blur-md transition-all duration-300 ease-out",
              notice.tone === "danger"
                ? "border-[#FFD4D4]/50 bg-[#FFF0F0]/60 text-[#E30000]"
                : "border-blue-100/50 bg-blue-50/40 text-[#007AFF]"
            )}
          >
            {notice.message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          <div className="space-y-2">
            <label htmlFor="register-email" className="ml-1 block text-[13px] font-semibold text-[#1D1D1F]/90 drop-shadow-sm">
              邮箱
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="h-12 w-full rounded-[14px] border border-white/30 bg-white/20 px-4 text-[17px] font-medium text-[#1D1D1F] shadow-sm backdrop-blur-md transition-all duration-200 ease-out placeholder:text-[#1D1D1F]/60 hover:border-white/40 hover:bg-white/30 focus:border-[#007AFF]/60 focus:bg-white/40 focus:outline-none focus:ring-[3px] focus:ring-[#007AFF]/20"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="register-display-name" className="ml-1 block text-[13px] font-semibold text-[#1D1D1F]/90 drop-shadow-sm">
              显示名
            </label>
            <input
              id="register-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Alice Wonderland"
              className="h-12 w-full rounded-[14px] border border-white/30 bg-white/20 px-4 text-[17px] font-medium text-[#1D1D1F] shadow-sm backdrop-blur-md transition-all duration-200 ease-out placeholder:text-[#1D1D1F]/60 hover:border-white/40 hover:bg-white/30 focus:border-[#007AFF]/60 focus:bg-white/40 focus:outline-none focus:ring-[3px] focus:ring-[#007AFF]/20"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="register-invite-code" className="ml-1 block text-[13px] font-semibold text-[#1D1D1F]/90 drop-shadow-sm">
              邀请码 <span className="font-normal text-[#1D1D1F]/50">{inviteRequired ? "（必填）" : "（如有）"}</span>
            </label>
            <input
              id="register-invite-code"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="MOAUTH-XXXXXXXX"
              className="h-12 w-full rounded-[14px] border border-white/30 bg-white/20 px-4 text-[17px] font-medium text-[#1D1D1F] shadow-sm backdrop-blur-md transition-all duration-200 ease-out placeholder:text-[#1D1D1F]/60 hover:border-white/40 hover:bg-white/30 focus:border-[#007AFF]/60 focus:bg-white/40 focus:outline-none focus:ring-[3px] focus:ring-[#007AFF]/20"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="register-password" className="ml-1 block text-[13px] font-semibold text-[#1D1D1F]/90 drop-shadow-sm">
              密码
            </label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="h-12 w-full rounded-[14px] border border-white/30 bg-white/20 px-4 text-[17px] font-medium text-[#1D1D1F] shadow-sm backdrop-blur-md transition-all duration-200 ease-out placeholder:text-[#1D1D1F]/60 hover:border-white/40 hover:bg-white/30 focus:border-[#007AFF]/60 focus:bg-white/40 focus:outline-none focus:ring-[3px] focus:ring-[#007AFF]/20"
            />
          </div>

          <div className="pt-2">
            <button
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[17px] font-semibold tracking-[-0.01em] text-white shadow-sm transition-all duration-200 ease-out",
                submitting || registrationClosed ? "cursor-not-allowed bg-[#007AFF]/50" : "bg-[#007AFF]/80 backdrop-blur-md hover:bg-[#0071EB] active:scale-[0.98]"
              )}
              type="submit"
              disabled={submitting || registrationClosed}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-[20px] w-[20px] animate-spin text-white/80" />
                  注册中
                </>
              ) : registrationClosed ? (
                "暂不开放注册"
              ) : (
                "创建账号"
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 flex justify-center text-[14px] sm:mt-10">
          <a
            href={buildAuthHref("/login", authRequestId)}
            className="font-medium tracking-tight text-[#007AFF] drop-shadow-sm transition-colors hover:text-[#0071EB] hover:underline"
          >
            已有账号？去登录
          </a>
        </div>
      </section>
    </AuthLayout>
  );
}

function buildAuthHref(pathname, authRequestId) {
  if (!authRequestId) return pathname;
  return `${pathname}?auth_request=${encodeURIComponent(authRequestId)}`;
}
