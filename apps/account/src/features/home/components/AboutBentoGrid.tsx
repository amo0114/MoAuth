"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Zap, Lock, Globe, Users, Fingerprint } from "lucide-react";

const BENTO_BLOCKS = [
  {
    id: "mission",
    colSpan: "md:col-span-2",
    rowSpan: "md:row-span-2",
    icon: Globe,
    title: "一个身份，连接一切",
    description: "统一的身份层让用户在整个生态中自由流动，无需重复注册、记忆密码。",
    gradient: "from-orange-500/20 via-rose-500/10 to-transparent dark:from-orange-500/30 dark:via-rose-500/20",
    iconBg: "bg-gradient-to-br from-orange-500/20 to-rose-500/20 dark:from-orange-500/30 dark:to-rose-500/30",
    glow: "group-hover:shadow-[0_0_40px_rgba(249,115,22,0.3)]",
    delay: 0,
  },
  {
    id: "security",
    colSpan: "md:col-span-1",
    rowSpan: "md:row-span-1",
    icon: ShieldCheck,
    title: "安全优先设计",
    description: "零知识加密、端到端防护，让安全成为默认。",
    gradient: "from-emerald-500/10 to-transparent dark:from-emerald-500/20",
    iconBg: "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/30 dark:to-teal-500/30",
    glow: "group-hover:shadow-[0_0_40px_rgba(16,185,129,0.25)]",
    delay: 0.1,
  },
  {
    id: "developer",
    colSpan: "md:col-span-1",
    rowSpan: "md:row-span-1",
    icon: Zap,
    title: "开发者友好",
    description: "标准 OIDC 协议，10 分钟完成接入。",
    gradient: "from-amber-500/10 to-transparent dark:from-amber-500/20",
    iconBg: "bg-gradient-to-br from-amber-500/20 to-yellow-500/20 dark:from-amber-500/30 dark:to-yellow-500/30",
    glow: "group-hover:shadow-[0_0_40px_rgba(245,158,11,0.25)]",
    delay: 0.2,
  },
  {
    id: "privacy",
    colSpan: "md:col-span-2",
    rowSpan: "md:row-span-1",
    icon: Lock,
    title: "数据主权属于用户",
    description: "清晰的授权边界，随时可撤销。你的数据，你做主。",
    gradient: "from-purple-500/10 via-pink-500/10 to-transparent dark:from-purple-500/20 dark:via-pink-500/20",
    iconBg: "bg-gradient-to-br from-purple-500/20 to-pink-500/20 dark:from-purple-500/30 dark:to-pink-500/30",
    glow: "group-hover:shadow-[0_0_40px_rgba(168,85,247,0.25)]",
    delay: 0.3,
  },
  {
    id: "biometrics",
    colSpan: "md:col-span-1",
    rowSpan: "md:row-span-1",
    icon: Fingerprint,
    title: "生物识别未来",
    description: "Passkey 路线图，无密码登录即将到来。",
    gradient: "from-blue-500/10 to-transparent dark:from-blue-500/20",
    iconBg: "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/30 dark:to-cyan-500/30",
    glow: "group-hover:shadow-[0_0_40px_rgba(59,130,246,0.25)]",
    delay: 0.4,
  },
  {
    id: "ecosystem",
    colSpan: "md:col-span-1",
    rowSpan: "md:row-span-1",
    icon: Users,
    title: "生态互联",
    description: "一次登录，畅行全平台。",
    gradient: "from-indigo-500/10 to-transparent dark:from-indigo-500/20",
    iconBg: "bg-gradient-to-br from-indigo-500/20 to-violet-500/20 dark:from-indigo-500/30 dark:to-violet-500/30",
    glow: "group-hover:shadow-[0_0_40px_rgba(99,102,241,0.25)]",
    delay: 0.5,
  }
];

export function AboutBentoGrid() {
  return (
    <section className="px-6 py-20 md:py-32 dark:bg-[#0a0a0a] bg-white">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="text-center mb-16 md:mb-20">
          <h2 className="font-artistic text-3xl font-bold md:text-5xl tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 dark:from-white dark:to-white/60 pb-2">
            为什么选择我们
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base md:text-lg text-muted-foreground">
            安全、简单、优雅 — 现代身份管理的全新标准
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-4 md:gap-6 auto-rows-[minmax(200px,auto)]">
          {BENTO_BLOCKS.map((block) => {
            const Icon = block.icon;
            return (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: block.delay, ease: [0.22, 1, 0.36, 1] }}
                className={`group relative overflow-hidden rounded-[32px] border border-black/5 dark:border-white/[0.12] bg-white dark:bg-[#0d0d0d] p-8 md:p-10 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-black/10 dark:hover:border-white/20 ${block.glow} cursor-pointer ${block.colSpan} ${block.rowSpan}`}
              >
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br opacity-100 transition-opacity duration-500 ${block.gradient}`} />

                {/* Subtle Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
                     style={{
                       backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 1px)`,
                       backgroundSize: '24px 24px'
                     }}
                />

                {/* Content */}
                <div className="relative z-10 flex h-full flex-col justify-between min-h-[200px]">
                  {/* Icon */}
                  <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${block.iconBg} backdrop-blur-sm transition-transform duration-500 group-hover:scale-110`}>
                    <Icon className="h-7 w-7 text-foreground" strokeWidth={1.5} />
                  </div>

                  {/* Text */}
                  <div className="mt-auto">
                    <h3 className="mb-2 text-xl md:text-2xl font-bold tracking-tight text-foreground">
                      {block.title}
                    </h3>
                    <p className="text-sm md:text-base leading-relaxed text-muted-foreground">
                      {block.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
