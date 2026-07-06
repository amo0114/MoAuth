"use client";

import { motion } from "framer-motion";
import { Shield, Code2, UserCircle } from "lucide-react";

const coreValues = [
  {
    icon: Shield,
    title: "安全，从设计之初",
    description: "零知识加密、端到端防护、完整审计日志。你的数据永远属于你，我们永远看不到你的密码。",
    features: ["TLS 1.3 加密", "Argon2id 哈希", "会话轮转", "异常检测"],
    gradient: "from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-500/20 dark:via-teal-500/10",
    iconBg: "from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/30 dark:to-teal-500/30",
    glow: "hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.4)]",
  },
  {
    icon: Code2,
    title: "10 分钟完成接入",
    description: "标准 OIDC + PKCE，无需学习私有协议。你的应用继续保留本地权限和数据，我们只回答「你是谁」。",
    features: ["标准 OAuth 2.0", "PKCE 安全", "本地 Session", "零侵入"],
    gradient: "from-blue-500/10 via-indigo-500/5 to-transparent dark:from-blue-500/20 dark:via-indigo-500/10",
    iconBg: "from-blue-500/20 to-indigo-500/20 dark:from-blue-500/30 dark:to-indigo-500/30",
    glow: "hover:shadow-[0_0_60px_-15px_rgba(59,130,246,0.4)]",
  },
  {
    icon: UserCircle,
    title: "用户完全掌控",
    description: "透明查看所有授权应用，一键撤销任何会话。每一次登录、每一个变更，都清晰记录，随时可查。",
    features: ["活跃会话管理", "应用授权撤销", "完整审计日志", "设备指纹"],
    gradient: "from-purple-500/10 via-pink-500/5 to-transparent dark:from-purple-500/20 dark:via-pink-500/10",
    iconBg: "from-purple-500/20 to-pink-500/20 dark:from-purple-500/30 dark:to-pink-500/30",
    glow: "hover:shadow-[0_0_60px_-15px_rgba(168,85,247,0.4)]",
  },
];

export function CoreValues() {
  return (
    <section className="py-20 md:py-32 dark:bg-[#0a0a0a] bg-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="text-center mb-16 md:mb-20">
          <h2 className="font-artistic text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 dark:from-white dark:to-white/60 pb-2 mb-6">
            为现代身份场景设计
          </h2>
          <p className="mx-auto max-w-3xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            账号中心负责「你是谁」，各业务应用负责「你能做什么」。<br className="hidden sm:block" />
            职责清晰、边界分明。
          </p>
        </div>

        {/* Core Value Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {coreValues.map((value, index) => {
            const Icon = value.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
                className={`group relative overflow-hidden rounded-3xl border border-black/5 dark:border-white/[0.12] bg-white dark:bg-[#0d0d0d] p-8 lg:p-10 transition-all duration-500 hover:-translate-y-2 hover:border-black/10 dark:hover:border-white/20 ${value.glow}`}
              >
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br opacity-100 transition-opacity duration-500 ${value.gradient}`} />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div className={`inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br ${value.iconBg} mb-8 group-hover:scale-110 transition-transform duration-500`}>
                    <Icon className="size-8 text-foreground" strokeWidth={1.5} />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
                    {value.title}
                  </h3>

                  {/* Description */}
                  <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-6">
                    {value.description}
                  </p>

                  {/* Features */}
                  <div className="flex flex-wrap gap-2">
                    {value.features.map((feature, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full bg-black/5 dark:bg-white/5 px-3 py-1 text-xs font-medium text-foreground/80"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
