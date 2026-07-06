"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { identityBrand } from "@/config/brand";

type CtaSectionProps = {
  user?: { email?: string | null } | null;
};

export function CtaSection({ user }: CtaSectionProps) {
  const isLoggedIn = Boolean(user);

  return (
    <section className="py-24 md:py-32 dark:bg-[#0a0a0a] bg-white px-6">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative rounded-[40px] overflow-hidden border border-black/10 dark:border-white/[0.15] shadow-2xl"
        >
          {/* Aurora Background - 改为 terracotta 配色 */}
          <div className="absolute inset-0 bg-black dark:bg-[#0d0d0d] z-0" />
          <div className="absolute inset-0 z-0 opacity-40 dark:opacity-60 mix-blend-screen filter blur-[40px] md:blur-[80px] saturate-[150%]">
            <div className="absolute top-0 -left-1/4 w-full h-full bg-terracotta rounded-full mix-blend-screen animate-aurora-1 motion-reduce:animate-none" />
            <div className="absolute top-0 left-1/4 w-full h-full bg-amber-500 rounded-full mix-blend-screen animate-aurora-2 motion-reduce:animate-none" />
            <div className="absolute -bottom-1/4 left-0 w-full h-full bg-orange-500 rounded-full mix-blend-screen animate-aurora-3 motion-reduce:animate-none" />
          </div>

          <div className="relative z-10 px-8 py-20 md:px-16 md:py-28 text-center text-white">
            <h2 className="font-artistic text-4xl md:text-6xl font-extrabold tracking-tight drop-shadow-sm mb-6">
              {isLoggedIn ? "欢迎回来，即刻启程" : "准备好重塑您的身份体系了吗？"}
            </h2>
            <p className="mx-auto max-w-2xl text-lg md:text-xl text-white/80 leading-relaxed mb-12">
              {isLoggedIn
                ? "进入账号中心，体验极简、安全与优雅的身份管理闭环。"
                : `免费注册 ${identityBrand.productName}，集中管理登录、资料、安全设置与应用授权。`}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isLoggedIn ? (
                <Button size="lg" className="rounded-full px-10 h-14 text-lg bg-white text-black hover:bg-white/90 hover:-translate-y-1 transition-[transform,box-shadow,background-color,color] duration-300 shadow-[0_0_40px_rgba(255,255,255,0.4)]" asChild>
                  <Link href="/account/overview">进入账号中心</Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" className="rounded-full px-10 h-14 text-lg bg-white text-black hover:bg-white/90 hover:-translate-y-1 transition-[transform,box-shadow,background-color,color] duration-300 shadow-[0_0_40px_rgba(255,255,255,0.4)]" asChild>
                    <Link href="/register">免费注册</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="rounded-full px-10 h-14 text-lg border-white/20 text-white bg-white/5 hover:bg-white/10 hover:text-white backdrop-blur-md transition-[transform,box-shadow,background-color,color,border-color] duration-300" asChild>
                    <Link href="/login">登录已有账号</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
