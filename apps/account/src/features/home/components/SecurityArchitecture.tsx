"use client";

import { motion } from "framer-motion";
import { Shield, Fingerprint, ShieldCheck, Activity } from "lucide-react";

const securityFeatures = [
  {
    icon: Fingerprint,
    title: "即将推出：Passkey 无密码登录",
    description: "支持基于 WebAuthn 的 Passkey 无密码登录，提供更顺滑、更安全的跨设备身份认证体验。",
  },
  {
    icon: ShieldCheck,
    title: "自适应多因素认证 (MFA)",
    description: "内置高可扩展的多因素认证框架，根据登录环境风险和业务安全策略，灵活触发额外的安全验证。",
  },
  {
    icon: Activity,
    title: "关键身份事件审计",
    description: "登录、注册、密码重置、授权撤销等敏感事件会写入账号审计记录，便于用户和平台追溯关键账号活动。",
  },
];

export function SecurityArchitecture() {
  return (
    <section className="py-20 md:py-32 dark:bg-black bg-[#fafafa] overflow-hidden relative">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-5xl px-6">
        {/* Section Header */}
        <div className="text-center mb-16 lg:mb-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/[0.12] bg-black/5 dark:bg-white/[0.05] px-4 py-1.5 text-sm font-medium mb-6">
            <Fingerprint className="size-4" />
            <span>逐步加固</span>
          </div>

          <h2 className="font-artistic text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 dark:from-white dark:to-white/60 pb-2 mb-6">
            围绕身份边界逐步加固
          </h2>

          <p className="mx-auto max-w-3xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            基于标准协议构建，将前端账号体验、身份授权代理与底层认证引擎完全解耦，<br className="hidden sm:block" />
            在提供极致灵活性的同时，确保符合企业级安全标准。
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {securityFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="group relative overflow-hidden rounded-3xl border border-black/5 dark:border-white/[0.12] bg-white dark:bg-[#0d0d0d] p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-black/10 dark:hover:border-white/20"
              >
                {/* Icon */}
                <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="size-7 text-primary" strokeWidth={1.5} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold tracking-tight mb-3">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>

                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              </motion.div>
            );
          })}
        </div>

        {/* Architecture Diagram Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 lg:mt-24"
        >
          <div className="relative aspect-[16/9] rounded-3xl border border-black/5 dark:border-white/[0.12] bg-gradient-to-br from-black/[0.02] to-black/[0.05] dark:from-white/[0.03] dark:to-white/[0.06] overflow-hidden shadow-2xl">
            {/* Placeholder for architecture diagram */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground/40">
              <Shield className="size-16" strokeWidth={1} />
              <p className="text-sm font-medium">架构图预留位置</p>
            </div>

            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 1px)`,
                backgroundSize: "24px 24px",
              }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
