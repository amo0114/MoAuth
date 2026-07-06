"use client";

import { motion } from "framer-motion";
import { Shield, Users, Activity, Eye } from "lucide-react";

const features = [
  {
    id: "identity",
    icon: Users,
    label: "身份聚合",
    title: "一个账号，所有应用",
    description: "昵称、邮箱与基础身份信息集中维护，接入应用通过标准 claims 按需使用。",
  },
  {
    id: "security",
    icon: Shield,
    label: "安全监控",
    title: "实时掌控账号安全",
    description: "密码状态、活跃会话、异常登录一目了然，随时撤销可疑访问。",
  },
  {
    id: "authorization",
    icon: Eye,
    label: "应用授权",
    title: "透明的权限边界",
    description: "清晰查看已授权应用与读取范围，一键撤销不再使用的应用。",
  },
  {
    id: "audit",
    icon: Activity,
    label: "审计日志",
    title: "完整的操作追溯",
    description: "登录、密码变更、授权撤销等关键事件完整记录，便于追溯账号活动。",
  },
];

function FeatureItem({ feature, index }: { feature: typeof features[0]; index: number }) {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center py-20 lg:py-32"
    >
      {/* Text Content */}
      <div className={index % 2 === 1 ? "lg:order-2" : ""}>
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/[0.12] bg-black/5 dark:bg-white/[0.05] px-3 py-1 text-sm font-medium mb-6">
          <Icon className="size-4" />
          <span>{feature.label}</span>
        </div>

        <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
          {feature.title}
        </h3>

        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
          {feature.description}
        </p>
      </div>

      {/* Visual Demo Placeholder */}
      <div className={index % 2 === 1 ? "lg:order-1" : ""}>
        <div className="relative aspect-[4/3] rounded-3xl border border-black/5 dark:border-white/[0.12] bg-gradient-to-br from-black/[0.02] to-black/[0.05] dark:from-white/[0.03] dark:to-white/[0.06] overflow-hidden shadow-2xl">
          {/* Placeholder for actual product screenshot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="size-20 text-muted-foreground/20" strokeWidth={1} />
          </div>

          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent pointer-events-none" />
        </div>
      </div>
    </motion.div>
  );
}

export function FeatureShowcase() {
  return (
    <section className="py-20 md:py-32 dark:bg-[#0a0a0a] bg-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="text-center mb-20 lg:mb-32">
          <h2 className="font-artistic text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 dark:from-white dark:to-white/60 pb-2 mb-6">
            为现代身份场景设计
          </h2>
          <p className="mx-auto max-w-3xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            账号中心负责「你是谁」，各业务应用负责「你能做什么」。<br className="hidden sm:block" />
            职责清晰、边界分明。
          </p>
        </div>

        {/* Feature Items */}
        <div className="divide-y divide-black/5 dark:divide-white/[0.08]">
          {features.map((feature, index) => (
            <FeatureItem key={feature.id} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
