"use client";

import { motion } from "framer-motion";
import { Terminal } from "lucide-react";
import { identityBrand } from "@/config/brand";

export function HowItWorksSection() {
  const codeSnippet = `const authorizeUrl = new URL("${identityBrand.connectBaseUrl}/oauth/v2/authorize");

authorizeUrl.searchParams.set("client_id", "subboost-prod");
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("redirect_uri", "https://app.example.com/auth/callback");
authorizeUrl.searchParams.set("scope", "openid profile email");
authorizeUrl.searchParams.set("state", state);
authorizeUrl.searchParams.set("nonce", nonce);
authorizeUrl.searchParams.set("code_challenge", pkceChallenge);
authorizeUrl.searchParams.set("code_challenge_method", "S256");

redirect(authorizeUrl.toString());`;

  return (
    <section className="py-24 md:py-32 dark:bg-[#0a0a0a] bg-white relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="order-2 lg:order-1"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/[0.12] bg-black/5 dark:bg-white/[0.05] px-3 py-1 text-sm font-medium mb-6">
              <Terminal className="size-4" />
              <span>开发者友好 (Developer First)</span>
            </div>

            <h2 className="font-artistic text-4xl font-bold md:text-5xl tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 dark:from-white dark:to-white/60 pb-2">
              标准 OIDC + PKCE，接入统一身份
            </h2>

            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              业务应用只需要发起标准授权码流程并校验回调结果。
              {identityBrand.gatewayName} 负责登录、授权与 OIDC 发行面，
              业务系统继续保留自己的本地 session、角色权限和业务数据。
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black font-bold text-sm">1</div>
                <div>
                  <h4 className="font-bold">登记 OIDC 应用</h4>
                  <p className="text-sm text-muted-foreground mt-1">配置 Client ID、回调地址与允许的 scopes</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/10 dark:bg-white/10 font-bold text-sm">2</div>
                <div>
                  <h4 className="font-bold">发起 Authorization Code + PKCE</h4>
                  <p className="text-sm text-muted-foreground mt-1">生成 state、nonce 与 code challenge 后跳转到 Connect</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/10 dark:bg-white/10 font-bold text-sm">3</div>
                <div>
                  <h4 className="font-bold">校验回调并建立本地 session</h4>
                  <p className="text-sm text-muted-foreground mt-1">用 code 兑换 token，映射 sub 到业务应用用户</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: Code Editor Mock */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            whileHover={{
              y: -8,
              boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.25)",
              transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
            }}
            className="order-1 lg:order-2"
          >
            <div className="relative rounded-2xl overflow-hidden border border-black/10 dark:border-white/[0.15] shadow-2xl bg-[#0d1117] transition-shadow duration-300">
              {/* Window Controls */}
              <div className="flex items-center px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="flex gap-2">
                  <div className="size-3 rounded-full bg-[#ff5f56]" />
                  <div className="size-3 rounded-full bg-[#ffbd2e]" />
                  <div className="size-3 rounded-full bg-[#27c93f]" />
                </div>
                <div className="ml-4 text-xs font-mono text-white/40">authorize.ts</div>
              </div>

              {/* Code Area */}
              <div className="p-6 overflow-x-auto text-sm md:text-base font-mono leading-relaxed text-[#c9d1d9]">
                <pre className="m-0">
                  <code>{codeSnippet}</code>
                </pre>
              </div>
            </div>

            {/* Ambient Glow behind code editor */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-blue-500/20 dark:bg-blue-500/30 blur-[50px] md:blur-[100px] rounded-full" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
