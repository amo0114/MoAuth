"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils.js";
import { useAccountNavLinks } from "../hooks/useAccountNavLinks";
import type { AccountNavLinkView } from "../hooks/useAccountNavLinks";

/** 对齐 new-api PublicHeader 移动端全屏菜单缓动 */
const MOBILE_OVERLAY_EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

function NavLinkContent({
  link,
  className,
  onNavigate,
}: {
  link: AccountNavLinkView;
  className?: string;
  onNavigate?: () => void;
}) {
  const linkClassName = cn(
    className,
    link.disabled && "pointer-events-none opacity-50"
  );

  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={link.disabled}
        tabIndex={link.disabled ? -1 : undefined}
        onClick={onNavigate}
        className={linkClassName}
      >
        {link.title}
      </a>
    );
  }

  return (
    <Link
      href={link.href}
      aria-disabled={link.disabled}
      tabIndex={link.disabled ? -1 : undefined}
      onClick={onNavigate}
      className={linkClassName}
    >
      {link.title}
    </Link>
  );
}

function DesktopNavLink({ link }: { link: AccountNavLinkView }) {
  const className = cn(
    "relative rounded-[20px] px-4 py-2 text-[14px] font-semibold transition-colors duration-200 z-10",
    link.isActive
      ? "text-[#007AFF] dark:text-blue-400"
      : "text-[#1D1D1F]/60 dark:text-white/60 hover:text-[#1D1D1F] dark:hover:text-white",
    link.disabled && "pointer-events-none opacity-50"
  );

  return (
    <div className="relative">
      {link.isActive && (
        <motion.div
          layoutId="desktop-nav-indicator"
          className="absolute inset-0 rounded-[20px] bg-[#007AFF]/10 dark:bg-[#007AFF]/20 shadow-sm ring-1 ring-[#007AFF]/20 dark:ring-[#007AFF]/30 backdrop-blur-md -z-10"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <NavLinkContent link={link} className={className} />
    </div>
  );
}

/** 桌面端水平导航（居中显示，链接样式对齐 new-api PublicHeader） */
export function AccountTopNavBar() {
  const links = useAccountNavLinks();

  return (
    <nav className="flex items-center gap-0.5 whitespace-nowrap" aria-label="账号中心导航">
      {links.map((link) => (
        <DesktopNavLink key={link.href} link={link} />
      ))}
    </nav>
  );
}

/** 移动端汉堡按钮（对齐 new-api PublicHeader hamburger） */
export function AccountMobileNavTrigger({
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
      <div className="relative size-4 will-change-transform" style={{ transform: "translateZ(0)" }}>
        <span
          className={cn(
            "absolute inset-x-0 block h-[2px] origin-center rounded-full bg-[#1D1D1F] dark:bg-white transition-all duration-300",
            open ? "top-[7px] rotate-45" : "top-[3px]"
          )}
        />
        <span
          className={cn(
            "absolute inset-x-0 top-[7px] block h-[2px] rounded-full bg-[#1D1D1F] dark:bg-white transition-all duration-300",
            open ? "scale-x-0 opacity-0" : "opacity-100"
          )}
        />
        <span
          className={cn(
            "absolute inset-x-0 block h-[2px] origin-center rounded-full bg-[#1D1D1F] dark:bg-white transition-all duration-300",
            open ? "top-[7px] -rotate-45" : "top-[11px]"
          )}
        />
      </div>
    </Button>
  );
}

function mobileNavItemClass(open: boolean, isActive: boolean, disabled?: boolean) {
  return cn(
    "flex items-center gap-3 py-3 text-base font-medium tracking-tight transition-all duration-500",
    MOBILE_OVERLAY_EASE,
    open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
    isActive ? "text-[#1D1D1F]" : "text-[#1D1D1F]/70",
    disabled && "pointer-events-none opacity-50"
  );
}

function mobileNavItemDelay(open: boolean, index: number) {
  return { transitionDelay: open ? `${100 + index * 50}ms` : "0ms" };
}

/** 移动端全屏导航层（对齐 new-api PublicHeader mobile overlay 错峰动画） */
export function AccountMobileNavOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const links = useAccountNavLinks();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 bg-[#F5F5F7]/98 backdrop-blur-2xl transition-opacity duration-500 sm:pointer-events-none sm:hidden",
        MOBILE_OVERLAY_EASE,
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col justify-between px-8 pt-20 pb-10">
        <nav className="flex flex-col gap-1">
          {links.map((link, index) => {
            const Icon = link.icon;
            const className = mobileNavItemClass(open, link.isActive, link.disabled);
            const style = mobileNavItemDelay(open, index);
            const tabIndex = open && !link.disabled ? undefined : -1;
            const icon = (
              <Icon
                size={18}
                strokeWidth={link.isActive ? 2 : 1.5}
                className={link.isActive ? "text-[#007AFF]" : "text-[#1D1D1F]/50"}
              />
            );

            if (link.external) {
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={link.disabled}
                  tabIndex={tabIndex}
                  onClick={onClose}
                  className={className}
                  style={style}
                >
                  {icon}
                  {link.title}
                </a>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-disabled={link.disabled}
                tabIndex={tabIndex}
                onClick={onClose}
                className={className}
                style={style}
              >
                {icon}
                {link.title}
              </Link>
            );
          })}
        </nav>

        {/* 底部区块：对齐 new-api 250ms 延迟入场 */}
        <div
          className={cn(
            "flex flex-col gap-3 transition-all duration-500",
            MOBILE_OVERLAY_EASE,
            open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
          style={{ transitionDelay: open ? "250ms" : "0ms" }}
        >
          <Link
            href="/account/profile"
            tabIndex={open ? undefined : -1}
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1D1D1F] text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            个人资料
          </Link>
        </div>
      </div>
    </div>
  );
}

/** @deprecated 使用 AccountMobileNavTrigger + AccountMobileNavOverlay */
export function AccountMobileNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <AccountMobileNavTrigger
        open={mobileOpen}
        onToggle={() => setMobileOpen((value) => !value)}
      />
      <AccountMobileNavOverlay
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
    </>
  );
}