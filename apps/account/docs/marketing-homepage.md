# Account 营销首页代码汇总

> 生成时间：2026-07-01
> 应用：`apps/account`
> 路由：`/`（首页）、`/about`（关于页）

## 文件结构

```
apps/account/
├── app/
│   ├── page.jsx
│   └── about/page.jsx
├── src/
│   ├── config/brand.js              # 品牌名、slogan（关联引用）
│   └── features/home/
│       ├── index.tsx
│       ├── config/public-nav.ts
│       ├── hooks/usePublicNavLinks.ts
│       └── components/
│           ├── PublicShell.tsx
│           ├── PublicTopNav.tsx
│           ├── HeroSection.tsx
│           ├── StatsSection.tsx
│           ├── FeaturesSection.tsx
│           ├── HowItWorksSection.tsx
│           ├── CtaSection.tsx
│           └── PublicFooter.tsx
└── app/globals.css                  # .font-artistic / .font-slogan（关联引用）
```

## 与账号中心的边界

| 范围 | 模块 | Shell | 路由 |
|------|------|-------|------|
| 营销页 | `src/features/home/` | `PublicShell` | `/`、`/about` |
| 账号中心 | `src/features/account/` | `AccountCenterShell` | `/account/*` |

公共顶栏 nav（主页 / 关于 / 文档）与账号中心 nav（总览 / 资料 / 安全…）完全分离。

---

## `app/page.jsx`

```jsx
import { cookies } from "next/headers";

import { getOptionalAccountUser } from "../src/auth/require-account-session.js";
import { HomePage } from "../src/features/home";

export default async function AccountHomePage() {
  const cookieStore = await cookies();
  const user = getOptionalAccountUser(cookieStore);

  return <HomePage user={user} />;
}
```

---

## `app/about/page.jsx`

```jsx
import { cookies } from "next/headers";

import { getOptionalAccountUser } from "../../src/auth/require-account-session.js";
import { PublicShell } from "../../src/features/home/components/PublicShell";
import { PublicFooter } from "../../src/features/home/components/PublicFooter";
import { identityBrand } from "../../src/config/brand.js";

export default async function AboutPage() {
  const cookieStore = await cookies();
  const user = getOptionalAccountUser(cookieStore);

  return (
    <PublicShell user={user}>
      <section className="mx-auto max-w-3xl px-6 pt-28 pb-20 md:pt-36">
        <h1 className="font-artistic text-3xl font-semibold md:text-4xl">
          关于 {identityBrand.productName}
        </h1>
        <p className="mt-6 leading-relaxed text-muted-foreground">
          {identityBrand.productName} 是统一身份体系中的账号中心：负责注册、登录、资料维护、安全设置与应用授权管理。
          各业务应用通过标准 OIDC 完成身份验证，同时保留本地会话、角色权限与业务数据。
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          如有问题，请联系{" "}
          <a
            href={`mailto:${identityBrand.supportEmail}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {identityBrand.supportEmail}
          </a>
          。
        </p>
      </section>
      <PublicFooter />
    </PublicShell>
  );
}
```

---

## `src/features/home/index.tsx`

```tsx
import { PublicShell } from "./components/PublicShell";
import { HeroSection } from "./components/HeroSection";
import { StatsSection } from "./components/StatsSection";
import { FeaturesSection } from "./components/FeaturesSection";
import { HowItWorksSection } from "./components/HowItWorksSection";
import { CtaSection } from "./components/CtaSection";
import { PublicFooter } from "./components/PublicFooter";

type HomePageProps = {
  user?: { email?: string | null } | null;
};

export function HomePage({ user }: HomePageProps) {
  return (
    <PublicShell user={user}>
      <HeroSection user={user} />
      <StatsSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CtaSection user={user} />
      <PublicFooter />
    </PublicShell>
  );
}
```

---

## `src/features/home/config/public-nav.ts`

```ts
export type PublicNavLink = {
  title: string;
  href: string;
  disabled?: boolean;
  external?: boolean;
};

function docsHref() {
  const url = process.env.NEXT_PUBLIC_IDENTITY_DOCS_URL?.trim();
  return url || "#";
}

/** 公共顶栏导航（account.xxx.com 营销页，与账号中心 nav 分离） */
export const PUBLIC_NAV_LINKS: PublicNavLink[] = [
  { title: "主页", href: "/" },
  { title: "关于", href: "/about" },
  {
    title: "文档",
    href: docsHref(),
    external: Boolean(process.env.NEXT_PUBLIC_IDENTITY_DOCS_URL?.trim()),
  },
];
```

---

## `src/features/home/hooks/usePublicNavLinks.ts`

```ts
"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { PUBLIC_NAV_LINKS, type PublicNavLink } from "../config/public-nav";

export type PublicNavLinkView = PublicNavLink & {
  isActive: boolean;
};

export function usePublicNavLinks(): PublicNavLinkView[] {
  const pathname = usePathname();

  return useMemo(
    () =>
      PUBLIC_NAV_LINKS.map((link) => ({
        disabled: false,
        external: false,
        ...link,
        isActive: !link.external && pathname === link.href,
      })),
    [pathname]
  );
}
```

---

## `src/features/home/components/PublicShell.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { identityBrand } from "@/config/brand";
import { cn } from "@/lib/utils";
import {
  PublicMobileNavOverlay,
  PublicMobileNavTrigger,
  PublicTopNavBar,
} from "./PublicTopNav";

type PublicShellProps = {
  children: React.ReactNode;
  user?: { email?: string | null } | null;
};

export function PublicShell({ children, user }: PublicShellProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isLoggedIn = Boolean(user);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out",
          scrolled ? "pt-3 px-4" : "pt-0 px-0",
        )}
      >
        <nav
          className={cn(
            "relative mx-auto flex items-center transition-all duration-500 ease-out",
            scrolled
              ? "max-w-4xl rounded-full border border-border/50 bg-background/80 backdrop-blur-xl shadow-lg px-4 py-2.5"
              : "max-w-6xl border-transparent bg-transparent px-6 py-4",
          )}
        >
          <Link
            href="/"
            className={cn(
              "absolute left-4 z-10 flex items-center gap-2.5 transition-all duration-500 ease-out",
              scrolled ? "top-1/2 -translate-y-1/2" : "top-4",
            )}
          >
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full border border-white/60 bg-gradient-to-b from-white/80 to-white/30 shadow-sm transition-all duration-500",
                scrolled ? "size-7" : "size-8",
              )}
            >
              <Fingerprint
                className={cn(
                  "text-primary transition-all duration-500",
                  scrolled ? "size-4" : "size-[18px]",
                )}
                strokeWidth={2}
              />
            </div>
            <span
              className={cn(
                "font-artistic font-semibold tracking-tight transition-all duration-500",
                scrolled ? "text-base" : "text-lg",
              )}
            >
              {identityBrand.productName}
            </span>
          </Link>

          <div className="hidden md:flex flex-1 justify-center">
            <PublicTopNavBar />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {isLoggedIn ? (
              <Button size="sm" className="rounded-full" asChild>
                <Link href="/account/overview">进入账号中心</Link>
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex rounded-full"
                  asChild
                >
                  <Link href="/login">登录</Link>
                </Button>
                <Button size="sm" className="rounded-full" asChild>
                  <Link href="/register">注册</Link>
                </Button>
              </>
            )}
            <div className="md:hidden">
              <PublicMobileNavTrigger
                open={mobileOpen}
                onToggle={() => setMobileOpen((v) => !v)}
              />
            </div>
          </div>
        </nav>
      </header>

      <PublicMobileNavOverlay
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        scrolled={scrolled}
        user={user}
      />

      <main>{children}</main>
    </div>
  );
}
```

---

## `src/features/home/components/PublicTopNav.tsx`

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils.js";
import { usePublicNavLinks } from "../hooks/usePublicNavLinks";
import type { PublicNavLinkView } from "../hooks/usePublicNavLinks";

const MOBILE_OVERLAY_EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

function PublicNavLink({
  link,
  className,
  style,
  onNavigate,
}: {
  link: PublicNavLinkView;
  className?: string;
  style?: React.CSSProperties;
  onNavigate?: () => void;
}) {
  const merged = cn(
    className,
    link.isActive ? "text-[#1D1D1F] dark:text-white" : "text-[#1D1D1F]/70 dark:text-white/70",
    link.disabled && "pointer-events-none opacity-50"
  );

  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={merged}
        style={style}
      >
        {link.title}
      </a>
    );
  }

  return (
    <Link href={link.href} onClick={onNavigate} className={merged} style={style}>
      {link.title}
    </Link>
  );
}

export function PublicTopNavBar() {
  const links = usePublicNavLinks();

  return (
    <nav className="flex items-center gap-0.5 whitespace-nowrap" aria-label="站点导航">
      {links.map((link) => (
        <PublicNavLink
          key={link.href}
          link={link}
          className="relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-200"
        />
      ))}
    </nav>
  );
}

export function PublicMobileNavTrigger({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9"
      onClick={onToggle}
      aria-label="打开导航菜单"
      aria-expanded={open}
    >
      <div className="relative size-4">
        <span
          className={cn(
            "absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300",
            open ? "top-[7px] rotate-45" : "top-[3px]"
          )}
        />
        <span
          className={cn(
            "absolute inset-x-0 top-[7px] block h-[1.5px] rounded-full bg-current transition-all duration-300",
            open ? "scale-x-0 opacity-0" : "opacity-100"
          )}
        />
        <span
          className={cn(
            "absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300",
            open ? "top-[7px] -rotate-45" : "top-[11px]"
          )}
        />
      </div>
    </Button>
  );
}

export function PublicMobileNavOverlay({
  open,
  onClose,
  scrolled = false,
  user,
}: {
  open: boolean;
  onClose: () => void;
  scrolled?: boolean;
  user?: { email?: string | null } | null;
}) {
  const links = usePublicNavLinks();
  const isLoggedIn = Boolean(user);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 transition-opacity duration-500 sm:pointer-events-none sm:hidden",
        MOBILE_OVERLAY_EASE,
        scrolled
          ? "bg-[#F5F5F7]/98 dark:bg-black/95 backdrop-blur-2xl"
          : "bg-transparent backdrop-blur-none",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col justify-between px-8 pt-20 pb-10">
        <nav className="flex flex-col gap-1">
          {links.map((link, index) => (
            <PublicNavLink
              key={link.href}
              link={link}
              onNavigate={onClose}
              className={cn(
                "flex items-center gap-3 py-3 text-base font-medium tracking-tight transition-all duration-500",
                MOBILE_OVERLAY_EASE,
                open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
              style={{ transitionDelay: open ? `${100 + index * 50}ms` : "0ms" }}
            />
          ))}
        </nav>

        <div
          className={cn(
            "flex flex-col gap-3 transition-all duration-500",
            MOBILE_OVERLAY_EASE,
            open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
          style={{ transitionDelay: open ? "250ms" : "0ms" }}
        >
          {isLoggedIn ? (
            <Link
              href="/account/overview"
              tabIndex={open ? undefined : -1}
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1D1D1F] text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 dark:bg-white dark:text-[#1D1D1F]"
            >
              进入账号中心
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                tabIndex={open ? undefined : -1}
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1D1D1F] text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 dark:bg-white dark:text-[#1D1D1F]"
              >
                注册
              </Link>
              <Link
                href="/login"
                tabIndex={open ? undefined : -1}
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#1D1D1F]/20 text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80 dark:border-white/20"
              >
                登录
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## `src/features/home/components/HeroSection.tsx`

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { identityBrand } from "@/config/brand";

type HeroSectionProps = {
  user?: { email?: string | null } | null;
};

export function HeroSection({ user }: HeroSectionProps) {
  const isLoggedIn = Boolean(user);

  return (
    <section className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
      >
        <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          统一身份 · 一处管理
        </p>
        <h1 className="font-artistic text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
          {identityBrand.productName}
        </h1>
        <p className="font-slogan mx-auto mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
          {identityBrand.slogan}
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground/90">
          登录、资料与安全设置集中在一处。接入方应用通过标准 OIDC
          完成授权，你的账号始终由你掌控。
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {isLoggedIn ? (
            <Button size="lg" className="rounded-full px-8" asChild>
              <Link href="/account/overview">进入账号中心</Link>
            </Button>
          ) : (
            <>
              <Button size="lg" className="rounded-full px-8" asChild>
                <Link href="/register">免费注册</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8"
                asChild
              >
                <Link href="/login">登录</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
```

---

## `src/features/home/components/StatsSection.tsx`

```tsx
const STATS = [
  { value: "1", label: "统一账号", desc: "一处登录，多处通行" },
  { value: "OIDC", label: "标准协议", desc: "Authorization Code + PKCE" },
  { value: "本地", label: "会话与权限", desc: "各应用保留自有角色与审计" },
];

export function StatsSection() {
  return (
    <section className="border-y border-border/50 bg-muted/30 py-16">
      <div className="mx-auto grid max-w-5xl gap-8 px-6 sm:grid-cols-3">
        {STATS.map((item) => (
          <div key={item.label} className="text-center">
            <p className="font-artistic text-3xl font-semibold text-primary md:text-4xl">
              {item.value}
            </p>
            <p className="mt-2 font-medium">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

---

## `src/features/home/components/FeaturesSection.tsx`

```tsx
import { KeyRound, Shield, UserCircle } from "lucide-react";

const FEATURES = [
  {
    icon: UserCircle,
    title: "资料与身份",
    desc: "头像、昵称与联系方式集中维护，变更一次、各应用同步可见。",
  },
  {
    icon: Shield,
    title: "安全中心",
    desc: "密码、二次验证与会话管理，随时掌握账号安全状态。",
  },
  {
    icon: KeyRound,
    title: "应用授权",
    desc: "查看已授权应用与权限范围，按需撤销访问。",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center font-artistic text-3xl font-semibold md:text-4xl">
          为现代身份场景设计
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          账号中心负责「你是谁」；各业务应用负责「你能做什么」——职责清晰、边界分明。
        </p>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## `src/features/home/components/HowItWorksSection.tsx`

```tsx
const STEPS = [
  {
    step: "01",
    title: "注册或登录",
    desc: "在账号中心完成身份验证，建立你的统一账号。",
  },
  {
    step: "02",
    title: "接入方授权",
    desc: "访问 SubBoost 等已接入应用时，通过标准 OIDC 流程完成授权。",
  },
  {
    step: "03",
    title: "一处管理",
    desc: "在账号中心查看资料、安全设置与已授权应用，随时调整。",
  },
];

export function HowItWorksSection() {
  return (
    <section className="border-t border-border/50 bg-muted/20 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center font-artistic text-3xl font-semibold md:text-4xl">
          如何运作
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
          三步完成从注册到多应用通行的身份旅程。
        </p>

        <ol className="mt-14 grid gap-10 md:grid-cols-3">
          {STEPS.map((item) => (
            <li key={item.step} className="relative">
              <span className="font-artistic text-4xl font-bold text-primary/30">
                {item.step}
              </span>
              <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

---

## `src/features/home/components/CtaSection.tsx`

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

type CtaSectionProps = {
  user?: { email?: string | null } | null;
};

export function CtaSection({ user }: CtaSectionProps) {
  const isLoggedIn = Boolean(user);

  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <div className="rounded-3xl border border-border/60 bg-gradient-to-b from-primary/5 to-transparent px-8 py-14 md:px-12">
          <h2 className="font-artistic text-2xl font-semibold md:text-3xl">
            {isLoggedIn ? "欢迎回来" : "准备好开始了吗？"}
          </h2>
          <p className="mt-4 text-muted-foreground">
            {isLoggedIn
              ? "进入账号中心管理你的资料与安全设置。"
              : "创建账号，体验统一身份带来的简洁与安心。"}
          </p>
          <div className="mt-8">
            {isLoggedIn ? (
              <Button size="lg" className="rounded-full px-10" asChild>
                <Link href="/account/overview">进入账号中心</Link>
              </Button>
            ) : (
              <Button size="lg" className="rounded-full px-10" asChild>
                <Link href="/register">立即注册</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

---

## `src/features/home/components/PublicFooter.tsx`

```tsx
import Link from "next/link";
import { identityBrand } from "@/config/brand";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          © {year} {identityBrand.productName}. 统一身份账号中心。
        </p>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <Link href="/about" className="hover:text-foreground transition-colors">
            关于
          </Link>
          <Link href="/login" className="hover:text-foreground transition-colors">
            登录
          </Link>
          <Link
            href="/register"
            className="hover:text-foreground transition-colors"
          >
            注册
          </Link>
        </nav>
      </div>
    </footer>
  );
}
```

---

## 关联配置

### `src/config/brand.js`（节选）

```js
const DEFAULT_PRODUCT_NAME = "Aura";

function publicEnv(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value : fallback;
}

export const identityBrand = Object.freeze({
  productName: publicEnv("NEXT_PUBLIC_IDENTITY_PRODUCT_NAME", DEFAULT_PRODUCT_NAME),
  accountName: publicEnv("NEXT_PUBLIC_IDENTITY_ACCOUNT_NAME", publicEnv("NEXT_PUBLIC_IDENTITY_PRODUCT_NAME", DEFAULT_PRODUCT_NAME)),
  gatewayName: publicEnv("NEXT_PUBLIC_IDENTITY_GATEWAY_NAME", "Connect"),
  connectBaseUrl: publicEnv("NEXT_PUBLIC_IDENTITY_CONNECT_URL", "http://127.0.0.1:3000"),
  supportEmail: publicEnv("NEXT_PUBLIC_IDENTITY_SUPPORT_EMAIL", "support@example.com"),
  slogan: publicEnv("NEXT_PUBLIC_IDENTITY_SLOGAN", "入本源，见真知。"),
});
```

### `app/globals.css`（节选）

```css
.font-artistic {
  font-family: "Playfair Display", serif;
  font-style: italic;
}

.font-slogan {
  font-family: "Noto Serif SC", "Songti SC", "STSong", serif;
}
```

### 环境变量（`.env.local` 示例）

```env
NEXT_PUBLIC_IDENTITY_PRODUCT_NAME=Aura
NEXT_PUBLIC_IDENTITY_SLOGAN=入本源，见真知。
NEXT_PUBLIC_IDENTITY_DOCS_URL=          # 可选，配置后「文档」链到外部
```