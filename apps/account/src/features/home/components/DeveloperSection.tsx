"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Terminal, Code2, CheckCircle2 } from "lucide-react";
import { identityBrand } from "@/config/brand";

const steps = [
  {
    number: "01",
    title: "登记 OIDC 应用",
    description: "配置 Client ID、回调地址与允许的 scopes",
    icon: Code2,
  },
  {
    number: "02",
    title: "发起 Authorization Code + PKCE",
    description: "生成 state、nonce 与 code challenge 后跳转到 Connect",
    icon: Terminal,
  },
  {
    number: "03",
    title: "校验回调并建立本地 session",
    description: "用 code 兑换 token，映射 sub 到业务应用用户",
    icon: CheckCircle2,
  },
];

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

const sdkSnippet = `import { AuraProvider, useAuth } from "@aura/react";

// 1. 在根组件注入 Provider
function App({ children }) {
  return (
    <AuraProvider clientId="subboost-prod">
      {children}
    </AuraProvider>
  );
}

// 2. 在业务组件中获取会话
function Dashboard() {
  const { user, logout } = useAuth();
  return <div>Welcome, {user.name}</div>;
}`;

export function DeveloperSection() {
  const [activeTab, setActiveTab] = useState<"sdk" | "raw">("sdk");
  return (
    <section className="py-20 md:py-32 dark:bg-[#0a0a0a] bg-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="text-center mb-16 lg:mb-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/[0.12] bg-black/5 dark:bg-white/[0.05] px-4 py-1.5 text-sm font-medium mb-6">
            <Terminal className="size-4" />
            <span>Developer First</span>
          </div>

          <h2 className="font-artistic text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 dark:from-white dark:to-white/60 pb-2 mb-6">
            标准 OIDC + PKCE
          </h2>

          <p className="mx-auto max-w-3xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            业务应用只需发起标准授权码流程并校验回调结果。{identityBrand.gatewayName} 负责登录、授权与 OIDC 发行面，
            业务系统继续保留自己的本地 session、角色权限和业务数据。
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left: Steps */}
          <div className="space-y-12">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="flex gap-6 group"
                >
                  {/* Number + Icon */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="size-6 text-primary" strokeWidth={2} />
                    </div>
                    {index < steps.length - 1 && (
                      <div className="flex-1 w-[2px] bg-gradient-to-b from-black/10 to-transparent dark:from-white/10 min-h-[60px]" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-2">
                    <div className="text-xs font-mono text-muted-foreground mb-2">{step.number}</div>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">{step.title}</h3>
                    <p className="text-base text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Right: Code Editor */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="lg:sticky lg:top-24"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                最快 10 分钟完成业务接入
              </div>
              <div className="flex bg-black/5 dark:bg-white/10 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab("sdk")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeTab === "sdk"
                      ? "bg-white dark:bg-[#1f1f1f] shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  React SDK
                </button>
                <button
                  onClick={() => setActiveTab("raw")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeTab === "raw"
                      ? "bg-white dark:bg-[#1f1f1f] shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  原生 OIDC
                </button>
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden border border-black/10 dark:border-white/[0.15] shadow-2xl bg-[#0d1117] transition-all duration-500 hover:shadow-[0_20px_70px_-15px_rgba(0,0,0,0.3)] hover:scale-[1.02]">
              {/* Window Controls */}
              <div className="flex items-center px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="flex gap-2">
                  <div className="size-3 rounded-full bg-[#ff5f56]" />
                  <div className="size-3 rounded-full bg-[#ffbd2e]" />
                  <div className="size-3 rounded-full bg-[#27c93f]" />
                </div>
                <div className="ml-4 text-xs font-mono text-white/40">
                  {activeTab === "sdk" ? "App.tsx" : "authorize.ts"}
                </div>
              </div>

              {/* Code Area */}
              <div className="p-6 overflow-x-auto min-h-[300px]">
                <pre className="text-sm leading-relaxed font-mono text-[#c9d1d9]">
                  <code>{activeTab === "sdk" ? sdkSnippet : codeSnippet}</code>
                </pre>
              </div>

              {/* Ambient Glow */}
              <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-primary/20 blur-[100px] rounded-full" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
