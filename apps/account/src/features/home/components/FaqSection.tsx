"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { identityBrand } from "@/config/brand";

const faqs = [
  {
    question: "接入需要多久？会影响现有系统吗？",
    answer: "标准 OIDC 接入通常 10-30 分钟完成。你的应用继续保留本地 session、权限体系和业务数据，我们只提供「你是谁」的身份验证，零侵入。",
  },
  {
    question: "我的密码和数据安全吗？",
    answer: "密码经过 Argon2id 单向哈希，即使数据库泄露也无法还原明文。所有传输使用 TLS 1.3 加密，会话令牌定期轮转。我们永远看不到你的密码。",
  },
  {
    question: "用户可以控制哪些内容？",
    answer: "用户可以查看所有活跃会话、已授权应用及其权限范围，并随时一键撤销任何会话或应用授权。所有关键操作（登录、密码变更、授权撤销）都有完整审计日志。",
  },
  {
    question: "支持多因素认证和 Passkey 吗？",
    answer: "Passkey / WebAuthn 已在路线图中，将在生产域名冻结后逐步启用。多因素认证（MFA）当前保留接口边界，后续按安全评审启用。",
  },
];

function FaqItem({ faq, index }: { faq: typeof faqs[0]; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="border-b border-black/5 dark:border-white/[0.12] last:border-0"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
        aria-expanded={open}
      >
        <span className="text-base md:text-lg font-semibold pr-8 group-hover:text-primary transition-colors">
          {faq.question}
        </span>
        <ChevronDown
          className={`size-5 text-muted-foreground transition-transform duration-300 shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-96 pb-5" : "max-h-0"
        }`}
      >
        <p className="text-muted-foreground leading-relaxed pr-8">{faq.answer}</p>
      </div>
    </motion.div>
  );
}

export function FaqSection() {
  return (
    <section className="py-20 md:py-32 dark:bg-[#0a0a0a] bg-white">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center mb-16">
          <h2 className="font-artistic text-3xl font-bold md:text-5xl tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 dark:from-white dark:to-white/60 pb-2">
            常见问题
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base md:text-lg text-muted-foreground">
            关于安全、隐私与接入的常见疑问
          </p>
        </div>

        <div className="rounded-3xl border border-black/5 dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.03] p-6 md:p-8">
          {faqs.map((faq, index) => (
            <FaqItem key={index} faq={faq} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
