"use client";

import { motion } from "framer-motion";
import { identityBrand } from "@/config/brand";

export function AboutHero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-12 md:pt-32 md:pb-16 px-6">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 opacity-50 blur-[100px] md:h-[800px] md:w-[800px] md:opacity-30"></div>

      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-8 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
            我们的使命
          </div>
          <h1 className="font-artistic text-4xl font-extrabold tracking-tight sm:text-5xl md:text-7xl lg:text-[5rem] xl:text-[6rem]">
            重新定义
            <br />
            <span className="bg-gradient-to-r from-primary via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              身份认证体验
            </span>
          </h1>
          <p className="mt-8 text-lg leading-relaxed text-muted-foreground md:text-xl lg:px-24">
            {identityBrand.productName} 致力于打造开放、统一、边界清晰的现代身份核心。Account 负责账号生命周期，Connect 负责 OIDC 登录与授权，业务应用继续掌控自己的权限与数据。
          </p>
        </motion.div>
      </div>
    </section>
  );
}
