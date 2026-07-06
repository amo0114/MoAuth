"use client";

import { motion } from "framer-motion";
import { Lock, Eye, ShieldAlert } from "lucide-react";

export function DeepDiveSecuritySection() {
  return (
    <section className="py-24 md:py-32 dark:bg-[#0a0a0a] bg-white relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-20">
          <h2 className="font-artistic text-4xl font-bold md:text-5xl tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 dark:from-white dark:to-white/60 pb-2">
            安全，从设计之初
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            隐私不是功能，而是根基。我们相信，最好的安全体验是让你感觉不到它的存在。
          </p>
        </div>

        <div className="space-y-24 md:space-y-32">
          {/* Row 1 - 零知识架构 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.02, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
              className="relative aspect-square md:aspect-[4/3] rounded-3xl border border-black/5 dark:border-white/[0.12] bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 overflow-hidden flex items-center justify-center cursor-pointer group"
            >
              {/* Animated lock particles */}
              <div className="absolute inset-0">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute size-1.5 rounded-full bg-blue-400/30 dark:bg-blue-400/40"
                    style={{
                      left: `${15 + (i % 4) * 20}%`,
                      top: `${15 + Math.floor(i / 4) * 20}%`,
                    }}
                    animate={{
                      y: [0, -10, 0],
                      opacity: [0.3, 0.8, 0.3],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
              <Lock className="size-32 text-blue-600 dark:text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.4)] group-hover:scale-110 transition-transform duration-500" strokeWidth={1.5} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            >
              <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">你的数据，永远属于你</h3>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                我们采用零知识加密架构。你的密码经过单向哈希，即使数据库被攻破，攻击者也无法还原明文。
              </p>
              <p className="text-base text-muted-foreground leading-relaxed">
                TLS 1.3 端到端加密 · Argon2id 密码哈希 · 会话令牌轮转
              </p>
            </motion.div>
          </div>

          {/* Row 2 - 透明可见 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.02, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
              className="order-1 md:order-2 relative aspect-square md:aspect-[4/3] rounded-3xl border border-black/5 dark:border-white/[0.12] bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 overflow-hidden flex items-center justify-center cursor-pointer group"
            >
              {/* Pulse effect */}
              <motion.div
                className="absolute inset-0 rounded-full bg-green-400/20 dark:bg-green-400/10"
                animate={{
                  scale: [0.8, 1.2, 0.8],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <Eye className="size-32 text-green-600 dark:text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.4)] group-hover:scale-110 transition-transform duration-500" strokeWidth={1.5} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              className="order-2 md:order-1"
            >
              <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">没有黑箱，只有透明</h3>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                每一次登录、每一个授权、每一处变更，都会被清晰记录。你可以随时查看哪些设备正在使用你的账号，一键撤销任何可疑会话。
              </p>
              <p className="text-base text-muted-foreground leading-relaxed">
                设备指纹追踪 · 活跃会话管理 · 完整审计日志
              </p>
            </motion.div>
          </div>

          {/* Row 3 - 持续演进 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.02, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
              className="relative aspect-square md:aspect-[4/3] rounded-3xl border border-black/5 dark:border-white/[0.12] bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 overflow-hidden flex items-center justify-center cursor-pointer group"
            >
              {/* Shield layers */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <div className="size-48 rounded-full border-2 border-amber-400/20 dark:border-amber-400/10" />
              </motion.div>
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{
                  rotate: [360, 0],
                }}
                transition={{
                  duration: 15,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <div className="size-32 rounded-full border-2 border-amber-400/30 dark:border-amber-400/15" />
              </motion.div>
              <ShieldAlert className="size-32 text-amber-600 dark:text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.4)] group-hover:scale-110 transition-transform duration-500" strokeWidth={1.5} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            >
              <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">安全防护，永不止步</h3>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                我们持续监控最新的安全威胁，并第一时间响应。未来将引入 Passkey 生物识别、自适应多因素认证，让安全与便捷并存。
              </p>
              <p className="text-base text-muted-foreground leading-relaxed">
                Passkey 路线图 · 自适应 MFA · 异常行为检测
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
