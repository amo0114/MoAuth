"use client";

import { motion, type Variants } from "framer-motion";
import { KeyRound, Shield, UserCircle, Activity, Globe } from "lucide-react";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export function FeaturesSection() {
  return (
    <section className="py-20 md:py-32 relative overflow-hidden dark:bg-[#0a0a0a] bg-white">
      <div className="mx-auto max-w-6xl px-6 relative z-10">
        <div className="text-center mb-16 md:mb-24">
          <h2 className="font-artistic text-3xl font-bold md:text-5xl tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 dark:from-white dark:to-white/60 pb-2">
            为现代身份场景设计
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base md:text-lg text-muted-foreground">
            账号中心负责「你是谁」，各业务应用负责「你能做什么」。职责清晰、边界分明。
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Large Bento Box */}
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -6, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
            className="md:col-span-2 group relative overflow-hidden rounded-[32px] border border-black/5 dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.03] p-8 md:p-10 transition-[background-color,border-color,box-shadow] duration-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:shadow-lg hover:border-primary/20 cursor-pointer"
          >
            <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
              <UserCircle className="w-32 h-32 text-blue-500" />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between min-h-[240px]">
              <div className="inline-flex rounded-2xl bg-white dark:bg-[#1a1a1a] p-3 shadow-sm border border-black/5 dark:border-white/[0.12] w-fit mb-8 group-hover:scale-110 transition-transform duration-500">
                <UserCircle className="h-6 w-6 text-[#1D1D1F] dark:text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold tracking-tight mb-3">资料与身份聚合</h3>
                <p className="text-muted-foreground leading-relaxed max-w-md">
                  昵称、邮箱与基础身份信息集中维护，由接入应用通过标准 claims 和本地映射按需使用。
                </p>
              </div>
            </div>
          </motion.div>

          {/* Medium Bento Box 1 */}
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -6, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
            className="group relative overflow-hidden rounded-[32px] border border-black/5 dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.03] p-8 transition-[background-color,border-color,box-shadow] duration-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:shadow-lg hover:border-primary/20 cursor-pointer"
          >
            <div className="relative z-10 h-full flex flex-col justify-between min-h-[240px]">
              <div className="inline-flex rounded-2xl bg-white dark:bg-[#1a1a1a] p-3 shadow-sm border border-black/5 dark:border-white/[0.12] w-fit mb-8 group-hover:scale-110 transition-transform duration-500">
                <Shield className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h3 className="text-2xl font-bold tracking-tight mb-3">安全监控</h3>
                <p className="text-muted-foreground leading-relaxed">
                  密码状态、会话列表与账号活动集中呈现，帮助用户识别异常访问风险。
                </p>
              </div>
            </div>
          </motion.div>

          {/* Medium Bento Box 2 */}
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -6, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
            className="group relative overflow-hidden rounded-[32px] border border-black/5 dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.03] p-8 transition-[background-color,border-color,box-shadow] duration-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:shadow-lg hover:border-primary/20 cursor-pointer"
          >
            <div className="relative z-10 h-full flex flex-col justify-between min-h-[240px]">
              <div className="inline-flex rounded-2xl bg-white dark:bg-[#1a1a1a] p-3 shadow-sm border border-black/5 dark:border-white/[0.12] w-fit mb-8 group-hover:scale-110 transition-transform duration-500">
                <KeyRound className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-2xl font-bold tracking-tight mb-3">OIDC 应用授权</h3>
                <p className="text-muted-foreground leading-relaxed">
                  透明查看已授权的第三方应用与读取权限范围，支持一键撤销访问。
                </p>
              </div>
            </div>
          </motion.div>

          {/* Wide Bento Box */}
          <motion.div
            variants={itemVariants}
            className="md:col-span-2 group relative overflow-hidden rounded-[32px] border border-black/5 dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.03] p-8 transition-[background-color,border-color,box-shadow,transform] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
          >
             {/* Decorative graphic */}
             <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 opacity-10 dark:opacity-20 pointer-events-none">
              <Globe className="w-64 h-64 text-indigo-500" />
            </div>

            <div className="relative z-10 h-full flex flex-col justify-center min-h-[240px]">
              <div className="inline-flex rounded-2xl bg-white dark:bg-black p-3 shadow-sm border border-black/5 dark:border-white/10 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                <Activity className="h-6 w-6 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight mb-3">实时审计日志</h3>
              <p className="text-muted-foreground leading-relaxed max-w-lg">
                登录、密码变更、应用授权撤销等关键身份事件会被记录，便于追溯账号活动。
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
