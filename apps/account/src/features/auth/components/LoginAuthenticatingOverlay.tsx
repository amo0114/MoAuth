"use client";

import { Fingerprint } from "lucide-react";

import { cn } from "../../../lib/utils.js";

const HANDOFF_PHASES = [
  "正在验证身份",
  "建立安全连接",
  "准备继续",
] as const;

const STANDALONE_PHASES = [
  "正在验证身份",
  "同步账户信息",
  "即将进入",
] as const;

interface LoginAuthenticatingOverlayProps {
  isHandoffLogin: boolean;
  gatewayName?: string;
  phase: number;
  className?: string;
}

export function LoginAuthenticatingOverlay({
  isHandoffLogin,
  gatewayName = "Connect",
  phase,
  className,
}: LoginAuthenticatingOverlayProps) {
  const phases = isHandoffLogin ? HANDOFF_PHASES : STANDALONE_PHASES;
  const activePhase = phases[phase % phases.length];
  const subtitle = isHandoffLogin
    ? `正在连接至 ${gatewayName}，请稍候`
    : "正在进入账户中心";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-6 sm:py-8 animate-fade-in-up fill-mode-both",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative mb-8 flex h-[120px] w-[120px] items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-[#007AFF]/20 auth-ripple auth-ripple-delay-1" />
        <span className="absolute inset-2 rounded-full border border-[#007AFF]/25 auth-ripple auth-ripple-delay-2" />
        <span className="absolute inset-4 rounded-full border border-[#007AFF]/30 auth-ripple auth-ripple-delay-3" />

        <span className="absolute h-[88px] w-[88px] rounded-full auth-orbit-ring">
          <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#007AFF]/80 shadow-[0_0_12px_rgba(0,122,255,0.8)]" />
        </span>
        <span className="absolute h-[104px] w-[104px] rounded-full auth-orbit-ring-reverse">
          <span className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#007AFF]/50" />
        </span>

        <div
          className={cn(
            "relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full",
            "border border-white/50 bg-white/50 backdrop-blur-md",
            "shadow-[0_8px_32px_rgba(0,122,255,0.18)] auth-glow-pulse"
          )}
        >
          <Fingerprint className="h-9 w-9 text-[#007AFF]" strokeWidth={1.25} />
        </div>
      </div>

      <div className="mb-6 flex min-h-[52px] flex-col items-center justify-center text-center">
        <p key={activePhase} className="auth-phase-enter text-[18px] font-medium tracking-tight text-[#1D1D1F]">
          {activePhase}
          <span className="inline-flex w-[1.25em] justify-start" aria-hidden="true">
            <span className="auth-dot auth-dot-1">.</span>
            <span className="auth-dot auth-dot-2">.</span>
            <span className="auth-dot auth-dot-3">.</span>
          </span>
        </p>
        <p className="mt-2 text-[14px] font-medium tracking-wide text-[#1D1D1F]/65">{subtitle}</p>
      </div>

      <div className="h-1 w-full max-w-[240px] overflow-hidden rounded-full bg-white/30 backdrop-blur-sm">
        <div className="h-full w-full rounded-full auth-progress-shimmer" />
      </div>
    </div>
  );
}