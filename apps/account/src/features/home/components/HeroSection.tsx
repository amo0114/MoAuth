"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Shield, Fingerprint, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { identityBrand } from "@/config/brand";

type HeroSectionProps = {
  user?: { email?: string | null } | null;
};

export function HeroSection({ user }: HeroSectionProps) {
  const isLoggedIn = Boolean(user);

  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Background Gradients & Grid */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center dark:bg-[#141414] bg-white" aria-hidden>
        {/* Dynamic Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        {/* Glows - 改用 terracotta 配色 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 dark:opacity-25 blur-[80px] md:blur-[120px] bg-gradient-to-b from-terracotta/40 via-terracotta-light/30 to-transparent rounded-full" />
        <div className="absolute top-20 right-1/4 w-[600px] h-[300px] opacity-15 dark:opacity-20 blur-[60px] bg-gradient-to-br from-amber-400/20 to-transparent rounded-full" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 text-center z-10">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="font-artistic text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 dark:from-white dark:to-white/60 drop-shadow-sm pb-2"
        >
          {identityBrand.productName}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-slogan mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl leading-relaxed"
        >
          登录、资料与安全设置集中在一处。接入方应用通过标准 OIDC
          完成授权，你的账号始终由你掌控。
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-col items-center gap-4"
        >
          <div className="flex flex-wrap items-center justify-center gap-4">
            {isLoggedIn ? (
              <Button size="lg" className="rounded-full px-8 h-12 text-base shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_8px_16px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_16px_-4px_rgba(255,255,255,0.1)] transition-[transform,box-shadow,background-color,color] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_12px_24px_-4px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_12px_24px_-4px_rgba(255,255,255,0.2)] hover:-translate-y-0.5" asChild>
                <Link href="/account/overview">
                  进入账号中心 <ChevronRight className="ml-1 size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button size="lg" className="rounded-full px-8 h-12 text-base shadow-lg transition-[transform,box-shadow,background-color,color] hover:shadow-xl hover:-translate-y-0.5" asChild>
                  <Link href="/register">
                    免费注册 <ChevronRight className="ml-1 size-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full px-8 h-12 text-base border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 backdrop-blur-md"
                  asChild
                >
                  <Link href="/login">登录</Link>
                </Button>
              </>
            )}
          </div>

          {/* Social Proof */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-sm text-muted-foreground flex items-center gap-2"
          >
            <span className="flex items-center">
              <Shield className="size-4 mr-1.5 text-primary" />
              标准 OIDC + PKCE
            </span>
            <span className="text-border">·</span>
            <span>前端体验与底层认证解耦</span>
            <span className="text-border">·</span>
            <span>企业级安全保证</span>
          </motion.p>
        </motion.div>

        {/* 3D Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 18, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, rotateX: 15, scale: 1 }}
          whileHover={{
            y: -8,
            rotateX: 12,
            scale: 1.01,
            transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
          }}
          transition={{
            duration: 1.2,
            delay: 0.5,
            type: "spring",
            bounce: 0.15,
            stiffness: 80,
            damping: 20
          }}
          style={{ perspective: "1200px" }}
          className="mx-auto mt-20 max-w-4xl relative cursor-pointer"
        >
          <div
            className="w-full rounded-2xl border border-black/10 dark:border-white/[0.15] bg-white/40 dark:bg-[#1a1a1a]/80 backdrop-blur-md md:backdrop-blur-xl shadow-2xl overflow-hidden"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Mock Header */}
            <div className="flex items-center px-4 py-3 border-b border-black/5 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.03]">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-red-400/80" />
                <div className="size-3 rounded-full bg-amber-400/80" />
                <div className="size-3 rounded-full bg-green-400/80" />
              </div>
              <div className="mx-auto h-5 w-32 sm:w-48 rounded-md bg-black/5 dark:bg-white/[0.06]" />
            </div>
            {/* Mock Body */}
            <div className="p-4 sm:p-6 flex flex-col md:grid md:grid-cols-3 gap-4 sm:gap-6">
              <div className="md:col-span-1 space-y-4">
                {/* User Profile Card */}
                <div className="rounded-xl border border-black/5 dark:border-white/[0.12] bg-white/60 dark:bg-[#1f1f1f]/90 p-4 sm:p-5 shadow-sm backdrop-blur-md">
                  <div className="flex items-center gap-3 sm:gap-4 mb-4">
                    <div className="size-10 sm:size-12 shrink-0 rounded-full bg-gradient-to-tr from-primary via-primary/80 to-primary/60 flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg relative overflow-hidden group">
                      {/* Animated shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                      <span className="relative z-10">A</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-black dark:text-white truncate">Alice Smith</div>
                      <div className="text-xs text-muted-foreground truncate">alice@example.com</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">账号状态</span>
                      <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-green-500 animate-pulse"></span> 正常
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">成员组</span>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Developer</span>
                    </div>
                  </div>
                </div>

                {/* Authentication Methods */}
                <div className="rounded-xl border border-black/5 dark:border-white/[0.12] bg-white/40 dark:bg-[#1f1f1f]/70 p-4 sm:p-5 shadow-sm">
                  <div className="text-xs font-semibold text-black/70 dark:text-white/70 mb-3 flex items-center gap-2">
                    <Fingerprint className="size-3.5" /> 认证方式
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-black/80 dark:text-white/80">
                        <Lock className="size-3.5 text-muted-foreground" /> 密码登录
                      </div>
                      <div className="text-[10px] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded text-muted-foreground shrink-0">已开启</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-black/80 dark:text-white/80">
                        <Shield className="size-3.5 text-primary" /> Passkey
                      </div>
                      <div className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-medium shrink-0">规划中</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-4">
                {/* Security Score */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className="rounded-xl border border-black/5 dark:border-white/[0.12] bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 p-4 sm:p-5 flex items-center justify-between shadow-sm hover:scale-[1.02] hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 shrink-0 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                      <Shield className="size-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">安全建议: 基础保护已启用</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">密码、会话与应用授权集中管理</div>
                    </div>
                  </div>
                  <div className="text-2xl font-black text-primary">98</div>
                </motion.div>

                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
                  {/* Recent Activity */}
                  <div className="rounded-xl border border-black/5 dark:border-white/[0.12] bg-white/60 dark:bg-[#1f1f1f]/90 p-5 shadow-sm backdrop-blur-md hover:-translate-y-1 transition-transform duration-300">
                    <div className="text-xs font-semibold text-black/70 dark:text-white/70 mb-3">最近活动</div>
                    <div className="space-y-3 relative before:absolute before:inset-y-2 before:left-[5px] before:w-px before:bg-black/10 dark:before:bg-white/[0.12]">
                      <div className="flex gap-3 relative">
                        <div className="size-2.5 rounded-full bg-green-500 ring-4 ring-white dark:ring-[#1f1f1f] z-10 mt-0.5" />
                        <div>
                          <div className="text-xs font-medium text-black dark:text-white">登录成功</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Mac OS · Chrome · 上海</div>
                        </div>
                      </div>
                      <div className="flex gap-3 relative">
                        <div className="size-2.5 rounded-full bg-black/20 dark:bg-white/20 ring-4 ring-white dark:ring-[#1f1f1f] z-10 mt-0.5" />
                        <div>
                          <div className="text-xs font-medium text-black dark:text-white">修改密码</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">2 天前</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Authorized Apps */}
                  <div className="rounded-xl border border-black/5 dark:border-white/[0.12] bg-white/60 dark:bg-[#1f1f1f]/90 p-5 shadow-sm backdrop-blur-md hover:-translate-y-1 transition-transform duration-300">
                    <div className="text-xs font-semibold text-black/70 dark:text-white/70 mb-3">已授权应用</div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-xs">SB</div>
                        <div>
                          <div className="text-xs font-medium text-black dark:text-white">SubBoost</div>
                          <div className="text-[10px] text-muted-foreground">OIDC · 刚刚</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-xs">Ex</div>
                        <div>
                          <div className="text-xs font-medium text-black dark:text-white">Example App</div>
                          <div className="text-[10px] text-muted-foreground">OIDC · 昨天</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Bottom Gradient Fade */}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-black dark:via-black/80 z-10" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
