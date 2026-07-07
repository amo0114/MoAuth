"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Fingerprint } from "lucide-react";

import { BrandLogo } from "../../../components/brand/BrandLogo";

import { cn } from "../../../lib/utils.js";
import { getAccountPublicErrorMessage } from "../../../ui/account-public-error-message.js";
import { loginSchema } from "../schemas";
import type { LoginExistingUser } from "../types";
import { AuthLayout } from "./AuthLayout";
import { LoginAuthenticatingOverlay } from "./LoginAuthenticatingOverlay";

interface LoginPageProps {
  productName: string;
  authRequestId?: string;
  clientName?: string | null;
  existingUser?: LoginExistingUser | null;
  registered?: boolean;
  passwordReset?: boolean;
  gatewayName?: string;
}

export function LoginPage({
  productName,
  authRequestId = "",
  clientName = null,
  existingUser = null,
  registered = false,
  passwordReset = false,
  gatewayName = "Connect",
}: LoginPageProps) {
  const [notice, setNotice] = useState(
    registered
      ? { tone: "info", message: "注册与邮箱验证已完成，请登录以继续。" }
      : passwordReset
        ? { tone: "info", message: "密码已重置，请使用新密码登录。" }
        : null
  );
  const [continuing, setContinuing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(!existingUser);
  const [isShaking, setIsShaking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authPhase, setAuthPhase] = useState(0);

  // 核心：成功态动画开关
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      loginName: "",
      password: "",
    },
  });

  const isHandoffLogin = Boolean(authRequestId);
  const canContinueWithSession = Boolean(isHandoffLogin && existingUser);
  const submitting = form.formState.isSubmitting;
  const isAuthenticating = (submitting || continuing) && !isSuccess;

  useEffect(() => {
    if (!isAuthenticating) {
      setAuthPhase(0);
      return;
    }

    const timer = window.setInterval(() => {
      setAuthPhase((current) => current + 1);
    }, 480);

    return () => window.clearInterval(timer);
  }, [isAuthenticating]);

  function triggerError(message: string) {
    setNotice({ tone: "danger", message });
    setIsShaking(false);
    setTimeout(() => setIsShaking(true), 10);
  }

  async function handleContinueWithSession() {
    setNotice(null);
    setContinuing(true);
    try {
      const response = await fetch("/api/login/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authRequestId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        triggerError(getAccountPublicErrorMessage(data?.error?.code, "continueLogin"));
        setShowPasswordForm(true);
        setContinuing(false);
        return;
      }

      // 触发成功态动画
      triggerSuccessAnimation(data.redirectUrl);
    } catch {
      triggerError(getAccountPublicErrorMessage(null, "continueLogin"));
      setContinuing(false);
    }
  }

  async function onSubmit(values: { loginName: string; password: string }) {
    setNotice(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(authRequestId ? { authRequestId } : {}),
          loginName: values.loginName.trim(),
          password: values.password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        triggerError(getAccountPublicErrorMessage(data?.error?.code, "login"));
        return;
      }

      // 触发成功态动画
      triggerSuccessAnimation(data.redirectUrl);
    } catch {
      triggerError(getAccountPublicErrorMessage(null, "login"));
    }
  }

  function triggerSuccessAnimation(redirectUrl?: string) {
    setIsSuccess(true);
    // 延迟等待指纹发光和表单消散的动画完成 (800ms) 后再跳转
    setTimeout(() => {
      if (redirectUrl) {
        window.location.assign(redirectUrl);
      } else {
        window.location.reload();
      }
    }, 1000);
  }

  return (
    <AuthLayout>
      {/* 卡片主体 */}
      <div
        className={cn(
          "w-full max-w-[420px] bg-white/10 backdrop-blur-[32px] rounded-[28px] px-6 py-8 sm:p-12 z-10",
          "border border-white/30",
          "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1),0_24px_64px_-12px_rgba(0,0,0,0.15)]",
          isShaking && "animate-shake",
          "transition-all duration-500 ease-out",
          isSuccess && "scale-[1.02] shadow-[0_24px_80px_-12px_rgba(0,122,255,0.15)] bg-white/30"
        )}
      >

        {/* Header 区域：验证中与成功态时收敛，把视觉重心交给动画层 */}
        <div
          className={cn(
            "relative mb-8 flex flex-col items-center sm:mb-10",
            "transition-all duration-500",
            isAuthenticating || isSuccess ? "mb-0 max-h-0 overflow-hidden opacity-0" : "opacity-100"
          )}
        >
          <div className="relative z-20 mb-6 flex h-16 w-16 items-center justify-center">
            <BrandLogo size={60} priority variant="light" className="drop-shadow-md" />
          </div>

          <div className="flex flex-col items-center">
            <h1 className="font-artistic mb-2 text-[26px] font-medium leading-tight tracking-tight text-[#1D1D1F] drop-shadow-sm">
              {productName}
            </h1>
            <p className="font-slogan mt-1 text-center text-[15px] font-medium tracking-widest text-[#1D1D1F]/80 drop-shadow-sm">
              {isHandoffLogin
                ? clientName
                  ? `登录后将继续前往 ${clientName}。`
                  : `登录后将继续前往 ${gatewayName}。`
                : "入本源，见真知。"}
            </p>
          </div>
        </div>

        {isAuthenticating ? (
          <LoginAuthenticatingOverlay
            isHandoffLogin={isHandoffLogin}
            gatewayName={gatewayName}
            phase={authPhase}
          />
        ) : null}

        {isSuccess ? (
          <div className="flex flex-col items-center py-8 sm:py-10">
            <div className="relative z-20 mb-4 flex h-[88px] w-[88px] translate-y-2 scale-[1.35] items-center justify-center rounded-full border border-[#007AFF]/30 bg-white/80 shadow-[0_0_40px_rgba(0,122,255,0.3)] backdrop-blur-md transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
              <Fingerprint
                className="h-10 w-10 text-[#007AFF] drop-shadow-[0_0_8px_rgba(0,122,255,0.6)]"
                strokeWidth={1.5}
              />
            </div>
            <p className="text-[17px] font-medium tracking-tight text-[#007AFF] auth-phase-enter">
              {isHandoffLogin ? "验证成功，正在继续" : "验证成功"}
            </p>
          </div>
        ) : null}

        {/* 表单与交互内容区 */}
        <div
          className={cn(
            "transition-all duration-500",
            isAuthenticating || isSuccess
              ? "pointer-events-none max-h-0 overflow-hidden opacity-0"
              : "opacity-100"
          )}
        >
          {/* 错误提示：柔和的红色系 */}
          {notice && (
            <div className={cn(
              "mb-6 p-3.5 border rounded-[14px] flex items-center gap-3 transition-all duration-300 ease-out backdrop-blur-md",
              notice.tone === "danger" ? "bg-[#FFF0F0]/60 border-[#FFD4D4]/50 text-[#E30000]" : "bg-blue-50/40 border-blue-100/50 text-[#007AFF]"
            )}>
               <div className="text-[14px] font-medium leading-normal tracking-tight">
                 {notice.message}
               </div>
            </div>
          )}

          {canContinueWithSession && !showPasswordForm ? (
             <div className="space-y-4">
               <div className="p-4 rounded-[16px] border border-white/30 bg-white/20 backdrop-blur-md text-center shadow-sm">
                 <strong className="block text-[15px] font-semibold text-[#1D1D1F] mb-1">{existingUser?.loginName}</strong>
                 <span className="text-[13px] text-[#1D1D1F]/80 font-medium">{existingUser?.email || existingUser?.sub}</span>
               </div>
               <div className="space-y-3">
                 <button
                   type="button"
                   disabled={continuing}
                   onClick={handleContinueWithSession}
                   className={cn(
                     "w-full h-12 flex items-center justify-center gap-2 rounded-[14px] text-[17px] font-semibold text-white tracking-[-0.01em]",
                     "transition-all duration-200 ease-out shadow-sm",
                     continuing ? "bg-[#007AFF]/70 cursor-wait" : "bg-[#007AFF]/80 backdrop-blur-md hover:bg-[#0071EB] active:scale-[0.98]"
                   )}
                 >
                   继续
                 </button>
                 <button
                   type="button"
                   onClick={() => setShowPasswordForm(true)}
                   className="w-full h-12 flex items-center justify-center rounded-[14px] text-[15px] font-medium text-[#1D1D1F] border border-white/40 bg-white/20 backdrop-blur-md hover:bg-white/30 active:scale-[0.98] transition-all shadow-sm"
                 >
                   使用其他账户
                 </button>
               </div>
             </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
              {/* 账号输入 */}
              <div className="space-y-2">
                <label htmlFor="login-name" className="block text-[13px] font-semibold text-[#1D1D1F]/90 ml-1 drop-shadow-sm">
                  邮箱或用户名
                </label>
                <div className="relative">
                  <input
                    id="login-name"
                    type="text"
                    {...form.register("loginName")}
                    placeholder="name@example.com"
                    className={cn(
                      "w-full h-12 px-4 bg-white/20 backdrop-blur-md border border-white/30 rounded-[14px] shadow-sm",
                      "text-[17px] text-[#1D1D1F] placeholder:text-[#1D1D1F]/60 font-medium",
                      "transition-all duration-200 ease-out",
                      "focus:bg-white/40 focus:outline-none focus:border-[#007AFF]/60 focus:ring-[3px] focus:ring-[#007AFF]/20",
                      "hover:border-white/40 hover:bg-white/30",
                      form.formState.errors.loginName && "border-[#E30000]/60 focus:border-[#E30000] focus:ring-[#E30000]/20"
                    )}
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* 密码输入 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1 mr-1">
                  <label htmlFor="login-password" className="block text-[13px] font-semibold text-[#1D1D1F]/90 drop-shadow-sm">
                    密码
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    {...form.register("password")}
                    placeholder="••••••••"
                    className={cn(
                      "w-full h-12 pl-4 pr-12 bg-white/20 backdrop-blur-md border border-white/30 rounded-[14px] shadow-sm",
                      "text-[17px] text-[#1D1D1F] placeholder:text-[#1D1D1F]/60 font-medium",
                      "transition-all duration-200 ease-out",
                      "focus:bg-white/40 focus:outline-none focus:border-[#007AFF]/60 focus:ring-[3px] focus:ring-[#007AFF]/20",
                      "hover:border-white/40 hover:bg-white/30",
                      form.formState.errors.password && "border-[#E30000]/60 focus:border-[#E30000] focus:ring-[#E30000]/20"
                    )}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#1D1D1F]/70 hover:text-[#1D1D1F] focus:outline-none rounded-full hover:bg-white/20 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-[18px] h-[18px]" strokeWidth={1.5} />
                    ) : (
                      <Eye className="w-[18px] h-[18px]" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    "w-full h-12 flex items-center justify-center gap-2 rounded-[14px] text-[17px] font-semibold text-white tracking-[-0.01em]",
                    "transition-all duration-200 ease-out shadow-sm",
                    submitting ? "bg-[#007AFF]/70 cursor-wait" : "bg-[#007AFF]/80 backdrop-blur-md hover:bg-[#0071EB] active:scale-[0.98]"
                  )}
                >
                  {isHandoffLogin ? "登录并继续" : "继续"}
                </button>
              </div>
            </form>
          )}

          {/* 底部辅助操作：完全居中对称 */}
          <div className="mt-8 sm:mt-10 flex flex-col items-center gap-4 text-[14px]">
            <a href={buildForgotPasswordHref(authRequestId)} className="text-[#007AFF] hover:underline hover:text-[#0071EB] font-medium transition-colors tracking-tight drop-shadow-sm">
              忘记了密码？
            </a>
            <div className="flex items-center gap-1.5 text-[#1D1D1F]/80 font-medium tracking-tight drop-shadow-sm">
              <span>没有账户？</span>
              <a href={buildRegisterHref(authRequestId)} className="text-[#007AFF] hover:underline hover:text-[#0071EB] transition-colors">
                立即创建
              </a>
            </div>
          </div>
        </div>
      </div>

    </AuthLayout>
  );
}

function buildAuthContextHref(pathname: string, authRequestId: string) {
  const params = new URLSearchParams();
  if (authRequestId) params.set("auth_request", authRequestId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function buildRegisterHref(authRequestId: string) {
  return buildAuthContextHref("/register", authRequestId);
}

function buildForgotPasswordHref(authRequestId: string) {
  return buildAuthContextHref("/forgot-password", authRequestId);
}
